const TIMEOUT_MS = 15_000;

/**
 * GET `url` (with optional query `params`) and parse the JSON response as `T`.
 * Rejects after 15 s so one stalled request can't hang an import or the Wikidata queue.
 */
export async function getJson<T>(url: string, params?: Record<string, string>): Promise<T> {
  const target = params ? `${url}?${new URLSearchParams(params).toString()}` : url;
  const res = await fetch(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${target}`);
  return (await res.json()) as T;
}
