import { findWorkImage } from '../src/renderer/js/services/imageFinder.js';
import { importExam } from '../src/renderer/js/services/importer.js';
import { lookupNationality } from '../src/renderer/js/services/nationality.js';
import { restoreFetch, stubFetch } from './helpers/fakeFetch.js';

afterEach(restoreFetch);

type Routes = Parameters<typeof stubFetch>[0];

const commonsHit = (title = 'File:Odalisque Ingres.jpg'): Routes[number] => ['commons.wikimedia.org', {
  query: { pages: { a: { index: 1, title, imageinfo: [{ thumburl: 'thumb.jpg', descriptionurl: 'https://commons/desc' }] } } },
}];

/** Wikidata routes for one artist: name -> person id -> country id -> demonym "Testish". */
const artist = (nameInSearch: string, personId: string, countryId: string): Routes => [
  [new RegExp(`search=${nameInSearch}&`), { search: [{ id: personId, description: 'painter' }] }],
  [new RegExp(`ids=${personId}\\b`), { entities: { [personId]: { claims: { P27: [{ mainsnak: { datavalue: { value: { id: countryId } } } }] } } } }],
  [new RegExp(`ids=${countryId}\\b`), { entities: { [countryId]: { claims: { P1549: [{ mainsnak: { datavalue: { value: { text: 'Testish', language: 'en' } } } }] }, labels: {} } } }],
];

describe('findWorkImage', () => {
  it('uses Commons first', async () => {
    stubFetch([commonsHit()]);
    expect(await findWorkImage({ artist: 'J.A.D. Ingres', title: 'Large Odalisque' })).toEqual({ img: 'thumb.jpg', src: 'https://commons/desc' });
  });

  it('queries with the title (parentheticals removed) and the artist surname', async () => {
    const calls = stubFetch([commonsHit()]);
    await findWorkImage({ artist: 'J.M.W. Turner', title: 'The Slave Ship (Slavers Throwing Overboard)' });
    expect(decodeURIComponent(calls[0] ?? '').replace(/\+/g, ' ')).toContain('gsrsearch=The Slave Ship turner');
  });

  it('falls back to the Met, matching on the artist', async () => {
    stubFetch([
      ['commons.wikimedia.org', { batchcomplete: '' }],
      ['/objects/1', { objectID: 1, title: 'Olympia', artistDisplayName: 'Edouard Manet', primaryImageSmall: 'met.jpg', objectURL: 'https://met/1' }],
      ['/search', { objectIDs: [1] }],
    ]);
    expect(await findWorkImage({ artist: 'Edouard Manet', title: 'Olympia' })).toEqual({ img: 'met.jpg', src: 'https://met/1' });
  });

  it('returns empty strings when nothing is found', async () => {
    stubFetch([['commons.wikimedia.org', { batchcomplete: '' }], ['/search', { objectIDs: [] }]]);
    expect(await findWorkImage({ artist: 'Nobody', title: 'Nothing' })).toEqual({ img: '', src: '' });
  });
});

describe('lookupNationality', () => {
  // Distinct artist names per test: lookups are cached for the session.
  it('resolves a name and caches the result', async () => {
    const calls = stubFetch(artist('Cache\\+Tester', 'Q501', 'Q601'));
    expect(await lookupNationality('Cache Tester')).toBe('Testish');
    const afterFirst = calls.length;
    expect(await lookupNationality('Cache Tester')).toBe('Testish');
    expect(calls).toHaveLength(afterFirst);
  });

  it('retries with the surname when the name has initials', async () => {
    stubFetch([['search=A.B.+Initialed', { search: [] }], ...artist('Initialed', 'Q502', 'Q602')]);
    expect(await lookupNationality('A.B. Initialed')).toBe('Testish');
  });

  it('does not retry plain names, and handles empty input', async () => {
    const calls = stubFetch([['wbsearchentities', { search: [] }]]);
    expect(await lookupNationality('Plain Person')).toBe('');
    expect(calls.filter((c) => c.includes('wbsearchentities'))).toHaveLength(1);
    expect(await lookupNationality('')).toBe('');
  });
});

describe('importExam', () => {
  it('assembles terms and works from markdown', async () => {
    stubFetch([
      ['rest_v1/page/summary', { extract: 'Auto definition. More text.' }],
      ['list=search', { query: { search: [{ title: 'Realism' }] } }],
      commonsHit('File:Courbet Stone Breakers.jpg'),
      ...artist('Gustave\\+Courbet', 'Q503', 'Q603'),
    ]);
    const md = [
      '# Course Exam', '## Must Know Works', '- Gustave Courbet, The Stone Breakers, 1849 (p. 1012)',
      '## Must Know Terms', '- Realism', '- Sublime: given definition',
    ].join('\n');
    const messages: string[] = [];
    const result = await importExam(md, (m) => messages.push(m));

    expect(result.title).toBe('Course Exam');
    expect(result.terms).toEqual([
      { term: 'Realism', def: 'Auto definition. More text.', src: 'https://en.wikipedia.org/wiki/Realism' },
      { term: 'Sublime', def: 'given definition', src: '' },
    ]);
    expect(result.works).toEqual([{
      id: 'md-Gustave Courbet|The Stone Breakers', title: 'The Stone Breakers', artist: 'Gustave Courbet',
      nationality: 'Testish', date: '1849', img: 'thumb.jpg', src: 'https://commons/desc',
    }]);
    expect(result.noImage).toEqual([]);
    expect(messages.some((m) => m.includes('Defining term 1/2'))).toBe(true);
    expect(messages.some((m) => m.includes('Looking up work 1/1'))).toBe(true);
  });

  it('keeps works it cannot find an image for, and reports them', async () => {
    stubFetch([['commons.wikimedia.org', { batchcomplete: '' }], ['/search', { objectIDs: [] }], ['wbsearchentities', { search: [] }]]);
    const result = await importExam('## Must Know Works\n- Unknown Painter, Lost Painting, 1700');
    expect(result.works).toHaveLength(1);
    expect(result.works[0]).toMatchObject({ img: '', nationality: '' });
    expect(result.noImage).toEqual(['Lost Painting']);
  });

  it('returns empty content for an empty file', async () => {
    stubFetch([]);
    expect(await importExam('')).toEqual({ title: '', terms: [], works: [], noImage: [] });
  });
});
