// Fills in artist details (nationality, movement) that works saved by older versions are missing.
import type { Work } from '../types.js';
import { isComplete, lookupWorkInfo } from './workInfo.js';

/**
 * Looks up whatever is missing, one work at a time, calling `onChange` after each fill-in so the caller can save.
 * Works with nothing missing cost nothing.
 */
export async function enrichWorks(works: readonly Work[], onChange: () => void): Promise<void> {
  for (const work of works) {
    if (!work.artist || (work.nationality !== undefined && work.movement !== undefined)) continue;
    const info = await lookupWorkInfo(work);
    if (!isComplete(info)) continue; // a request failed: leave the work unfilled so the next study session retries
    work.nationality ??= info.nationality;
    work.movement ??= info.movement;
    onChange();
  }
}
