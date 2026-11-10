// Pure helpers. No DOM, no network.

/** A random element. The array must not be empty. */
export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/** Last word of a name, letters only, lowercased: "J.A.D. Ingres" -> "ingres". */
export const surnameOf = (name: string): string =>
  (name.split(/\s+/).pop() ?? '').replace(/[^\p{L}]/gu, '').toLowerCase();
