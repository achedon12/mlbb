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

/** Autocomplete choices: Discord caps names and values at 100 characters. */
export function toChoices(list: readonly Named[]): { name: string; value: string }[] {
  return list.slice(0, MAX_SUGGESTIONS).map((e) => ({ name: e.name.slice(0, 100), value: e.slug.slice(0, 100) }));
}
