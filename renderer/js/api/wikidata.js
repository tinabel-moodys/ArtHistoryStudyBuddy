// Wikidata lookups: an artist's nationality (as an adjective, e.g. "French").
import { getJson } from './http.js';

const API = 'https://www.wikidata.org/w/api.php';
const ARTIST_DESCRIPTION = /painter|artist|sculptor|photographer|printmaker|draughtsman|illustrator|engraver|lithographer|architect/i;
const SPACING_MS = 120;
const RETRY_DELAY_MS = 800;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Wikidata drops requests under bursts, so calls run one at a time, spaced out, with one retry.
let queue = Promise.resolve();
function call(params) {
  const run = queue.then(async () => {
    try { return await getJson(API, { format: 'json', origin: '*', ...params }); }
    catch { await sleep(RETRY_DELAY_MS); return getJson(API, { format: 'json', origin: '*', ...params }); }
  });
  queue = run.catch(() => {}).then(() => sleep(SPACING_MS));
  return run;
}

const idsOf = (entity, property) =>
  (entity.claims?.[property] || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);

async function getEntity(id, props) {
  return (await call({ action: 'wbgetentities', ids: id, props, languages: 'en' })).entities[id];
}

async function findArtistId(name) {
  const r = await call({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '8' });
  const hit = (r.search || []).find(x => ARTIST_DESCRIPTION.test(x.description || ''));
  return hit ? hit.id : null;
}

const demonyms = new Map(); // country id -> "French"
async function demonymOf(countryId) {
  if (!demonyms.has(countryId)) {
    const country = await getEntity(countryId, 'claims|labels');
    const demonym = (country.claims?.P1549 || [])
      .map(c => c.mainsnak?.datavalue?.value)
      .find(v => v && v.language === 'en');
    demonyms.set(countryId, demonym?.text || country.labels?.en?.value || '');
  }
  return demonyms.get(countryId);
}

/** Nationality adjective for `name` (falls back to the country name), or '' if unknown. */
export async function nationalityOf(name) {
  try {
    const personId = await findArtistId(name);
    if (!personId) return '';
    const [countryId] = idsOf(await getEntity(personId, 'claims'), 'P27'); // country of citizenship
    return countryId ? await demonymOf(countryId) : '';
  } catch {
    return '';
  }
}
