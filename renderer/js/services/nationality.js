// Artist nationality lookup with a per-session cache (many works share an artist).
import { nationalityOf } from '../api/wikidata.js';

const cache = new Map();
const HAS_INITIALS = /\b\p{Lu}\.\s?/u; // "J.A.D. Ingres"

async function resolve(artist) {
  const full = await nationalityOf(artist);
  if (full || !HAS_INITIALS.test(artist)) return full;
  // Initials rarely match Wikidata labels; retry with the surname alone.
  return nationalityOf(artist.split(/\s+/).pop());
}

/** @returns {Promise<string>} e.g. "French", or '' when unknown */
export function lookupNationality(artist) {
  if (!artist) return Promise.resolve('');
  if (!cache.has(artist)) cache.set(artist, resolve(artist));
  return cache.get(artist);
}
