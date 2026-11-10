// The store reads localStorage at import time, so each test installs a fake and imports a fresh copy.

type Store = typeof import('../src/renderer/js/store.js');

function installStorage(initial?: string): Map<string, string> {
  const data = new Map<string, string>(initial === undefined ? [] : [['exams', initial]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    },
  });
  return data;
}

async function freshStore(): Promise<Store> {
  jest.resetModules();
  return import('../src/renderer/js/store.js');
}

beforeEach(() => { installStorage(); });

describe('loading', () => {
  it('starts empty without saved data', async () => {
    expect((await freshStore()).getExams()).toEqual([]);
  });

  it('survives corrupt saved data', async () => {
    installStorage('{not json');
    expect((await freshStore()).getExams()).toEqual([]);
  });

  it('migrates the old "list" and "filter" exam formats', async () => {
    installStorage(JSON.stringify([
      { name: 'L', type: 'list', items: [{ id: 1, title: 'T' }] },
      { name: 'F', type: 'filter', deptId: '11', deptName: 'Paintings', from: '1400', to: '1600', q: 'portrait' },
    ]));
    const [list, filter] = (await freshStore()).getExams();
    expect(list).toEqual({ name: 'L', works: [{ id: 1, title: 'T' }], terms: [], filter: null, stats: {} });
    expect(filter?.filter).toEqual({ deptId: '11', deptName: 'Paintings', from: '1400', to: '1600', q: 'portrait' });
    expect(filter?.works).toEqual([]);
  });

  it('adds default stats to current-format exams that lack them', async () => {
    installStorage(JSON.stringify([{ name: 'X', works: [], terms: [], filter: null }]));
    expect((await freshStore()).getExams()[0]?.stats).toEqual({});
  });
});

describe('saving', () => {
  it('addExam persists to localStorage', async () => {
    const data = installStorage();
    const store = await freshStore();
    store.addExam(store.makeExam({ name: 'Midterm', terms: [{ term: 'a', def: 'b', src: '' }] }));
    const saved = JSON.parse(data.get('exams') ?? '[]') as { name: string; works: unknown[] }[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('Midterm');
    expect(saved[0]?.works).toEqual([]);
  });

  it('removeExam deletes by index and persists', async () => {
    const data = installStorage();
    const store = await freshStore();
    store.addExam(store.makeExam({ name: 'A' }));
    store.addExam(store.makeExam({ name: 'B' }));
    store.removeExam(0);
    expect(store.getExams().map((e) => e.name)).toEqual(['B']);
    expect((JSON.parse(data.get('exams') ?? '[]') as { name: string }[]).map((e) => e.name)).toEqual(['B']);
  });

  it('saveExams persists in-place edits', async () => {
    const data = installStorage();
    const store = await freshStore();
    const exam = store.makeExam({ name: 'A', works: [{ id: 1, title: 'T', artist: 'X', date: '', img: '' }] });
    store.addExam(exam);
    exam.works[0]!.nationality = 'French';
    store.saveExams();
    expect((JSON.parse(data.get('exams') ?? '[]') as { works: { nationality: string }[] }[])[0]?.works[0]?.nationality).toBe('French');
  });
});

describe('scores', () => {
  it('recordResult, kindStats and overallStats', async () => {
    const store = await freshStore();
    const exam = store.makeExam({ name: 'E' });
    store.addExam(exam);
    store.recordResult(exam, 'works', true);
    store.recordResult(exam, 'works', false);
    store.recordResult(exam, 'terms', true);
    expect(store.kindStats(exam, 'works')).toEqual({ c: 1, t: 2 });
    expect(store.kindStats(exam, 'terms')).toEqual({ c: 1, t: 1 });
    expect(store.kindStats(exam, 'pool')).toBeUndefined();
    expect(store.overallStats(exam)).toEqual({ c: 2, t: 3 });
  });

  it('survives a reload', async () => {
    const data = installStorage();
    const store = await freshStore();
    const exam = store.makeExam({ name: 'E' });
    store.addExam(exam);
    store.recordResult(exam, 'terms', true);
    installStorage(data.get('exams'));
    expect((await freshStore()).getExams()[0]?.stats).toEqual({ terms: { c: 1, t: 1 } });
  });

  it('resetStats clears one exam only', async () => {
    const store = await freshStore();
    const a = store.makeExam({ name: 'A' });
    const b = store.makeExam({ name: 'B' });
    store.addExam(a);
    store.addExam(b);
    store.recordResult(a, 'works', true);
    store.recordResult(b, 'works', true);
    store.resetStats(0);
    expect(store.overallStats(a)).toEqual({ c: 0, t: 0 });
    expect(store.overallStats(b)).toEqual({ c: 1, t: 1 });
  });
});
