// Artist nationality lookup with a per-session cache (many works share an artist).
import { nationalityOf } from '../api/wikidata.js';

const cache = new Map<string, Promise<string>>();
const HAS_INITIALS = /\b\p{Lu}\.\s?/u; // "J.A.D. Ingres"

async function resolve(artist: string): Promise<string> {
  const full = await nationalityOf(artist);
  if (full || !HAS_INITIALS.test(artist)) return full;
  // Initials rarely match Wikidata labels; retry with the surname alone.
  return nationalityOf(artist.split(/\s+/).pop() ?? '');
}

/** e.g. "French", or '' when unknown. */
export function lookupNationality(artist: string): Promise<string> {
  if (!artist) return Promise.resolve('');
  let result = cache.get(artist);
  if (!result) {
    result = resolve(artist);
    cache.set(artist, result);
  }
  return result;
}
