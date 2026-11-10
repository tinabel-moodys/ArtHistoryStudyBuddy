/**
 * @jest-environment jsdom
 */
// Drives the real UI modules in jsdom: markup from index.html, events through the app's dispatcher.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as Store from '../src/renderer/js/store.js';
import type { Exam, Term, Work } from '../src/renderer/js/types.js';
import { restoreFetch, stubFetch } from './helpers/fakeFetch.js';

jest.setTimeout(20_000);

let store: typeof Store;
let go: (view: 'home' | 'editor' | 'study') => void;

// ---- helpers ----

const $ = (selector: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`No element matches ${selector}`);
  return el;
};
const all = (selector: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(selector)];
const text = (selector: string): string => $(selector).textContent.replace(/\s+/g, ' ').trim();
const click = (selector: string | HTMLElement): void => { (typeof selector === 'string' ? $(selector) : selector).click(); };
const act = (name: string, index?: number): HTMLElement =>
  all(`[data-action="${name}"]`)[index ?? 0] ?? (() => { throw new Error(`No action ${name}`); })();
const setValue = (selector: string, value: string): void => { ($(selector) as HTMLInputElement).value = value; };
const choose = (selector: string, value: string): void => {
  const el = $(selector) as HTMLSelectElement;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });
async function waitFor(condition: () => boolean, what = 'condition'): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (condition()) return;
    await sleep(10);
  }
  throw new Error(`Timed out waiting for ${what}`);
}
const settle = (): Promise<void> => sleep(20);

const view = (): string => (['home', 'editor', 'study'].find((id) => !$(`#${id}`).hidden) ?? 'none');

const TERM_NAMES = ['Realism', 'Sublime', 'Japonisme', 'Primitivism'];
// The code in each definition identifies its term even though the quiz masks the term's own name.
const termsOf = (...names: string[]): Term[] => names.map((n, i) => ({ term: n, def: `${n} was a movement (code ${i}).`, src: 'https://en.wikipedia.org/wiki/x' }));
const termInPrompt = (prompt: string): string => TERM_NAMES[Number(/code (\d+)/.exec(prompt)?.[1])] ?? '';
const works: Work[] = [
  { id: 1, title: 'Third of May', artist: 'Francisco Goya', nationality: 'Spanish', date: '1814', img: 'img-goya.png', src: 'https://commons/goya' },
  { id: 2, title: 'Olympia', artist: 'Edouard Manet', nationality: 'French', date: '1863', img: 'img-manet.png', src: 'https://commons/manet' },
  { id: 3, title: 'The Hay Wain', artist: 'John Constable', nationality: 'British', date: '1821', img: 'img-constable.png', src: '' },
];
const seed = (over: Partial<Exam> = {}): Exam => {
  const exam = store.makeExam({ name: 'Nineteenth Century', works, terms: termsOf(...TERM_NAMES), ...over });
  store.addExam(exam);
  go('home');
  return exam;
};
async function study(sourceValue: string, mode: 'flash' | 'quiz'): Promise<void> {
  click(act('home.study'));
  await settle();
  choose('#mode', mode);
  choose('#source', sourceValue);
  await settle();
}

// ---- setup ----

beforeAll(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
  document.body.innerHTML = (/<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '').replace(/<script[\s\S]*?<\/script>/g, '');
  window.api = { readMd: jest.fn(), pickMd: jest.fn() };
  stubFetch([['/departments', { departments: [{ departmentId: 11, displayName: 'European Paintings' }] }]]);
  await import('../src/renderer/js/app.js');
  store = await import('../src/renderer/js/store.js');
  go = (await import('../src/renderer/js/ui/router.js')).go;
});

beforeEach(() => {
  store.getExams().splice(0);
  localStorage.clear();
  stubFetch([['/departments', { departments: [{ departmentId: 11, displayName: 'European Paintings' }] }]]);
  go('home');
});

afterEach(restoreFetch);

// ---- tests ----

describe('home', () => {
  it('starts on the home view with an empty state', () => {
    expect(view()).toBe('home');
    expect(text('#examList')).toBe('No exams yet. Add one.');
  });

  it('lists exams with counts, and shows a score once there is one', () => {
    const exam = seed();
    expect(text('#examList')).toContain('3 works · 4 terms');
    expect(text('#examList')).not.toContain('%');
    store.recordResult(exam, 'terms', true);
    store.recordResult(exam, 'terms', false);
    go('home');
    expect(text('#examList')).toContain('50% (1/2)');
  });

  it('resets scores and deletes exams', () => {
    const exam = seed();
    store.recordResult(exam, 'works', true);
    go('home');
    click(act('home.reset'));
    expect(text('#examList')).not.toContain('%');
    click(act('home.delete'));
    expect(text('#examList')).toBe('No exams yet. Add one.');
    expect(store.getExams()).toHaveLength(0);
  });
});

describe('editor', () => {
  it('opens with a clean form and loads departments', async () => {
    click(act('home.new'));
    expect(view()).toBe('editor');
    await waitFor(() => ($('#exDept') as HTMLSelectElement).options.length > 1, 'departments');
    expect(($('#exName') as HTMLInputElement).value).toBe('');
  });

  it('validates before saving', () => {
    click(act('home.new'));
    click(act('editor.save'));
    expect(text('#editorMsg')).toBe('Name required.');
    setValue('#exName', 'Midterm');
    click(act('editor.save'));
    expect(text('#editorMsg')).toBe('Add works, terms, or a random pool.');
    click('#useFilter');
    expect($('#filterFields').hidden).toBe(false);
    setValue('#exFrom', '1400');
    click(act('editor.save'));
    expect(text('#editorMsg')).toBe('Set both years or neither.');
    expect(view()).toBe('editor');
  });

  it('saves an exam from typed terms (a term without a definition is kept)', () => {
    click(act('home.new'));
    setValue('#exName', 'Midterm');
    setValue('#exTerms', 'Realism: art of everyday life\nSublime');
    click(act('editor.save'));
    expect(view()).toBe('home');
    expect(text('#examList')).toContain('Midterm');
    expect(text('#examList')).toContain('0 works · 2 terms');
    expect(store.getExams()[0]?.terms).toEqual([
      { term: 'Realism', def: 'art of everyday life', src: '' },
      { term: 'Sublime', def: '', src: '' },
    ]);
    expect(JSON.parse(localStorage.getItem('exams') ?? '[]')).toHaveLength(1);
  });

  it('saves a random-art pool exam', () => {
    click(act('home.new'));
    setValue('#exName', 'Pool');
    click('#useFilter');
    setValue('#exFrom', '1800');
    setValue('#exTo', '1900');
    setValue('#exQ', 'landscape');
    click(act('editor.save'));
    expect(store.getExams()[0]?.filter).toMatchObject({ from: '1800', to: '1900', q: 'landscape' });
    expect(text('#examList')).toContain('random pool');
  });

  it('cancel returns home without saving', () => {
    click(act('home.new'));
    setValue('#exName', 'Nope');
    click(act('editor.cancel'));
    expect(view()).toBe('home');
    expect(store.getExams()).toHaveLength(0);
  });

  it('searches the Met, adds and removes works (Enter key searches too)', async () => {
    stubFetch([
      ['/objects/5', { objectID: 5, title: 'Haystacks', artistDisplayName: 'Claude Monet', artistNationality: 'French', objectDate: '1891', primaryImageSmall: 'h.jpg', objectURL: 'https://met/5' }],
      ['/search', { objectIDs: [5] }],
      ['/departments', { departments: [] }],
    ]);
    click(act('home.new'));
    setValue('#searchQ', 'monet');
    $('#searchQ').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => text('#searchResults').includes('Haystacks'), 'search results');
    expect(text('#searchResults')).toContain('Claude Monet (French) · 1891');
    click(act('editor.addResult'));
    expect(text('#addedCount')).toBe('1');
    click(act('editor.addResult')); // adding the same work again is ignored
    expect(text('#addedCount')).toBe('1');
    click(act('editor.removeWork'));
    expect(text('#addedCount')).toBe('0');
  });

  it('imports a markdown file: terms get definitions, works get images and nationality', async () => {
    (window.api.readMd as jest.Mock).mockResolvedValue('# Imported Exam\n## Must Know Works\n- Gustave Courbet, The Stone Breakers, 1849 (p. 1)\n## Must Know Terms\n- Realism');
    stubFetch([
      ['rest_v1/page/summary', { extract: 'Realism was a movement. It began in France.' }],
      ['list=search', { query: { search: [{ title: 'Realism' }] } }],
      ['commons.wikimedia.org', { query: { pages: { a: { index: 1, title: 'File:Courbet.jpg', imageinfo: [{ thumburl: 'courbet.jpg', descriptionurl: 'https://commons/c' }] } } } }],
      [/search=Gustave\+Courbet&/, { search: [{ id: 'Q701', description: 'painter' }] }],
      [/ids=Q701\b/, { entities: { Q701: { claims: { P27: [{ mainsnak: { datavalue: { value: { id: 'Q801' } } } }] } } } }],
      [/ids=Q801\b/, { entities: { Q801: { claims: { P1549: [{ mainsnak: { datavalue: { value: { text: 'French', language: 'en' } } } }] }, labels: {} } } }],
      ['/departments', { departments: [] }],
    ]);
    click(act('home.new'));
    setValue('#mdPath', '~/exam.md');
    click(act('editor.importPath'));
    await waitFor(() => text('#editorMsg').startsWith('Imported'), 'import');

    expect(window.api.readMd).toHaveBeenCalledWith('~/exam.md');
    expect(($('#exName') as HTMLInputElement).value).toBe('Imported Exam');
    expect(($('#exTerms') as HTMLTextAreaElement).value).toBe('Realism: Realism was a movement. It began in France.');
    expect(text('#addedCount')).toBe('1');

    click(act('editor.save'));
    const saved = store.getExams()[0];
    expect(saved?.works[0]).toMatchObject({ artist: 'Gustave Courbet', nationality: 'French', img: 'courbet.jpg', src: 'https://commons/c' });
    expect(saved?.terms[0]?.src).toBe('https://en.wikipedia.org/wiki/Realism');
  });

  it('reports an unreadable file', async () => {
    (window.api.readMd as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    click(act('home.new'));
    setValue('#mdPath', '/nope.md');
    click(act('editor.importPath'));
    await waitFor(() => text('#editorMsg').startsWith('Cannot read file'), 'error message');
  });
});

describe('studying terms', () => {
  it('quiz: four choices, the definition hides its term, a correct pick is graded and scored once', async () => {
    seed({ works: [] });
    await study('terms', 'quiz');
    for (let round = 0; round < 6; round++) {
      const prompt = text('#card .prompt');
      expect(all('#choices button')).toHaveLength(4);
      const answer = termInPrompt(prompt);
      expect(answer).not.toBe('');
      expect(prompt).toContain('_____'); // the term itself is masked
      expect(prompt.toLowerCase()).not.toContain(answer.toLowerCase());
      const right = all('#choices button').find((b) => b.textContent === answer);
      if (!right) throw new Error(`no choice for ${answer}`);
      click(right);
      expect(right.classList.contains('right')).toBe(true);
      expect(text('#feedback')).toContain('Correct!');
      click(right); // answering twice does not count twice
      expect(text('#score')).toContain(`Session: ${round + 1} / ${round + 1}`);
      click(act('study.next'));
      await settle();
    }
  });

  it('quiz: a wrong pick is marked and shows the answer', async () => {
    seed({ works: [] });
    await study('terms', 'quiz');
    const prompt = text('#card .prompt');
    const answer = termInPrompt(prompt);
    const wrong = all('#choices button').find((b) => b.textContent !== answer);
    if (!wrong) throw new Error('no wrong choice');
    click(wrong);
    expect(wrong.classList.contains('wrong')).toBe(true);
    expect(all('#choices .right')).toHaveLength(1);
    expect(text('#feedback')).toMatch(/^Answer: /);
    expect(text('#feedback')).toContain('Source');
    expect(text('#score')).toContain('Session: 0 / 1');
  });

  it('flashcard: reveal the definition, then self-grade', async () => {
    seed({ works: [] });
    await study('terms', 'flash');
    expect(all('#choices')).toHaveLength(0);
    click(act('study.reveal'));
    expect(text('#answer')).toContain('was a movement');
    expect($('#selfgrade')).toBeTruthy();
    click(act('study.grade', 0)); // Got it
    expect(all('#selfgrade')).toHaveLength(0);
    expect(text('#score')).toContain('Session: 1 / 1 · All-time: 1 / 1 (100%)');
  });

  it('flashcard shows a placeholder for a term with no definition', async () => {
    seed({ works: [], terms: [{ term: 'Sublime', def: '' }] });
    await study('terms', 'flash');
    click(act('study.reveal'));
    expect(text('#answer')).toContain('no definition');
  });

  it('quiz mode with no defined terms explains why there is no question', async () => {
    seed({ works: [], terms: [{ term: 'Sublime', def: '' }] });
    await study('terms', 'quiz');
    expect(text('#card')).toContain('No terms with definitions for quiz mode.');
  });
});

describe('studying works', () => {
  const answerFor = (): Work => {
    const src = $('#card img').getAttribute('src');
    const w = works.find((x) => x.img === src);
    if (!w) throw new Error(`unknown image ${src}`);
    return w;
  };

  it('quiz: pick the artist; the answer shows nationality, title, date and a source link', async () => {
    seed({ terms: [] });
    await study('works', 'quiz');
    const answer = answerFor();
    expect(all('#choices button')).toHaveLength(4);
    click(all('#choices button').find((b) => b.textContent === answer.artist) ?? $('#choices button'));
    expect(text('#feedback')).toContain(`Correct! ${answer.artist} (${answer.nationality ?? ''}) — ${answer.title}, ${answer.date}`);
    expect(text('#score')).toContain('Session: 1 / 1');
    if (answer.src) expect($('#feedback a.source').getAttribute('href')).toBe(answer.src);
  });

  it('flashcard: the revealed answer includes nationality', async () => {
    seed({ terms: [] });
    await study('works', 'flash');
    const answer = answerFor();
    click(act('study.reveal'));
    expect(text('#answer')).toContain(`${answer.artist} (${answer.nationality ?? ''})`);
    click(act('study.grade', 1)); // Missed
    expect(text('#score')).toContain('Session: 0 / 1');
  });

  it('a work without an image is shown by title', async () => {
    seed({ terms: [], works: [{ id: 9, title: 'Lost Painting', artist: 'Unknown Hand', nationality: '', date: '1700', img: '' }] });
    await study('works', 'flash');
    expect(text('#card')).toContain('Lost Painting');
    expect(text('#card')).toContain('(no image)');
  });

  it('looks up a missing nationality once and saves it (exams made before nationality existed)', async () => {
    seed({ terms: [], works: [{ id: 7, title: 'Olympia', artist: 'Legacy Painter', date: '1863', img: 'x.png' }] });
    stubFetch([
      [/search=Legacy\+Painter&/, { search: [{ id: 'Q711', description: 'painter' }] }],
      [/ids=Q711\b/, { entities: { Q711: { claims: { P27: [{ mainsnak: { datavalue: { value: { id: 'Q811' } } } }] } } } }],
      [/ids=Q811\b/, { entities: { Q811: { claims: { P1549: [{ mainsnak: { datavalue: { value: { text: 'Legacyan', language: 'en' } } } }] }, labels: {} } } }],
    ]);
    click(act('home.study'));
    await waitFor(() => all('[data-action="study.reveal"]').length > 0, 'card');
    click(act('study.reveal'));
    expect(text('#answer')).toContain('Legacy Painter (Legacyan)');
    expect(store.getExams()[0]?.works[0]?.nationality).toBe('Legacyan');
    expect((JSON.parse(localStorage.getItem('exams') ?? '[]') as Exam[])[0]?.works[0]?.nationality).toBe('Legacyan');
  });
});

describe('studying other sources', () => {
  it('lists the sources an exam supports', async () => {
    seed({ filter: { deptId: '', from: '', to: '', q: '' } });
    click(act('home.study'));
    await settle();
    expect(all('#source option').map((o) => o.getAttribute('value'))).toEqual(['mix', 'works', 'terms', 'pool']);
  });

  it('mixed mode draws both works and terms', async () => {
    seed();
    await study('mix', 'flash');
    const seen = new Set<string>();
    for (let i = 0; i < 40 && seen.size < 2; i++) {
      seen.add(all('#card img').length ? 'works' : 'terms');
      click(act('study.next'));
      await settle();
    }
    expect([...seen].sort()).toEqual(['terms', 'works']);
  });

  it('random art pool draws from the Met', async () => {
    seed({ works: [], terms: [], filter: { deptId: '', from: '', to: '', q: 'ui-pool-test' } });
    stubFetch([
      ['/objects/3', { objectID: 3, title: 'Pool Landscape', artistDisplayName: 'Pool Painter', artistNationality: 'Dutch', primaryImageSmall: 'pool.jpg', objectDate: '1650', objectURL: 'https://met/3' }],
      ['/search', { objectIDs: [3] }],
    ]);
    click(act('home.study'));
    await waitFor(() => all('[data-action="study.reveal"]').length > 0, 'pool card');
    click(act('study.reveal'));
    expect(text('#answer')).toContain('Pool Painter (Dutch)');
  });

  it('shows an error card when the pool cannot be reached', async () => {
    seed({ works: [], terms: [], filter: { deptId: '', from: '', to: '', q: 'ui-pool-offline' } });
    stubFetch([['/search', new Error('down')]]);
    click(act('home.study'));
    await waitFor(() => text('#card').includes('No artwork found'), 'error card');
  });
});

describe('navigation and scoring', () => {
  it('back returns home and the exam list shows the new score', async () => {
    seed({ works: [] });
    await study('terms', 'quiz');
    const answer = termInPrompt(text('#card .prompt'));
    click(all('#choices button').find((b) => b.textContent === answer) ?? $('#choices button'));
    click(act('study.back'));
    expect(view()).toBe('home');
    expect(text('#examList')).toContain('100% (1/1)');
  });

  it('scores persist in localStorage', async () => {
    seed({ works: [] });
    await study('terms', 'flash');
    click(act('study.reveal'));
    click(act('study.grade', 0));
    const saved = JSON.parse(localStorage.getItem('exams') ?? '[]') as Exam[];
    expect(saved[0]?.stats).toEqual({ terms: { c: 1, t: 1 } });
  });
});
