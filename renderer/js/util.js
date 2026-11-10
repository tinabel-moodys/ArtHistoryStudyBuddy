// Pure helpers. No DOM, no network.

export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const unique = arr => [...new Set(arr)];

/** Last word of a name, letters only, lowercased: "J.A.D. Ingres" -> "ingres". */
export const surnameOf = name =>
  (name.split(/\s+/).pop() || '').replace(/[^\p{L}]/gu, '').toLowerCase();
