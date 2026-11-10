/** GET `url` (with optional query `params`) and parse the JSON response as `T`. */
export async function getJson<T>(url: string, params?: Record<string, string>): Promise<T> {
  const target = params ? `${url}?${new URLSearchParams(params).toString()}` : url;
  const res = await fetch(target);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${target}`);
  return (await res.json()) as T;
}
