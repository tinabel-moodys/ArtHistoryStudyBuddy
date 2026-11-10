// Artist nationality and art movement lookup with a per-session cache (many works share an artist).
import { artistInfoOf, type ArtistInfo } from '../api/wikidata.js';

export type { ArtistInfo };

const cache = new Map<string, Promise<ArtistInfo>>();
const HAS_INITIALS = /\b\p{Lu}\.\s?/u; // "J.A.D. Ingres"

async function resolve(artist: string): Promise<ArtistInfo> {
  const full = await artistInfoOf(artist);
  if (full.nationality || full.movement || !HAS_INITIALS.test(artist)) return full;
  // Initials rarely match Wikidata labels; retry with the surname alone.
  return artistInfoOf(artist.split(/\s+/).pop() ?? '');
}

/** Unknown parts are ''. Never throws. */
export function lookupArtistInfo(artist: string): Promise<ArtistInfo> {
  if (!artist) return Promise.resolve({ nationality: '', movement: '' });
  let result = cache.get(artist);
  if (!result) {
    result = resolve(artist);
    cache.set(artist, result);
  }
  return result;
}
