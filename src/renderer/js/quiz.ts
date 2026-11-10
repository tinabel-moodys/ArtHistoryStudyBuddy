// Study logic: what can be studied and how a question is built.
// Knows about exams and cards; knows nothing about the DOM or localStorage.
import { FAMOUS_ARTISTS } from './data/artists.js';
import { pickRandomWork } from './services/randomArt.js';
import { maskTerm } from './textMask.js';
import type { Card, CardError, Exam, Kind, Mode, Source, Work } from './types.js';
import { pick, shuffle, unique } from './util.js';

const DISTRACTORS = 3;

export interface SourceOption {
  value: Source;
  label: string;
}

/** Study sources an exam supports, for the source dropdown. */
export function studySources(exam: Exam): SourceOption[] {
  const sources: SourceOption[] = [];
  if (exam.works.length && exam.terms.length) sources.push({ value: 'mix', label: 'Works + Terms (mixed)' });
  if (exam.works.length) sources.push({ value: 'works', label: 'Must Know Works' });
  if (exam.terms.length) sources.push({ value: 'terms', label: 'Must Know Terms' });
  if (exam.filter) sources.push({ value: 'pool', label: 'Random Art' });
  return sources;
}

/** 'mix' becomes works or terms per card; other sources pass through. */
export const resolveKind = (source: Source): Kind =>
  source === 'mix' ? (Math.random() < 0.5 ? 'works' : 'terms') : source;

/** The right answer plus up to 3 distinct wrong ones, shuffled. */
function withDistractors(answer: string, candidates: readonly string[]): string[] {
  const wrong = unique(candidates.filter((c) => c && c.toLowerCase() !== answer.toLowerCase()));
  return shuffle([answer, ...shuffle(wrong).slice(0, DISTRACTORS)]);
}

export const isCardError = (result: Card | CardError): result is CardError => 'error' in result;

async function drawWork(exam: Exam, kind: 'works' | 'pool'): Promise<Work | null> {
  try {
    if (kind === 'works') return exam.works.length ? pick(exam.works) : null;
    return exam.filter ? await pickRandomWork(exam.filter) : null;
  } catch {
    return null; // offline etc.
  }
}

/** A card, or { error } when nothing can be shown. */
export async function drawCard(exam: Exam, kind: Kind, mode: Mode): Promise<Card | CardError> {
  const quiz = mode === 'quiz';

  if (kind === 'terms') {
    const pool = quiz ? exam.terms.filter((t) => t.def) : exam.terms;
    if (!pool.length) return { error: 'No terms with definitions for quiz mode.' };
    const t = pick(pool);
    return {
      kind, term: t.term, def: quiz ? maskTerm(t.def, t.term) : t.def, src: t.src, answer: t.term,
      choices: quiz ? withDistractors(t.term, exam.terms.map((x) => x.term)) : null,
    };
  }

  const work = await drawWork(exam, kind);
  if (!work) return { error: 'No artwork found for this exam. Edit filters or check connection.' };

  const artists = [...exam.works.map((w) => w.artist), ...FAMOUS_ARTISTS];
  return {
    kind, id: work.id, title: work.title, artist: work.artist, nationality: work.nationality,
    date: work.date, img: work.img, src: work.src,
    answer: work.artist,
    choices: quiz && work.artist ? withDistractors(work.artist, artists) : null,
  };
}
