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

const BACKUP_KEY = 'exams.backup';

/** Keep the unreadable data: the next save would otherwise overwrite it for good. */
function backUp(raw: string): void {
  try { localStorage.setItem(BACKUP_KEY, raw); } catch { /* storage unavailable or full */ }
}

const looksSaved = (e: unknown): e is SavedExam =>
  typeof e === 'object' && e !== null && typeof (e as { name?: unknown }).name === 'string';

/** Reads each saved exam on its own, so one bad entry doesn't take the others with it. */
function load(): Exam[] {
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); } catch { return []; }
  if (raw === null) return [];

  let saved: unknown;
  try { saved = JSON.parse(raw); } catch { backUp(raw); return []; }
  if (!Array.isArray(saved)) { backUp(raw); return []; }

  const loaded: Exam[] = [];
  let skipped = false;
  for (const entry of saved) {
    try {
      if (looksSaved(entry)) loaded.push(migrate(entry));
      else skipped = true;
    } catch {
      skipped = true;
    }
  }
  if (skipped) backUp(raw);
  return loaded;
}

const exams: Exam[] = load();
/** Throws if the browser refuses the write (e.g. storage full). */
const persist = (): void => { localStorage.setItem(KEY, JSON.stringify(exams)); };

export const makeExam = ({ name, works = [], terms = [], filter = null }: Partial<Exam> & { name: string }): Exam =>
  ({ name, works, terms, filter, stats: {} });

export const getExams = (): Exam[] => exams;

/** Throws (and leaves the list unchanged) if the exam can't be saved. */
export function addExam(exam: Exam): void {
  exams.push(exam);
  try { persist(); } catch (error) { exams.pop(); throw error; }
}
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
