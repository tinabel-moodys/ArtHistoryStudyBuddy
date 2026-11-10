// Editor view: build a new exam by hand or from a markdown file.
import { $, esc, resultRow } from './dom.js';
import { go } from './router.js';
import * as met from '../api/met.js';
import { importExam } from '../services/importer.js';
import { parseTermLines, formatTermLines } from '../markdown.js';
import { addExam, makeExam } from '../store.js';

// Draft state for the exam being built
let works = [];
let termSources = {}; // term -> source URL (for auto-filled definitions)
let searchResults = [];
let departmentsLoaded = false;

const say = message => { $('editorMsg').textContent = message; };

function addWork(work) {
  if (!works.some(w => w.id === work.id)) works.push(work);
  renderWorks();
}

function renderWorks() {
  $('addedCount').textContent = works.length;
  $('addedList').innerHTML = works.map((w, i) => resultRow({
    img: w.img,
    title: w.title,
    button: `<button type="button" class="del" data-action="editor.removeWork" data-i="${i}">✕</button>`,
  })).join('');
}

function renderSearchResults(message) {
  $('searchResults').innerHTML = message
    ? `<div class="small">${esc(message)}</div>`
    : searchResults.map((w, i) => resultRow({
      img: w.img,
      title: w.title,
      subtitle: `${w.artist || 'Unknown'}${w.nationality ? ` (${w.nationality})` : ''} · ${w.date}`,
      button: `<button type="button" data-action="editor.addResult" data-i="${i}">Add</button>`,
    })).join('');
}

async function loadDepartments() {
  if (departmentsLoaded) return;
  try {
    for (const d of await met.listDepartments()) $('exDept').add(new Option(d.displayName, d.departmentId));
    departmentsLoaded = true;
  } catch { say('Could not load departments (offline?).'); }
}

export function open() {
  works = []; termSources = {}; searchResults = [];
  for (const id of ['exName', 'exFrom', 'exTo', 'exQ', 'searchQ', 'exTerms', 'mdPath']) $(id).value = '';
  $('useFilter').checked = false;
  $('filterFields').hidden = true;
  renderSearchResults('');
  renderWorks();
  say('');
  go('editor');
  loadDepartments();
}

async function runImport(path) {
  let text;
  try { text = await window.api.readMd(path); } catch { say(`Cannot read file: ${path}`); return; }

  const imported = await importExam(text, say);
  if (!$('exName').value) $('exName').value = imported.title;

  for (const t of imported.terms) if (t.src) termSources[t.term] = t.src;
  const existing = $('exTerms').value.trim();
  const lines = formatTermLines(imported.terms);
  $('exTerms').value = existing ? `${existing}\n${lines}` : lines;

  imported.works.forEach(addWork);

  say(`Imported ${imported.terms.length} terms (definitions auto-filled from Wikipedia — review!), ${imported.works.length} works.` +
    (imported.noImage.length ? ` No image: ${imported.noImage.join('; ')}` : ''));
}

/** Reads the filter form; returns { filter } or { error }. filter is null when unchecked. */
function readFilter() {
  if (!$('useFilter').checked) return { filter: null };
  const from = $('exFrom').value;
  const to = $('exTo').value;
  if ((from === '') !== (to === '')) return { error: 'Set both years or neither.' };
  return {
    filter: { deptId: $('exDept').value, deptName: $('exDept').selectedOptions[0].text, from, to, q: $('exQ').value.trim() },
  };
}

function save() {
  const name = $('exName').value.trim();
  if (!name) return say('Name required.');

  const terms = parseTermLines($('exTerms').value).map(t => ({ ...t, src: termSources[t.term] || '' }));
  const { filter, error } = readFilter();
  if (error) return say(error);
  if (!works.length && !terms.length && !filter) return say('Add works, terms, or a random pool.');

  addExam(makeExam({ name, works, terms, filter }));
  go('home');
}

export const actions = {
  'editor.cancel': () => go('home'),
  'editor.save': save,
  'editor.toggleFilter': el => { $('filterFields').hidden = !el.checked; },
  'editor.removeWork': el => { works.splice(+el.dataset.i, 1); renderWorks(); },
  'editor.addResult': el => addWork(searchResults[+el.dataset.i]),
  'editor.importPath': () => { const p = $('mdPath').value.trim(); if (p) return runImport(p); },
  'editor.browse': async () => {
    const p = await window.api.pickMd();
    if (p) { $('mdPath').value = p; await runImport(p); }
  },
  'editor.search': async () => {
    const q = $('searchQ').value.trim();
    if (!q) return;
    renderSearchResults('Searching...');
    try {
      searchResults = await met.searchWorks(q);
      renderSearchResults(searchResults.length ? '' : 'No results with images.');
    } catch { renderSearchResults('Search failed.'); }
  },
};
