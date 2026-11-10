// Exam persistence and score keeping. The only module that touches localStorage.
//
// Exam shape:
//   { name, works: [{id,title,artist,nationality,date,img,src}], terms: [{term,def,src}],
//     filter: {deptId,deptName,from,to,q} | null,
//     stats: { [kind]: { c: correct, t: total } } }   kind = 'works' | 'terms' | 'pool'

const KEY = 'exams';

/** Upgrade exams saved by older versions of the app. */
function migrate(e) {
  if (e.type === 'list') {
    e = { name: e.name, works: e.items, terms: [], filter: null };
  } else if (e.type === 'filter') {
    e = {
      name: e.name, works: [], terms: [],
      filter: { deptId: e.deptId, deptName: e.deptName, from: e.from, to: e.to, q: e.q },
    };
  }
  return { ...e, stats: e.stats || {} };
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]').map(migrate); } catch { return []; }
}

let exams = load();
const persist = () => localStorage.setItem(KEY, JSON.stringify(exams));

export const makeExam = ({ name, works = [], terms = [], filter = null }) =>
  ({ name, works, terms, filter, stats: {} });

export const getExams = () => exams;

export function addExam(exam) { exams.push(exam); persist(); }
export const saveExams = persist; // after mutating an exam in place
export function removeExam(index) { exams.splice(index, 1); persist(); }
export function resetStats(index) { exams[index].stats = {}; persist(); }

export function recordResult(exam, kind, correct) {
  const s = (exam.stats[kind] = exam.stats[kind] || { c: 0, t: 0 });
  s.t++;
  if (correct) s.c++;
  persist();
}

export const kindStats = (exam, kind) => exam.stats[kind];

export function overallStats(exam) {
  return Object.values(exam.stats).reduce((acc, s) => ({ c: acc.c + s.c, t: acc.t + s.t }), { c: 0, t: 0 });
}
