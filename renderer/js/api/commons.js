// Wikimedia Commons image search.
import { getJson } from './http.js';

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

/**
 * Best-matching JPEG/PNG for `query`, preferring files whose name contains `surname`.
 * Returns { img, src } or null.
 */
export async function findImage(query, surname) {
  try {
    const r = await getJson(ENDPOINT, {
      action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '8',
      gsrsearch: query, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '600',
      format: 'json', origin: '*',
    });
    const pages = Object.values((r.query && r.query.pages) || {})
      .sort((a, b) => a.index - b.index)
      .filter(p => /\.(jpe?g|png)$/i.test(p.title) && p.imageinfo && p.imageinfo[0].thumburl);
    const best = pages.find(p => surname && p.title.toLowerCase().includes(surname)) || pages[0];
    if (best) return { img: best.imageinfo[0].thumburl, src: best.imageinfo[0].descriptionurl || '' };
  } catch { /* fall through */ }
  return null;
}
