// Study view: renders cards and records answers. Question logic lives in quiz.js,
// persistence in store.js.
import { $, esc, sourceLink } from './dom.js';
import { go } from './router.js';
import { studySources, resolveKind, drawCard } from '../quiz.js';
import { recordResult, kindStats, saveExams } from '../store.js';
import { lookupNationality } from '../services/nationality.js';

let exam = null;
let card = null;
let kind = 'works';
let answered = false;
let session = { correct: 0, total: 0 };
let drawId = 0; // guards against out-of-order async draws

const setCard = html => { $('card').innerHTML = html; };

export function start(selected) {
  exam = selected;
  session = { correct: 0, total: 0 };
  $('studyTitle').textContent = exam.name;
  $('source').innerHTML = studySources(exam)
    .map(s => `<option value="${s.value}">${esc(s.label)}</option>`).join('');
  go('study');
  next();
}

async function next() {
  const ticket = ++drawId;
  answered = false;
  kind = resolveKind($('source').value);
  setCard('<div class="small">Loading...</div>');
  updateScore();

  const drawn = await drawCard(exam, kind, $('mode').value);
  if (!drawn.error) await backfillNationality(drawn);
  if (ticket !== drawId) return;

  card = drawn;
  setCard(card.error ? `<div class="small">${esc(card.error)}</div>` : cardHtml(card));
}

/** Exams saved before nationality existed: look it up once and remember it ('' = looked up, unknown). */
async function backfillNationality(c) {
  if (c.kind === 'terms' || !c.artist || c.nationality !== undefined) return;
  c.nationality = await lookupNationality(c.artist);
  const saved = exam.works.find(w => w.id === c.id);
  if (saved) {
    saved.nationality = c.nationality;
    saveExams();
  }
}

// ---- rendering ----

function mediaHtml(c) {
  if (c.kind === 'terms') return '';
  const media = c.img
    ? `<img src="${esc(c.img)}">`
    : `<h3>${esc(c.title)}</h3><div class="small">(no image)</div>`;
  return `<div class="card-media">${media}</div>`;
}

function questionHtml(c) {
  if (c.kind === 'terms') {
    return c.choices
      ? `<div class="prompt">${esc(c.def)}</div><div>Which term?</div>`
      : `<h3 class="prompt">${esc(c.term)}</h3>`;
  }
  return c.choices ? '<div>Who is the artist?</div>' : '';
}

function interactionHtml(c) {
  if (c.choices) {
    return `<div id="choices">${c.choices.map((choice, i) =>
      `<div><button type="button" class="sec choice" data-action="study.pick" data-i="${i}">${esc(choice)}</button></div>`).join('')}</div>`;
  }
  const label = c.kind === 'terms' ? 'Definition' : 'Answer';
  return `<div id="answer"><button type="button" data-action="study.reveal">Show ${label}</button></div>`;
}

function cardHtml(c) {
  return `<div class="card-layout${c.kind === 'terms' ? '' : ' with-media'}">
    ${mediaHtml(c)}
    <div class="card-body">
      ${questionHtml(c)}${interactionHtml(c)}
      <div id="feedback"></div>
      <button type="button" class="sec" data-action="study.next">Next</button>
    </div>
  </div>`;
}

const gradeButtonsHtml = () => answered ? '' : `
  <div id="selfgrade">
    <button type="button" data-action="study.grade" data-ok="true">Got it</button>
    <button type="button" class="del" data-action="study.grade" data-ok="false">Missed</button>
  </div>`;

const workDetails = c => `${esc(c.title)}, ${esc(c.date)}`;
const artistLabel = c => `${esc(c.artist || 'Unknown')}${c.nationality ? ` (${esc(c.nationality)})` : ''}`;

function answerSummary(c) {
  return c.kind === 'terms' ? esc(c.answer) : `${artistLabel(c)} — ${workDetails(c)}`;
}

function updateScore() {
  const all = exam && kindStats(exam, kind);
  const pct = all && all.t ? Math.round(100 * all.c / all.t) : 0;
  $('score').textContent = `Session: ${session.correct} / ${session.total}` +
    (all ? ` · All-time: ${all.c} / ${all.t} (${pct}%)` : '');
}

// ---- answering ----

function record(correct) {
  if (answered) return;
  answered = true;
  session.total++;
  if (correct) session.correct++;
  recordResult(exam, kind, correct);
  updateScore();
  const selfGrade = $('selfgrade');
  if (selfGrade) selfGrade.remove();
}

function reveal() {
  const body = card.kind === 'terms'
    ? esc(card.def || '(no definition — edit exam to add)')
    : `<strong>${artistLabel(card)}</strong><br>${workDetails(card)}`;
  $('answer').innerHTML = body + sourceLink(card.src) + gradeButtonsHtml();
}

function pickChoice(index) {
  if (answered || !card.choices) return;
  const correct = card.choices[index] === card.answer;
  const feedback = $('feedback');
  feedback.className = correct ? 'correct' : 'incorrect';
  feedback.innerHTML = `${correct ? 'Correct! ' : 'Answer: '}${answerSummary(card)}${sourceLink(card.src)}`;
  document.querySelectorAll('#choices button').forEach((button, i) => {
    if (card.choices[i] === card.answer) button.classList.add('right');
    else if (i === index) button.classList.add('wrong');
  });
  record(correct);
}

export const actions = {
  'study.back': () => go('home'),
  'study.next': next,
  'study.reveal': reveal,
  'study.pick': el => pickChoice(+el.dataset.i),
  'study.grade': el => record(el.dataset.ok === 'true'),
};
