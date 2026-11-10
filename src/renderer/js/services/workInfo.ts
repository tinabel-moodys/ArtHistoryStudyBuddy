// What we know about one work beyond its image: the artist's nationality and the work's art movement.
// The movement comes from the artwork's own Wikidata item when it has one, otherwise from the artist's.
import { workMovementOf } from '../api/wikidata.js';
import { lookupArtistInfo, type ArtistInfo } from './artistInfo.js';

const cache = new Map<string, Promise<ArtistInfo>>();

async function resolve(artist: string, title: string): Promise<ArtistInfo> {
  const fromArtist = await lookupArtistInfo(artist);
  const own = await workMovementOf(title, artist);
  return { nationality: fromArtist.nationality, movement: own || fromArtist.movement };
}

/** Unknown parts are ''. Never throws. */
export function lookupWorkInfo(work: { artist: string; title: string }): Promise<ArtistInfo> {
  if (!work.artist) return Promise.resolve({ nationality: '', movement: '' });
  const key = `${work.artist}|${work.title}`;
  let result = cache.get(key);
  if (!result) {
    result = resolve(work.artist, work.title);
    cache.set(key, result);
  }
  return result;
}
