// Random artwork from the Met matching an exam's filter (department / years / keyword).
import * as met from '../api/met.js';
import type { Filter, Work } from '../types.js';
import { pick } from '../util.js';

const idCache = new Map<string, number[]>(); // search params -> object IDs
const MAX_TRIES = 8;

/** A work with an image and an artist, or null if none could be found. */
export async function pickRandomWork(filter: Filter): Promise<Work | null> {
  const params: Record<string, string> = { q: filter.q || 'art' };
  if (filter.deptId) params.departmentId = filter.deptId;
  if (filter.from !== '' && filter.to !== '') {
    params.dateBegin = filter.from;
    params.dateEnd = filter.to;
  }

  const key = JSON.stringify(params);
  let ids = idCache.get(key);
  if (!ids) {
    ids = await met.searchIds(params);
    idCache.set(key, ids);
  }
  if (!ids.length) return null;

  for (let i = 0; i < MAX_TRIES; i++) {
    const o = await met.getObject(pick(ids));
    if (o?.primaryImageSmall && o.artistDisplayName) return met.toWork(o);
  }
  return null;
}
