// Study logic: what can be studied and how a question is built.
// Knows about exams and cards; knows nothing about the DOM or localStorage.
//
// Card shapes (choices === null means flashcard, otherwise multiple choice):
//   terms:        { kind, term, def, src, answer: term,   choices }
//   works / pool: { kind, id, title, artist, nationality, date, img, src, answer: artist, choices }
import { pick, shuffle, unique } from './util.js';
import { FAMOUS_ARTISTS } from './data/artists.js';
import { pickRandomWork } from './services/randomArt.js';
import { maskTerm } from './textMask.js';

const DISTRACTORS = 3;

/** Study sources an exam supports, for the source dropdown. */
export function studySources(exam) {
  const sources = [];
  if (exam.works.length && exam.terms.length) sources.push({ value: 'mix', label: 'Works + Terms (mixed)' });
  if (exam.works.length) sources.push({ value: 'works', label: 'Must Know Works' });
  if (exam.terms.length) sources.push({ value: 'terms', label: 'Must Know Terms' });
  if (exam.filter) sources.push({ value: 'pool', label: 'Random Art' });
  return sources;
}

/** 'mix' becomes works or terms per card; other sources pass through. */
export const resolveKind = source =>
  source === 'mix' ? (Math.random() < 0.5 ? 'works' : 'terms') : source;

/** The right answer plus up to 3 distinct wrong ones, shuffled. */
function withDistractors(answer, candidates) {
  const wrong = unique(candidates.filter(c => c && c.toLowerCase() !== answer.toLowerCase()));
  return shuffle([answer, ...shuffle(wrong).slice(0, DISTRACTORS)]);
}

/** @returns a card, or { error } when nothing can be shown */
export async function drawCard(exam, kind, mode) {
  const quiz = mode === 'quiz';

  if (kind === 'terms') {
    const pool = quiz ? exam.terms.filter(t => t.def) : exam.terms;
    if (!pool.length) return { error: 'No terms with definitions for quiz mode.' };
    const t = pick(pool);
    return {
      kind, term: t.term, def: quiz ? maskTerm(t.def, t.term) : t.def, src: t.src, answer: t.term,
      choices: quiz ? withDistractors(t.term, exam.terms.map(x => x.term)) : null,
    };
  }

  let work = null;
  try {
    work = kind === 'works' ? pick(exam.works) : await pickRandomWork(exam.filter);
  } catch { /* offline etc. */ }
  if (!work) return { error: 'No artwork found for this exam. Edit filters or check connection.' };

  const artists = [...exam.works.map(w => w.artist), ...FAMOUS_ARTISTS];
  return {
    kind, id: work.id, title: work.title, artist: work.artist, nationality: work.nationality,
    date: work.date, img: work.img, src: work.src,
    answer: work.artist,
    choices: quiz && work.artist ? withDistractors(work.artist, artists) : null,
  };
}
