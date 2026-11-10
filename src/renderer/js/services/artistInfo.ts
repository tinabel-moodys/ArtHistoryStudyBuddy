// Artist nationality and art movement lookup with a per-session cache (many works share an artist).
import { artistInfoOf, failureCount, type ArtistInfo } from '../api/wikidata.js';

export type { ArtistInfo };

const cache = new Map<string, Promise<ArtistInfo>>();
const HAS_INITIALS = /\b\p{Lu}\.\s?/u; // "J.A.D. Ingres"

// Results where a request failed, so '' may mean "couldn't ask" rather than "not on Wikidata".
const incomplete = new WeakSet<ArtistInfo>();

/** False when a lookup failed part-way: show the result, but don't save it or cache it as final. */
export const isComplete = (info: ArtistInfo): boolean => !incomplete.has(info);

/** A copy of `info` flagged as unreliable (see `isComplete`). */
export function markIncomplete(info: ArtistInfo): ArtistInfo {
  const flagged = { ...info };
  incomplete.add(flagged);
  return flagged;
}

/** Runs `lookup` and flags the result if any Wikidata request failed meanwhile. */
export async function tracked(lookup: () => Promise<ArtistInfo>): Promise<ArtistInfo> {
  const before = failureCount();
  const info = await lookup();
  return failureCount() === before ? info : markIncomplete(info);
}

async function resolve(artist: string): Promise<ArtistInfo> {
  const full = await artistInfoOf(artist);
  if (full.nationality || full.movement || !HAS_INITIALS.test(artist)) return full;
  // Initials rarely match Wikidata labels; retry with the surname alone.
  return artistInfoOf(artist.split(/\s+/).pop() ?? '');
}

/** Unknown parts are ''. Never throws; check `isComplete` before treating '' as "unknown". */
export function lookupArtistInfo(artist: string): Promise<ArtistInfo> {
  if (!artist) return Promise.resolve({ nationality: '', movement: '' });
  let result = cache.get(artist);
  if (!result) {
    const lookup = tracked(() => resolve(artist));
    result = lookup;
    cache.set(artist, lookup);
    // A failed lookup must not stick for the whole session: let the next call retry.
    void lookup.then((info) => { if (!isComplete(info) && cache.get(artist) === lookup) cache.delete(artist); });
  }
  return result;
}
