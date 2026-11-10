// Exam persistence and score keeping. The only module that touches localStorage.
import type { Exam, Filter, Kind, Score, Term, Work } from './types.js';

const KEY = 'exams';

/** Anything that may be in localStorage: the current format or one written by an older version. */
interface SavedExam {
  name: string;
  type?: 'list' | 'filter';
  // legacy "list" exams
  items?: Work[];
  // legacy "filter" exams
  deptId?: string;
  deptName?: string;
  from?: string;
  to?: string;
  q?: string;
  // current format
  works?: Work[];
  terms?: Term[];
  filter?: Filter | null;
  stats?: Exam['stats'];
}

/** Upgrade exams saved by older versions of the app. */
function migrate(e: SavedExam): Exam {
  if (e.type === 'list') {
    return { name: e.name, works: e.items ?? [], terms: [], filter: null, stats: {} };
  }
  if (e.type === 'filter') {
    return {
      name: e.name, works: [], terms: [], stats: {},
      filter: { deptId: e.deptId ?? '', deptName: e.deptName, from: e.from ?? '', to: e.to ?? '', q: e.q ?? '' },
    };
  }
  return { name: e.name, works: e.works ?? [], terms: e.terms ?? [], filter: e.filter ?? null, stats: e.stats ?? {} };
}

function load(): Exam[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedExam[]).map(migrate);
  } catch {
    return [];
  }
}

const exams: Exam[] = load();
const persist = (): void => { localStorage.setItem(KEY, JSON.stringify(exams)); };

export const makeExam = ({ name, works = [], terms = [], filter = null }: Partial<Exam> & { name: string }): Exam =>
  ({ name, works, terms, filter, stats: {} });

export const getExams = (): Exam[] => exams;

export function addExam(exam: Exam): void { exams.push(exam); persist(); }
export function removeExam(index: number): void { exams.splice(index, 1); persist(); }
export function resetStats(index: number): void {
  const exam = exams[index];
  if (exam) { exam.stats = {}; persist(); }
}

/** Call after mutating an exam in place. */
export const saveExams = persist;

export function recordResult(exam: Exam, kind: Kind, correct: boolean): void {
  const score = (exam.stats[kind] ??= { c: 0, t: 0 });
  score.t++;
  if (correct) score.c++;
  persist();
}

export const kindStats = (exam: Exam, kind: Kind): Score | undefined => exam.stats[kind];

export function overallStats(exam: Exam): Score {
  return Object.values(exam.stats).reduce((acc, s) => ({ c: acc.c + s.c, t: acc.t + s.t }), { c: 0, t: 0 });
}
