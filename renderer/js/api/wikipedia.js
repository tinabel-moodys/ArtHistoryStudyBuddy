// Wikipedia lookups for term definitions.
import { getJson } from './http.js';

const API = 'https://en.wikipedia.org/w/api.php';
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

/** First two sentences of the best-matching article, plus its URL. Empty strings on failure. */
export async function define(term) {
  try {
    const query = term.replace(/,\s*\d{3,4}.*$/, '');
    const search = await getJson(API, {
      action: 'query', list: 'search', srsearch: `${query} art history`,
      srlimit: '1', format: 'json', origin: '*',
    });
    const title = search.query.search[0].title;
    const page = await getJson(SUMMARY + encodeURIComponent(title));
    const sentences = (page.extract || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [];
    return {
      def: sentences.slice(0, 2).join('').trim().slice(0, 320),
      src: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    };
  } catch {
    return { def: '', src: '' };
  }
}
