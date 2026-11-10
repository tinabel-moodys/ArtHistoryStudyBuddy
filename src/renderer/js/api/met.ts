// Met Museum Open Access API client. Returns plain data, never touches the DOM.
import type { Work } from '../types.js';
import { getJson } from './http.js';

const BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

export interface MetObject {
  objectID: number;
  title: string;
  artistDisplayName: string;
  artistNationality?: string;
  objectDate: string;
  primaryImageSmall: string;
  objectURL: string;
}

export interface Department {
  departmentId: number;
  displayName: string;
}

export async function listDepartments(): Promise<Department[]> {
  return (await getJson<{ departments: Department[] }>(`${BASE}/departments`)).departments;
}

/** Object IDs matching params (always restricted to objects with images). */
export async function searchIds(params: Record<string, string>): Promise<number[]> {
  const result = await getJson<{ objectIDs?: number[] | null }>(`${BASE}/search`, { hasImages: 'true', ...params });
  return result.objectIDs ?? [];
}

export async function getObject(id: number): Promise<MetObject | null> {
  try {
    return await getJson<MetObject>(`${BASE}/objects/${id}`);
  } catch {
    return null;
  }
}

/** Met object -> app "work" shape. */
export const toWork = (o: MetObject): Work => ({
  id: o.objectID,
  title: o.title,
  artist: o.artistDisplayName,
  nationality: o.artistNationality ?? '',
  date: o.objectDate,
  img: o.primaryImageSmall,
  src: o.objectURL,
});

/** Free-text search; returns up to `limit` works that have an image. */
export async function searchWorks(query: string, limit = 10): Promise<Work[]> {
  const ids = (await searchIds({ q: query })).slice(0, limit);
  const objects = await Promise.all(ids.map(getObject));
  return objects.filter((o): o is MetObject => o?.primaryImageSmall !== undefined && o.primaryImageSmall !== '').map(toWork);
}

/** First result for `title` whose artist name contains `surname`, or null. */
export async function findWork(title: string, surname: string, tries = 5): Promise<Work | null> {
  try {
    for (const id of (await searchIds({ q: title })).slice(0, tries)) {
      const o = await getObject(id);
      if (o?.primaryImageSmall && surname && o.artistDisplayName.toLowerCase().includes(surname)) {
        return toWork(o);
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}
