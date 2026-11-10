// Study view: renders cards and records answers. Question logic lives in quiz.ts,
// persistence in store.ts.
import { validateImageUrl } from '../imageUrl.js';
import { drawCard, isCardError, resolveKind, studySources } from '../quiz.js';
import { findWorkImage } from '../services/imageFinder.js';
import { enrichWorks } from '../services/enrich.js';
import { isComplete, lookupWorkInfo } from '../services/workInfo.js';
import { kindStats, recordResult, saveExams } from '../store.js';
import type { Card, Exam, Kind, Mode, Question, Source, WorkCard } from '../types.js';
import { indexOf, type ActionMap } from './actions.js';
import { $, esc, field, sourceLink } from './dom.js';
import { fileToDataUrl } from './image.js';
import { go } from './router.js';

let exam: Exam | null = null;
let card: Card | null = null;
let kind: Kind = 'works';
let answered = false;
let session = { correct: 0, total: 0 };
let drawId = 0; // guards against out-of-order async draws
/** What the answer area currently shows, so it can be redrawn after the details are edited. */
let shown: { kind: 'feedback'; correct: boolean } | { kind: 'reveal' } | null = null;

const setCard = (html: string): void => { $('card').innerHTML = html; };
const modeSelect = (): HTMLSelectElement => field('mode', HTMLSelectElement);
const sourceSelect = (): HTMLSelectElement => field('source', HTMLSelectElement);
const currentMode = (): Mode => modeSelect().value as Mode;

export function start(selected: Exam): void {
  exam = selected;
  session = { correct: 0, total: 0 };
  $('studyTitle').textContent = exam.name;
  sourceSelect().innerHTML = studySources(exam)
    .map((s) => `<option value="${s.value}">${esc(s.label)}</option>`).join('');
  go('study');
  void next();
  // Fill in nationality / movement for works saved before those existed, in the background.
  void enrichWorks(exam.works, saveExams);
}

async function next(): Promise<void> {
  if (!exam) return;
  const ticket = ++drawId;
  answered = false;
  shown = null;
  kind = resolveKind(sourceSelect().value as Source);
  setCard('<div class="small">Loading...</div>');
  updateScore();

  const drawn = await drawCard(exam, kind, currentMode());
  if (!isCardError(drawn)) await backfillArtistInfo(exam, drawn);
  if (ticket !== drawId) return;

  if (isCardError(drawn)) {
    card = null;
    setCard(`<div class="small">${esc(drawn.error)}</div>`);
  } else {
    card = drawn;
    setCard(cardHtml(drawn));
  }
}

/**
 * Works saved before nationality / movement existed: look them up once and remember them ('' = looked up, unknown).
 * The background pass started in `start` does this for every work; this makes sure the card on screen has them.
 */
async function backfillArtistInfo(owner: Exam, c: Card): Promise<void> {
  if (c.kind !== 'works' || !c.artist || (c.nationality !== undefined && c.movement !== undefined)) return;
  const info = await lookupWorkInfo(c);
  c.nationality ??= info.nationality;
  c.movement ??= info.movement;
  if (!isComplete(info)) return; // a request failed: show what we have, but don't save '' as "unknown"
  const saved = owner.works.find((w) => w.id === c.id);
  if (saved) {
    saved.nationality ??= info.nationality;
    saved.movement ??= info.movement;
    saveExams();
  }
}

// ---- rendering ----

function mediaInnerHtml(c: WorkCard): string {
  return c.img
    ? `<img src="${esc(c.img)}">`
    : `<h3>${esc(c.title)}</h3><div class="small">(no image)</div>`;
}

function mediaHtml(c: Card): string {
  return c.kind === 'terms' ? '' : `<div class="card-media">${mediaInnerHtml(c)}</div>`;
}

const QUESTION_TEXT: Record<Question, string> = {
  artist: 'Who is the artist?',
  title: 'What is the title of this work?',
  year: 'When was this made?',
  movement: 'What art movement is this?',
};

function questionHtml(c: Card): string {
  if (c.kind === 'terms') {
    return c.choices
      ? `<div class="prompt">${esc(c.def)}</div><div>Which term?</div>`
      : `<h3 class="prompt">${esc(c.term)}</h3>`;
  }
  return c.choices ? `<div>${QUESTION_TEXT[c.question]}</div>` : '';
}

function interactionHtml(c: Card): string {
  if (c.choices) {
    return `<div id="choices">${c.choices.map((choice, i) =>
      `<div><button type="button" class="sec choice" data-action="study.pick" data-i="${i}">${esc(choice)}</button></div>`).join('')}</div>`;
  }
  const label = c.kind === 'terms' ? 'Definition' : 'Answer';
  return `<div id="answer"><button type="button" data-action="study.reveal">Show ${label}</button></div>`;
}

function cardHtml(c: Card): string {
  return `<div class="card-layout${c.kind === 'terms' ? '' : ' with-media'}">
    ${mediaHtml(c)}
    <div class="card-body">
      ${questionHtml(c)}${interactionHtml(c)}
      <div id="feedback"></div>
      <div id="editBar"></div>
      <button type="button" class="sec" data-action="study.next">Next</button>
      <div id="editArea"></div>
    </div>
  </div>`;
}

const gradeButtonsHtml = (): string => answered ? '' : `
  <div id="selfgrade">
    <button type="button" data-action="study.grade" data-ok="true">Got it</button>
    <button type="button" class="del" data-action="study.grade" data-ok="false">Missed</button>
  </div>`;

const workDetails = (c: WorkCard): string =>
  `${esc(c.title)}, ${esc(c.date)}${c.movement ? ` · ${esc(c.movement)}` : ''}`;
const artistLabel = (c: WorkCard): string => `${esc(c.artist || 'Unknown')}${c.nationality ? ` (${esc(c.nationality)})` : ''}`;

/** The answer first, then the rest of the work's citation (so the answer isn't repeated). */
function answerSummary(c: Card): string {
  if (c.kind === 'terms') return esc(c.answer);
  const movement = c.movement ? ` · ${esc(c.movement)}` : '';
  switch (c.question) {
    case 'artist': return `${artistLabel(c)} — ${esc(c.title)}, ${esc(c.date)}${movement}`;
    case 'title': return `${esc(c.title)} — ${artistLabel(c)}, ${esc(c.date)}${movement}`;
    case 'year': return `${esc(c.date)} — ${esc(c.title)}, ${artistLabel(c)}${movement}`;
    case 'movement': return `${esc(c.movement)} — ${esc(c.title)}, ${artistLabel(c)}, ${esc(c.date)}`;
  }
}

function updateScore(): void {
  const all = exam ? kindStats(exam, kind) : undefined;
  const pct = all?.t ? Math.round(100 * all.c / all.t) : 0;
  $('score').textContent = `Session: ${session.correct} / ${session.total}` +
    (all ? ` · All-time: ${all.c} / ${all.t} (${pct}%)` : '');
}

// ---- answering ----

function record(correct: boolean): void {
  if (answered || !exam) return;
  answered = true;
  session.total++;
  if (correct) session.correct++;
  recordResult(exam, kind, correct);
  updateScore();
  document.getElementById('selfgrade')?.remove();
  showEditButton();
}

function reveal(): void {
  if (!card) return;
  const body = card.kind === 'terms'
    ? esc(card.def || '(no definition — edit exam to add)')
    : `<strong>${artistLabel(card)}</strong><br>${workDetails(card)}`;
  $('answer').innerHTML = body + sourceLink(card.src) + gradeButtonsHtml();
  shown = { kind: 'reveal' };
  showEditButton();
}

function showFeedback(correct: boolean): void {
  if (!card) return;
  const feedback = $('feedback');
  feedback.className = correct ? 'correct' : 'incorrect';
  feedback.innerHTML = `${correct ? 'Correct! ' : 'Answer: '}${answerSummary(card)}${sourceLink(card.src)}`;
  shown = { kind: 'feedback', correct };
}

function pickChoice(index: number): void {
  if (answered || !card?.choices) return;
  const correct = card.choices[index] === card.answer;
  showFeedback(correct);
  const choices = card.choices;
  document.querySelectorAll('#choices button').forEach((button, i) => {
    if (choices[i] === card?.answer) button.classList.add('right');
    else if (i === index) button.classList.add('wrong');
  });
  record(correct);
}

// ---- editing details (overrides for facts that turn out to be wrong) ----

/** Cards from the exam's own lists can be edited; random Met art isn't saved in the exam. */
const isEditable = (c: Card | null): c is Card => c !== null && c.kind !== 'pool';

/** The fact a work question is about, as it is now. */
const factOf = (c: WorkCard): string =>
  ({ artist: c.artist, title: c.title, year: c.date, movement: c.movement ?? '' })[c.question];

function showEditButton(): void {
  if (isEditable(card)) $('editBar').innerHTML = '<button type="button" class="sec" data-action="study.edit">Edit details</button>';
}

interface WorkImage {
  img: string;
  src: string;
}

/** The image the open form would save: set by "Find automatically", a chosen file or Remove. */
let editImage: WorkImage = { img: '', src: '' };

const editField = (id: string, label: string, value: string | undefined): string =>
  `<label class="field">${label}<input type="text" id="${id}" value="${esc(value)}"></label>`;

const previewHtml = (image: WorkImage): string =>
  image.img ? `<img src="${esc(image.img)}" alt="">` : '<span class="small">No image</span>';

const imageUrlFor = (image: WorkImage): string => (image.img.startsWith('https://') ? image.img : '');

const imageFieldsHtml = (image: WorkImage): string => `
  <div class="field">Image
    <div id="editPreview" class="edit-preview">${previewHtml(image)}</div>
    <input type="text" id="editImageUrl" aria-label="Image link" placeholder="Paste an image link (https://…)" value="${esc(imageUrlFor(image))}">
    <div class="edit-actions">
      <button type="button" class="sec" data-action="study.findImage">Find automatically</button>
      <button type="button" class="sec" data-action="study.chooseImageFile">Choose a file…</button>
      <button type="button" class="sec" data-action="study.removeImage">Remove</button>
    </div>
    <input type="file" id="editImageFile" accept="image/*" hidden data-change="study.imageFileChosen">
    <div id="editImageMsg" class="small"></div>
  </div>`;

function editFormHtml(c: Card): string {
  const fields = c.kind === 'terms'
    ? `${editField('editTerm', 'Term', c.term)}
       <label class="field">Definition<textarea id="editDef" rows="4">${esc(c.def)}</textarea></label>`
    : `${editField('editArtist', 'Artist', c.artist)}${editField('editNationality', 'Nationality', c.nationality)}
       ${editField('editTitle', 'Title', c.title)}${editField('editDate', 'Date', c.date)}
       ${editField('editMovement', 'Art movement', c.movement)}${imageFieldsHtml(editImage)}`;
  return `<div class="edit-form">
    ${fields}
    <div id="editMsg" class="small">Saved to this exam. Leave a field empty if it's unknown.</div>
    <button type="button" data-action="study.saveEdit">Save</button>
    <button type="button" class="sec" data-action="study.cancelEdit">Cancel</button>
  </div>`;
}

function openEdit(): void {
  if (!isEditable(card)) return;
  if (card.kind !== 'terms') editImage = { img: card.img, src: card.src ?? '' };
  $('editBar').innerHTML = '';
  $('editArea').innerHTML = editFormHtml(card);
}

function closeEdit(): void {
  $('editArea').innerHTML = '';
  showEditButton();
}

const inputValue = (id: string): string => field(id, HTMLInputElement).value.trim();
const formIsOpen = (): boolean => document.querySelector('#editArea .edit-form') !== null;

/** Redraws whatever answer is on screen so it shows the corrected facts. */
function refreshAnswer(): void {
  if (shown?.kind === 'feedback') showFeedback(shown.correct);
  else if (shown?.kind === 'reveal') reveal();
}

// -- the image part of the form --

const imageMessage = (text: string): void => { $('editImageMsg').textContent = text; };

function setEditImage(image: WorkImage, message: string): void {
  editImage = image;
  $('editPreview').innerHTML = previewHtml(image);
  field('editImageUrl', HTMLInputElement).value = imageUrlFor(image);
  imageMessage(message);
}

async function findImageAutomatically(): Promise<void> {
  const title = inputValue('editTitle');
  if (!title) { imageMessage('Enter a title first.'); return; }
  imageMessage('Searching…');
  const found = await findWorkImage({ artist: inputValue('editArtist'), title });
  if (!formIsOpen()) return; // closed while searching
  if (found.img) setEditImage(found, 'Found an image. Check it looks right, then Save.');
  else imageMessage('No image found. Paste a link or choose a file instead.');
}

async function imageFileChosen(element: HTMLElement): Promise<void> {
  const input = element as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  imageMessage('Reading image…');
  try {
    const img = await fileToDataUrl(file);
    if (formIsOpen()) setEditImage({ img, src: '' }, 'Image added from your file. Save to keep it.');
  } catch (error) {
    if (formIsOpen()) imageMessage(error instanceof Error ? error.message : 'Could not read that image.');
  } finally {
    input.value = ''; // lets the same file be chosen again
  }
}

/** The image to save: a link typed into the box wins over the one chosen or found. */
function imageToSave(): WorkImage {
  const typed = inputValue('editImageUrl');
  return typed && typed !== editImage.img ? { img: typed, src: typed } : editImage;
}

// -- saving --

function saveEdit(): void {
  const current = card; // captured so the narrowing below holds inside callbacks
  if (!exam || !current || current.kind === 'pool') return;
  const owner = exam;
  const message = (text: string): void => { $('editMsg').textContent = text; };
  const undo: (() => void)[] = []; // put everything back if the browser refuses to save

  /** Applies `values` to `target`, remembering how to undo it. */
  const change = <T extends object>(target: T, values: Partial<T>): void => {
    const before = { ...target };
    Object.assign(target, values);
    undo.push(() => { Object.assign(target, before); });
  };

  if (current.kind === 'terms') {
    const term = inputValue('editTerm');
    if (!term) { message('A term needs a name.'); return; }
    const def = field('editDef', HTMLTextAreaElement).value.trim();
    const saved = owner.terms.find((t) => t.term === current.term);
    if (saved) change(saved, { term, def });
    change(current, { term, def, answer: term });
  } else {
    const image = imageToSave();
    // Only check an image the user changed: one saved earlier must not block editing something else.
    const problem = image.img === current.img ? null : validateImageUrl(image.img);
    if (problem) { message(problem); return; }
    const details = {
      artist: inputValue('editArtist'), nationality: inputValue('editNationality'), title: inputValue('editTitle'),
      date: inputValue('editDate'), movement: inputValue('editMovement'), img: image.img, src: image.src,
    };
    if (!details.title) { message('A work needs a title.'); return; }
    const saved = owner.works.find((w) => w.id === current.id);
    if (saved) change(saved, details);
    change(current, details);
    change(current, { answer: factOf(current) });
    // Nationality belongs to the artist, so fix it on their other works too.
    if (details.artist) {
      for (const w of owner.works) if (w.artist === details.artist) change(w, { nationality: details.nationality });
    }
  }

  try {
    saveExams();
  } catch {
    undo.reverse().forEach((revert) => { revert(); });
    message("Couldn't save: the browser's storage is full or unavailable. A smaller image or an image link takes less room.");
    return;
  }
  const media = document.querySelector('.card-media');
  if (current.kind !== 'terms' && media) media.innerHTML = mediaInnerHtml(current);
  refreshAnswer();
  closeEdit();
}

export const actions: ActionMap = {
  'study.back': () => { go('home'); },
  'study.next': next,
  'study.reveal': reveal,
  'study.pick': (el) => { pickChoice(indexOf(el)); },
  'study.grade': (el) => { record(el.dataset.ok === 'true'); },
  'study.edit': openEdit,
  'study.saveEdit': saveEdit,
  'study.cancelEdit': closeEdit,
  'study.findImage': findImageAutomatically,
  'study.chooseImageFile': () => { field('editImageFile', HTMLInputElement).click(); },
  'study.imageFileChosen': imageFileChosen,
  'study.removeImage': () => { setEditImage({ img: '', src: '' }, 'Image removed. Save to keep that.'); },
};
