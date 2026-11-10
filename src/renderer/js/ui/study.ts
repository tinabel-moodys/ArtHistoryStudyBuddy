// Study view: renders cards and records answers. Question logic lives in quiz.ts,
// persistence in store.ts.
import { drawCard, isCardError, resolveKind, studySources } from '../quiz.js';
import { lookupNationality } from '../services/nationality.js';
import { kindStats, recordResult, saveExams } from '../store.js';
import type { Card, Exam, Kind, Mode, Source, WorkCard } from '../types.js';
import { indexOf, type ActionMap } from './actions.js';
import { $, esc, field, sourceLink } from './dom.js';
import { go } from './router.js';

let exam: Exam | null = null;
let card: Card | null = null;
let kind: Kind = 'works';
let answered = false;
let session = { correct: 0, total: 0 };
let drawId = 0; // guards against out-of-order async draws

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
}

async function next(): Promise<void> {
  if (!exam) return;
  const ticket = ++drawId;
  answered = false;
  kind = resolveKind(sourceSelect().value as Source);
  setCard('<div class="small">Loading...</div>');
  updateScore();

  const drawn = await drawCard(exam, kind, currentMode());
  if (!isCardError(drawn)) await backfillNationality(exam, drawn);
  if (ticket !== drawId) return;

  if (isCardError(drawn)) {
    card = null;
    setCard(`<div class="small">${esc(drawn.error)}</div>`);
  } else {
    card = drawn;
    setCard(cardHtml(drawn));
  }
}

/** Exams saved before nationality existed: look it up once and remember it ('' = looked up, unknown). */
async function backfillNationality(owner: Exam, c: Card): Promise<void> {
  if (c.kind === 'terms' || !c.artist || c.nationality !== undefined) return;
  c.nationality = await lookupNationality(c.artist);
  const saved = owner.works.find((w) => w.id === c.id);
  if (saved) {
    saved.nationality = c.nationality;
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

function questionHtml(c: Card): string {
  if (c.kind === 'terms') {
    return c.choices
      ? `<div class="prompt">${esc(c.def)}</div><div>Which term?</div>`
      : `<h3 class="prompt">${esc(c.term)}</h3>`;
  }
  return c.choices ? '<div>Who is the artist?</div>' : '';
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
      <button type="button" class="sec" data-action="study.next">Next</button>
    </div>
  </div>`;
}

const gradeButtonsHtml = (): string => answered ? '' : `
  <div id="selfgrade">
    <button type="button" data-action="study.grade" data-ok="true">Got it</button>
    <button type="button" class="del" data-action="study.grade" data-ok="false">Missed</button>
  </div>`;

const workDetails = (c: WorkCard): string => `${esc(c.title)}, ${esc(c.date)}`;
const artistLabel = (c: WorkCard): string => `${esc(c.artist || 'Unknown')}${c.nationality ? ` (${esc(c.nationality)})` : ''}`;

const answerSummary = (c: Card): string =>
  c.kind === 'terms' ? esc(c.answer) : `${artistLabel(c)} — ${workDetails(c)}`;

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
}

function reveal(): void {
  if (!card) return;
  const body = card.kind === 'terms'
    ? esc(card.def || '(no definition — edit exam to add)')
    : `<strong>${artistLabel(card)}</strong><br>${workDetails(card)}`;
  $('answer').innerHTML = body + sourceLink(card.src) + gradeButtonsHtml();
}

function pickChoice(index: number): void {
  if (answered || !card?.choices) return;
  const correct = card.choices[index] === card.answer;
  const feedback = $('feedback');
  feedback.className = correct ? 'correct' : 'incorrect';
  feedback.innerHTML = `${correct ? 'Correct! ' : 'Answer: '}${answerSummary(card)}${sourceLink(card.src)}`;
  const choices = card.choices;
  document.querySelectorAll('#choices button').forEach((button, i) => {
    if (choices[i] === card?.answer) button.classList.add('right');
    else if (i === index) button.classList.add('wrong');
  });
  record(correct);
}

export const actions: ActionMap = {
  'study.back': () => { go('home'); },
  'study.next': next,
  'study.reveal': reveal,
  'study.pick': (el) => { pickChoice(indexOf(el)); },
  'study.grade': (el) => { record(el.dataset.ok === 'true'); },
};
