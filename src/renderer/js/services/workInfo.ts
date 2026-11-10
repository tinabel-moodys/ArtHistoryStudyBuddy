// What we know about one work beyond its image: the artist's nationality and the work's art movement.
// The movement comes from the artwork's own Wikidata item when it has one, otherwise from the artist's.
import { failureCount, workMovementOf } from '../api/wikidata.js';
import { isComplete, lookupArtistInfo, markIncomplete, type ArtistInfo } from './artistInfo.js';

export { isComplete };

const cache = new Map<string, Promise<ArtistInfo>>();

async function resolve(artist: string, title: string): Promise<ArtistInfo> {
  const fromArtist = await lookupArtistInfo(artist);
  const before = failureCount();
  const own = await workMovementOf(title, artist);
  const info = { nationality: fromArtist.nationality, movement: own || fromArtist.movement };
  return isComplete(fromArtist) && failureCount() === before ? info : markIncomplete(info);
}

/** Unknown parts are ''. Never throws; check `isComplete` before treating '' as "unknown". */
export function lookupWorkInfo(work: { artist: string; title: string }): Promise<ArtistInfo> {
  if (!work.artist) return Promise.resolve({ nationality: '', movement: '' });
  const key = `${work.artist}|${work.title}`;
  let result = cache.get(key);
  if (!result) {
    const lookup = resolve(work.artist, work.title);
    result = lookup;
    cache.set(key, lookup);
    void lookup.then((info) => { if (!isComplete(info) && cache.get(key) === lookup) cache.delete(key); });
  }
  return result;
}
