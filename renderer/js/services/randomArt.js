// Random artwork from the Met matching an exam's filter (department / years / keyword).
import * as met from '../api/met.js';
import { pick } from '../util.js';

const idCache = new Map(); // search params -> object IDs
const MAX_TRIES = 8;

/** @returns a work, or null if none with an image and artist could be found */
export async function pickRandomWork(filter) {
  const params = { q: filter.q || 'art' };
  if (filter.deptId) params.departmentId = filter.deptId;
  if (filter.from !== '' && filter.to !== '') {
    params.dateBegin = filter.from;
    params.dateEnd = filter.to;
  }

  const key = JSON.stringify(params);
  if (!idCache.has(key)) idCache.set(key, await met.searchIds(params));
  const ids = idCache.get(key);
  if (!ids.length) return null;

  for (let i = 0; i < MAX_TRIES; i++) {
    const o = await met.getObject(pick(ids));
    if (o && o.primaryImageSmall && o.artistDisplayName) return met.toWork(o);
  }
  return null;
}
