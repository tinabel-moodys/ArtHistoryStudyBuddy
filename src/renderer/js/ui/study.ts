// Study view: renders cards and records answers. Question logic lives in quiz.ts,
// persistence in store.ts.
import { drawCard, isCardError, resolveKind, studySources } from '../quiz.js';
import { enrichWorks } from '../services/enrich.js';
import { isComplete, lookupWorkInfo } from '../services/workInfo.js';
import { kindStats, recordResult, saveExams } from '../store.js';
import type { Card, Exam, Kind, Mode, Question, Source, WorkCard } from '../types.js';
import { indexOf, type ActionMap } from './actions.js';
import { $, esc, field, sourceLink } from './dom.js';
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

function mediaHtml(c: Card): string {
  if (c.kind === 'terms') return '';
  const media = c.img
    ? `<img src="${esc(c.img)}">`
    : `<h3>${esc(c.title)}</h3><div class="small">(no image)</div>`;
  return `<div class="card-media">${media}</div>`;
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

const editField = (id: string, label: string, value: string | undefined): string =>
  `<label class="field">${label}<input type="text" id="${id}" value="${esc(value)}"></label>`;

function editFormHtml(c: Card): string {
  const fields = c.kind === 'terms'
    ? `${editField('editTerm', 'Term', c.term)}
       <label class="field">Definition<textarea id="editDef" rows="4">${esc(c.def)}</textarea></label>`
    : `${editField('editArtist', 'Artist', c.artist)}${editField('editNationality', 'Nationality', c.nationality)}
       ${editField('editTitle', 'Title', c.title)}${editField('editDate', 'Date', c.date)}
       ${editField('editMovement', 'Art movement', c.movement)}`;
  return `<div class="edit-form">
    ${fields}
    <div id="editMsg" class="small">Saved to this exam. Leave a field empty if it's unknown.</div>
    <button type="button" data-action="study.saveEdit">Save</button>
    <button type="button" class="sec" data-action="study.cancelEdit">Cancel</button>
  </div>`;
}

function openEdit(): void {
  if (!isEditable(card)) return;
  $('editBar').innerHTML = '';
  $('editArea').innerHTML = editFormHtml(card);
}

function closeEdit(): void {
  $('editArea').innerHTML = '';
  showEditButton();
}

const inputValue = (id: string): string => field(id, HTMLInputElement).value.trim();

/** Redraws whatever answer is on screen so it shows the corrected facts. */
function refreshAnswer(): void {
  if (shown?.kind === 'feedback') showFeedback(shown.correct);
  else if (shown?.kind === 'reveal') reveal();
}

function saveEdit(): void {
  const current = card; // captured so the narrowing below holds inside callbacks
  if (!exam || !current || current.kind === 'pool') return;
  const message = (text: string): void => { $('editMsg').textContent = text; };

  if (current.kind === 'terms') {
    const term = inputValue('editTerm');
    if (!term) { message('A term needs a name.'); return; }
    const def = field('editDef', HTMLTextAreaElement).value.trim();
    const saved = exam.terms.find((t) => t.term === current.term);
    if (saved) Object.assign(saved, { term, def });
    Object.assign(current, { term, def, answer: term });
  } else {
    const details = {
      artist: inputValue('editArtist'), nationality: inputValue('editNationality'), title: inputValue('editTitle'),
      date: inputValue('editDate'), movement: inputValue('editMovement'),
    };
    if (!details.title) { message('A work needs a title.'); return; }
    const saved = exam.works.find((w) => w.id === current.id);
    if (saved) Object.assign(saved, details);
    Object.assign(current, details);
    current.answer = factOf(current);
    // Nationality belongs to the artist, so fix it on their other works too.
    if (details.artist) {
      for (const w of exam.works) if (w.artist === details.artist) w.nationality = details.nationality;
    }
  }
  saveExams();
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
};
