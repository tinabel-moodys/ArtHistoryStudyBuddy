import { drawCard, isCardError, resolveKind, studySources } from '../src/renderer/js/quiz.js';
import type { Card, Exam, Mode, Kind, Term, Work } from '../src/renderer/js/types.js';
import { restoreFetch, stubFetch } from './helpers/fakeFetch.js';

afterEach(restoreFetch);

const term = (t: string, def = `${t} is a thing.`): Term => ({ term: t, def, src: 'https://example.org' });
const work = (artist: string, title = `${artist} work`): Work =>
  ({ id: title, title, artist, nationality: 'French', date: '1800', img: 'i.png', src: 's' });
const exam = (over: Partial<Exam> = {}): Exam => ({ name: 'E', works: [], terms: [], filter: null, stats: {}, ...over });
const FIVE_TERMS = ['Realism', 'Sublime', 'Japonisme', 'Primitivism', 'Orientalism'].map((t) => term(t));

/** drawCard, failing the test if it returned an error. */
async function draw(e: Exam, kind: Kind, mode: Mode): Promise<Card> {
  const card = await drawCard(e, kind, mode);
  if (isCardError(card)) throw new Error(card.error);
  return card;
}

describe('studySources', () => {
  it('lists only what the exam has', () => {
    expect(studySources(exam())).toEqual([]);
    expect(studySources(exam({ works: [work('A')] })).map((s) => s.value)).toEqual(['works']);
    expect(studySources(exam({ terms: [term('A')] })).map((s) => s.value)).toEqual(['terms']);
    expect(studySources(exam({ works: [work('A')], terms: [term('B')], filter: { deptId: '', from: '', to: '', q: '' } })).map((s) => s.value))
      .toEqual(['mix', 'works', 'terms', 'pool']);
  });
});

describe('resolveKind', () => {
  it('passes plain sources through and splits "mix" between works and terms', () => {
    expect(resolveKind('works')).toBe('works');
    expect(resolveKind('pool')).toBe('pool');
    const kinds = new Set(Array.from({ length: 80 }, () => resolveKind('mix')));
    expect([...kinds].sort()).toEqual(['terms', 'works']);
  });
});

describe('term cards', () => {
  it('flashcard: no choices, definition shown as written', async () => {
    const card = await draw(exam({ terms: [term('Realism', 'Realism was a movement.')] }), 'terms', 'flash');
    expect(card.choices).toBeNull();
    expect(card).toMatchObject({ def: 'Realism was a movement.', answer: 'Realism' });
  });

  it('quiz: four distinct choices including the answer, and the definition hides the term', async () => {
    const e = exam({ terms: FIVE_TERMS.map((t) => ({ ...t, def: `${t.term} was a movement in art.` })) });
    for (let i = 0; i < 25; i++) {
      const card = await draw(e, 'terms', 'quiz');
      if (card.kind !== 'terms') throw new Error('expected a term card');
      expect(card.choices).toHaveLength(4);
      expect(new Set(card.choices).size).toBe(4);
      expect(card.choices).toContain(card.answer);
      expect(card.def.toLowerCase()).not.toContain(card.answer.toLowerCase());
    }
  });

  it('quiz with few terms offers as many choices as exist', async () => {
    expect((await draw(exam({ terms: [term('A'), term('B')] }), 'terms', 'quiz')).choices).toHaveLength(2);
  });

  it('quiz skips terms without a definition, and errors if none have one', async () => {
    const mixed = exam({ terms: [term('NoDef', ''), term('HasDef', 'HasDef means x.')] });
    for (let i = 0; i < 20; i++) expect((await draw(mixed, 'terms', 'quiz')).answer).toBe('HasDef');
    const none = await drawCard(exam({ terms: [term('A', '')] }), 'terms', 'quiz');
    expect(isCardError(none) && none.error).toMatch(/definitions/);
  });

  it('flashcards still include terms without a definition', async () => {
    expect((await draw(exam({ terms: [term('NoDef', '')] }), 'terms', 'flash')).answer).toBe('NoDef');
  });
});

describe('work cards', () => {
  it('quiz: artist choices include the answer and are distinct (case-insensitive)', async () => {
    const e = exam({ works: [work('Édouard Manet'), work('Claude Monet'), work('claude monet', 'dup')] });
    for (let i = 0; i < 25; i++) {
      const card = await draw(e, 'works', 'quiz');
      expect(card.choices).toHaveLength(4);
      expect(card.choices).toContain(card.answer);
      const lower = (card.choices ?? []).map((c) => c.toLowerCase());
      expect(new Set(lower).size).toBe(lower.length);
    }
  });

  it('carries everything the UI shows', async () => {
    const card = await draw(exam({ works: [work('Goya', 'Third of May')] }), 'works', 'flash');
    expect(card).toMatchObject({
      kind: 'works', title: 'Third of May', artist: 'Goya', nationality: 'French', date: '1800', img: 'i.png', src: 's', choices: null,
    });
  });

  it('a work with no artist cannot be a multiple-choice question', async () => {
    const card = await draw(exam({ works: [{ id: 1, title: 'Mona Lisa', artist: '', date: '', img: '', src: '' }] }), 'works', 'quiz');
    expect(card.choices).toBeNull();
  });
});

describe('random pool cards', () => {
  const pool = (q: string): Exam => exam({ filter: { deptId: '11', from: '1600', to: '1700', q } });

  it('come from the Met search', async () => {
    const calls = stubFetch([
      ['/objects/7', { objectID: 7, title: 'Pool Piece', artistDisplayName: 'Someone', artistNationality: 'Dutch', primaryImageSmall: 'p.jpg', objectDate: '1650', objectURL: 'https://met/7' }],
      ['/search', { objectIDs: [7] }],
    ]);
    const card = await draw(pool('pool-test-a'), 'pool', 'quiz');
    expect(card).toMatchObject({ title: 'Pool Piece', nationality: 'Dutch' });
    expect(card.choices).toHaveLength(4);
    const search = calls.find((c) => c.includes('/search')) ?? '';
    for (const part of ['hasImages=true', 'departmentId=11', 'dateBegin=1600', 'dateEnd=1700', 'q=pool-test-a']) {
      expect(search).toContain(part);
    }
  });

  it('give an error card when there are no results, or when offline', async () => {
    stubFetch([['/search', { objectIDs: [] }]]);
    const none = await drawCard(pool('pool-test-b'), 'pool', 'flash');
    expect(isCardError(none) && none.error).toMatch(/No artwork/);
    stubFetch([['/search', new Error('down')]]);
    const offline = await drawCard(pool('pool-test-c'), 'pool', 'flash');
    expect(isCardError(offline) && offline.error).toMatch(/No artwork/);
  });

  it('only use objects that have an image and an artist', async () => {
    stubFetch([
      ['/objects/1', { objectID: 1, title: 'No image', artistDisplayName: 'A', primaryImageSmall: '' }],
      ['/objects/2', { objectID: 2, title: 'No artist', artistDisplayName: '', primaryImageSmall: 'x' }],
      ['/search', { objectIDs: [1, 2] }],
    ]);
    const card = await drawCard(pool('pool-test-d'), 'pool', 'flash');
    expect(isCardError(card)).toBe(true);
  });
});
