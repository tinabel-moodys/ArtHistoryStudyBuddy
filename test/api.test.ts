import { findImage } from '../src/renderer/js/api/commons.js';
import { getJson } from '../src/renderer/js/api/http.js';
import * as met from '../src/renderer/js/api/met.js';
import { nationalityOf } from '../src/renderer/js/api/wikidata.js';
import { define } from '../src/renderer/js/api/wikipedia.js';
import { restoreFetch, stubFetch } from './helpers/fakeFetch.js';

afterEach(restoreFetch);

describe('getJson', () => {
  it('appends query params and parses JSON', async () => {
    const calls = stubFetch([['example.org', { ok: 1 }]]);
    expect(await getJson('https://example.org/api', { a: '1', b: 'x y' })).toEqual({ ok: 1 });
    expect(calls[0]).toBe('https://example.org/api?a=1&b=x+y');
  });

  it('throws on HTTP errors', async () => {
    stubFetch([['example.org', new Error('x')]]);
    await expect(getJson('https://example.org/api')).rejects.toThrow(/HTTP 500/);
  });
});

describe('Met API', () => {
  const metObject = (id: number, over: Partial<met.MetObject> = {}): met.MetObject => ({
    objectID: id, title: `T${id}`, artistDisplayName: 'Artist', artistNationality: 'French',
    objectDate: '1800', primaryImageSmall: `img${id}.jpg`, objectURL: `https://met/${id}`, ...over,
  });

  it('toWork maps a Met object to the app shape', () => {
    expect(met.toWork(metObject(5))).toEqual({
      id: 5, title: 'T5', artist: 'Artist', nationality: 'French', date: '1800', img: 'img5.jpg', src: 'https://met/5',
    });
    expect(met.toWork(metObject(6, { artistNationality: undefined })).nationality).toBe('');
  });

  it('searchWorks restricts to images and drops results without one', async () => {
    const calls = stubFetch([
      ['/objects/1', metObject(1)],
      ['/objects/2', metObject(2, { primaryImageSmall: '' })],
      ['/objects/3', new Error('gone')],
      ['/search', { objectIDs: [1, 2, 3] }],
    ]);
    expect((await met.searchWorks('portrait')).map((w) => w.id)).toEqual([1]);
    expect(calls[0]).toContain('hasImages=true');
    expect(calls[0]).toContain('q=portrait');
  });

  it('searchIds returns [] when the API has no objectIDs', async () => {
    stubFetch([['/search', { total: 0, objectIDs: null }]]);
    expect(await met.searchIds({ q: 'zzz' })).toEqual([]);
  });

  it('findWork requires the artist surname to match', async () => {
    stubFetch([
      ['/objects/1', metObject(1, { artistDisplayName: 'Someone Else' })],
      ['/objects/2', metObject(2, { artistDisplayName: 'Edouard Manet' })],
      ['/search', { objectIDs: [1, 2] }],
    ]);
    expect((await met.findWork('Olympia', 'manet'))?.id).toBe(2);
    expect(await met.findWork('Olympia', 'degas')).toBeNull();
  });

  it('listDepartments returns the department list', async () => {
    stubFetch([['/departments', { departments: [{ departmentId: 11, displayName: 'European Paintings' }] }]]);
    expect(await met.listDepartments()).toEqual([{ departmentId: 11, displayName: 'European Paintings' }]);
  });
});

describe('Wikimedia Commons', () => {
  const page = (index: number, title: string, withInfo = true): unknown => ({
    index, title, imageinfo: withInfo ? [{ thumburl: `thumb-${index}`, descriptionurl: `desc-${index}` }] : undefined,
  });

  it('prefers a file whose name contains the surname', async () => {
    stubFetch([['commons.wikimedia.org', { query: { pages: { a: page(1, 'File:Other.jpg'), b: page(2, 'File:Ingres Odalisque.jpg') } } }]]);
    expect(await findImage('Odalisque ingres', 'ingres')).toEqual({ img: 'thumb-2', src: 'desc-2' });
  });

  it('falls back to the top result, and skips non-photo files', async () => {
    stubFetch([['commons.wikimedia.org', { query: { pages: {
      a: page(1, 'File:Diagram.svg'), b: page(2, 'File:First.jpeg'), c: page(3, 'File:Second.png'), d: page(4, 'File:NoInfo.jpg', false),
    } } }]]);
    expect(await findImage('x', '')).toEqual({ img: 'thumb-2', src: 'desc-2' });
  });

  it('returns null on no results or errors', async () => {
    stubFetch([['commons.wikimedia.org', { batchcomplete: '' }]]);
    expect(await findImage('x', 'y')).toBeNull();
    stubFetch([['commons.wikimedia.org', new Error('x')]]);
    expect(await findImage('x', 'y')).toBeNull();
  });
});

describe('Wikipedia', () => {
  it('define returns the first two sentences and the article URL', async () => {
    const calls = stubFetch([
      ['rest_v1/page/summary', { extract: 'One fact. Two facts! Three facts.' }],
      ['list=search', { query: { search: [{ title: 'Salon des Refusés' }] } }],
    ]);
    expect(await define('Salon De Refuses, 1863')).toEqual({
      def: 'One fact. Two facts!',
      src: 'https://en.wikipedia.org/wiki/Salon_des_Refus%C3%A9s',
    });
    expect(calls[0]).toContain('srsearch=Salon+De+Refuses+art+history'); // trailing ", 1863" removed
  });

  it('caps very long definitions', async () => {
    stubFetch([
      ['rest_v1/page/summary', { extract: `${'x'.repeat(600)}.` }],
      ['list=search', { query: { search: [{ title: 'T' }] } }],
    ]);
    expect((await define('T')).def).toHaveLength(320);
  });

  it('returns empty strings when nothing is found or the request fails', async () => {
    stubFetch([['list=search', { query: { search: [] } }]]);
    expect(await define('zzz')).toEqual({ def: '', src: '' });
    stubFetch([['list=search', new Error('x')]]);
    expect(await define('zzz')).toEqual({ def: '', src: '' });
  });
});

describe('Wikidata', () => {
  // Each test uses its own country id: demonyms are cached per country for the session.
  function wikidata(opts: { description?: string; person?: string; country?: string; countryClaims?: object; labels?: object }): Parameters<typeof stubFetch>[0] {
    const { description = 'French painter (1819–1877)', person = 'Q2', country, countryClaims = {}, labels = {} } = opts;
    const citizenship = country ? { P27: [{ mainsnak: { datavalue: { value: { id: country } } } }] } : {};
    return [
      ['wbsearchentities', { search: [{ id: 'Q1', description: 'exhibition' }, { id: person, description }] }],
      [new RegExp(`ids=${person}\\b`), { entities: { [person]: { claims: citizenship } } }],
      [new RegExp(`ids=${country ?? 'none'}\\b`), { entities: { [country ?? 'none']: { claims: countryClaims, labels } } }],
    ];
  }
  const demonym = (text: string, language = 'en'): object => ({ mainsnak: { datavalue: { value: { text, language } } } });

  it('returns the English demonym of the country of citizenship', async () => {
    stubFetch(wikidata({ country: 'Q1001', countryClaims: { P1549: [demonym('француз', 'ru'), demonym('French')] }, labels: { en: { value: 'France' } } }));
    expect(await nationalityOf('Gustave Courbet')).toBe('French');
  });

  it('picks the artist, not an exhibition with the same name', async () => {
    const calls = stubFetch(wikidata({ person: 'Q22', country: 'Q1002', countryClaims: { P1549: [demonym('Spanish')] } }));
    await nationalityOf('Goya');
    expect(calls.some((c) => /ids=Q22\b/.test(c))).toBe(true);
    expect(calls.some((c) => /ids=Q1\b/.test(c))).toBe(false);
  });

  it('falls back to the country name when there is no demonym', async () => {
    stubFetch(wikidata({ country: 'Q1003', labels: { en: { value: 'Kingdom of Prussia' } } }));
    expect(await nationalityOf('Someone')).toBe('Kingdom of Prussia');
  });

  it('returns "" for non-artists and for artists without citizenship', async () => {
    stubFetch([['wbsearchentities', { search: [{ id: 'Q9', description: 'racehorse' }] }]]);
    expect(await nationalityOf('Auguste Rodin')).toBe('');
    stubFetch(wikidata({ person: 'Q23' }));
    expect(await nationalityOf('Nobody')).toBe('');
  });

  it('retries a failed request once, then gives up quietly', async () => {
    let attempts = 0;
    stubFetch([['wbsearchentities', () => (++attempts === 1 ? new Error('burst') : { search: [] })]]);
    expect(await nationalityOf('Retry Me')).toBe('');
    expect(attempts).toBe(2);

    stubFetch([['wbsearchentities', new Error('down')]]);
    expect(await nationalityOf('Always Down')).toBe('');
  });
});
