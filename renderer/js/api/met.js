// Met Museum Open Access API client. Returns plain data, never touches the DOM.
import { getJson } from './http.js';

const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

export async function listDepartments() {
  return (await getJson(`${BASE}/departments`)).departments;
}

/** Object IDs matching params (always restricted to objects with images). */
export async function searchIds(params) {
  return (await getJson(`${BASE}/search`, { hasImages: 'true', ...params })).objectIDs || [];
}

export async function getObject(id) {
  try { return await getJson(`${BASE}/objects/${id}`); } catch { return null; }
}

/** Met object -> app "work" shape. */
export const toWork = o => ({
  id: o.objectID,
  title: o.title,
  artist: o.artistDisplayName,
  nationality: o.artistNationality || '',
  date: o.objectDate,
  img: o.primaryImageSmall,
  src: o.objectURL,
});

/** Free-text search; returns up to `limit` works that have an image. */
export async function searchWorks(query, limit = 10) {
  const ids = (await searchIds({ q: query })).slice(0, limit);
  const objects = await Promise.all(ids.map(getObject));
  return objects.filter(o => o && o.primaryImageSmall).map(toWork);
}

/** First result for `title` whose artist name contains `surname`, or null. */
export async function findWork(title, surname, tries = 5) {
  try {
    for (const id of (await searchIds({ q: title })).slice(0, tries)) {
      const o = await getObject(id);
      if (o && o.primaryImageSmall && surname && (o.artistDisplayName || '').toLowerCase().includes(surname)) {
        return toWork(o);
      }
    }
  } catch { /* fall through */ }
  return null;
}
