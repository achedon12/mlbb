/**
 * Name matching for autocomplete and for free-typed options.
 *
 * Players type "chang e", "changé" or "Chang'e": accents, case and
 * punctuation are ignored. A name that starts with the query ranks before
 * one that only contains it, and Discord shows at most 25 suggestions.
 */

export const MAX_SUGGESTIONS = 25;

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export interface Named {
  slug: string;
  name: string;
}

export function searchByName<T extends Named>(list: readonly T[], query: string, limit = MAX_SUGGESTIONS): T[] {
  const q = normalize(query);
  if (!q) return list.slice(0, limit);
  const scored: { entry: T; score: number }[] = [];
  for (const entry of list) {
    const name = normalize(entry.name);
    const slug = normalize(entry.slug);
    const score = name === q || slug === q ? 0 : name.startsWith(q) || slug.startsWith(q) ? 1 : name.includes(q) ? 2 : -1;
    if (score >= 0) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * The entry an option value designates. Autocomplete sends the slug, but a
 * player may also type a name and press enter without picking: an exact
 * (normalised) name or slug match, or a single candidate, is accepted.
 */
export function resolveByName<T extends Named>(list: readonly T[], value: string): T | null {
  const bySlug = list.find((e) => e.slug === value);
  if (bySlug) return bySlug;
  const matches = searchByName(list, value, 2);
  const q = normalize(value);
  const exact = matches.find((e) => normalize(e.name) === q || normalize(e.slug) === q);
  if (exact) return exact;
  return matches.length === 1 ? matches[0]! : null;
}

/**
 * Edit distance between two normalised names, for the typos the substring
 * match misses. Two swapped letters ("chuo" for "chou") count as one edit,
 * the commonest typo on a phone keyboard.
 */
export function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1);
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * The "did you mean" names of a value that resolved to nothing: what the
 * autocomplete would have offered (an ambiguous "la" gives Lancelot and
 * Layla), else the names a few typos away ("lyla" gives Layla). Never more
 * than `limit`, never a name too far from what was typed to be a guess.
 */
export function suggest<T extends Named>(list: readonly T[], value: string, limit = 3): T[] {
  const q = normalize(value);
  if (!q) return [];
  const matches = searchByName(list, value, limit);
  if (matches.length) return matches;
  // A third of the length, at least one edit: "chuo" is one away from "chou".
  const tolerance = Math.max(1, Math.floor(q.length / 3));
  return list
    .map((entry) => {
      const name = normalize(entry.name);
      // A long name is compared on its start too ("popul" for "Popol and Kupa"),
      // but not for a short query: every name starts two letters from "ab".
      const start = q.length >= 4 ? distance(q, name.slice(0, q.length)) : Infinity;
      return { entry, d: Math.min(distance(q, name), start) };
    })
    .filter((s) => s.d <= tolerance)
    .sort((a, b) => a.d - b.d || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Autocomplete choices: Discord caps names and values at 100 characters. */
export function toChoices(list: readonly Named[]): { name: string; value: string }[] {
  return list.slice(0, MAX_SUGGESTIONS).map((e) => ({ name: e.name.slice(0, 100), value: e.slug.slice(0, 100) }));
}
