/** GET `url` (with optional query `params`) and parse the JSON response. */
export async function getJson(url, params) {
  const target = params ? `${url}?${new URLSearchParams(params)}` : url;
  const res = await fetch(target);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${target}`);
  return res.json();
}
