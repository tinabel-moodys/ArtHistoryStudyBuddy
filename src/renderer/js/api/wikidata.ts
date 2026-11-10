// Wikidata lookups: an artist's nationality (as an adjective, e.g. "French").
import { getJson } from './http.js';

const API = 'https://www.wikidata.org/w/api.php';
const ARTIST_DESCRIPTION = /painter|artist|sculptor|photographer|printmaker|draughtsman|illustrator|engraver|lithographer|architect/i;
const SPACING_MS = 120;
const RETRY_DELAY_MS = 800;

interface Claim {
  mainsnak?: { datavalue?: { value?: unknown } };
}

interface Entity {
  claims?: Record<string, Claim[] | undefined>;
  labels?: Record<string, { value: string } | undefined>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

// Wikidata drops requests under bursts, so calls run one at a time, spaced out, with one retry.
let queue: Promise<unknown> = Promise.resolve();

function call<T>(params: Record<string, string>): Promise<T> {
  const request = { format: 'json', origin: '*', ...params };
  const run = queue.then(async () => {
    try {
      return await getJson<T>(API, request);
    } catch {
      await sleep(RETRY_DELAY_MS);
      return getJson<T>(API, request);
    }
  });
  queue = run.catch(() => undefined).then(() => sleep(SPACING_MS));
  return run;
}

const valuesOf = (entity: Entity, property: string): unknown[] =>
  (entity.claims?.[property] ?? []).map((c) => c.mainsnak?.datavalue?.value);

const isRef = (v: unknown): v is { id: string } =>
  typeof v === 'object' && v !== null && typeof (v as { id?: unknown }).id === 'string';

const isText = (v: unknown): v is { text: string; language: string } =>
  typeof v === 'object' && v !== null && typeof (v as { text?: unknown }).text === 'string';

async function getEntity(id: string, props: string): Promise<Entity | undefined> {
  const r = await call<{ entities: Record<string, Entity | undefined> }>({
    action: 'wbgetentities', ids: id, props, languages: 'en',
  });
  return r.entities[id];
}

async function findArtistId(name: string): Promise<string | null> {
  const r = await call<{ search?: { id: string; description?: string }[] }>({
    action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '8',
  });
  return (r.search ?? []).find((x) => ARTIST_DESCRIPTION.test(x.description ?? ''))?.id ?? null;
}

const demonyms = new Map<string, string>(); // country id -> "French"

async function demonymOf(countryId: string): Promise<string> {
  const cached = demonyms.get(countryId);
  if (cached !== undefined) return cached;
  const country = await getEntity(countryId, 'claims|labels');
  const english = country ? valuesOf(country, 'P1549').find((v) => isText(v) && v.language === 'en') : undefined;
  const demonym = isText(english) ? english.text : (country?.labels?.en?.value ?? '');
  demonyms.set(countryId, demonym);
  return demonym;
}

/** Nationality adjective for `name` (falls back to the country name), or '' if unknown. */
export async function nationalityOf(name: string): Promise<string> {
  try {
    const personId = await findArtistId(name);
    if (!personId) return '';
    const person = await getEntity(personId, 'claims');
    const country = person ? valuesOf(person, 'P27').find(isRef) : undefined; // country of citizenship
    return country ? await demonymOf(country.id) : '';
  } catch {
    return '';
  }
}
