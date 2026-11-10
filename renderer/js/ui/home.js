// Home view: list of exams.
import { $, esc } from './dom.js';
import { getExams, removeExam, resetStats, overallStats } from '../store.js';
import * as editor from './editor.js';
import * as study from './study.js';

function scoreSuffix(exam) {
  const { c, t } = overallStats(exam);
  return t ? ` · ${Math.round(100 * c / t)}% (${c}/${t})` : '';
}

export function render() {
  const exams = getExams();
  $('examList').innerHTML = exams.length
    ? exams.map((e, i) => `
      <div class="row">
        <div>
          <strong>${esc(e.name)}</strong><br>
          <span class="small">${e.works.length} works · ${e.terms.length} terms${e.filter ? ' · random pool' : ''}${scoreSuffix(e)}</span>
        </div>
        <div>
          <button type="button" data-action="home.study" data-i="${i}">Study</button>
          <button type="button" class="sec" title="Reset scores" data-action="home.reset" data-i="${i}">↺</button>
          <button type="button" class="del" title="Delete exam" data-action="home.delete" data-i="${i}">✕</button>
        </div>
      </div>`).join('')
    : '<div class="small">No exams yet. Add one.</div>';
}

export const actions = {
  'home.new': () => editor.open(),
  'home.study': el => study.start(getExams()[+el.dataset.i]),
  'home.reset': el => { resetStats(+el.dataset.i); render(); },
  'home.delete': el => { removeExam(+el.dataset.i); render(); },
};
