import { keySearch } from "@/lib/utils";
import { ORDER_TYPES, type EntrySearch } from "@/lib/search";

/**
 * The global search's scorer: forgiving, small and fast enough to run on
 * every keystroke over the whole index (a few thousand entries) on a phone.
 *
 * A query finds an entry, from best to worst, by:
 * exact title, exact alias, title prefix, alias prefix, word prefix
 * ("sun" finds "Yi Sun-shin"), initials ("yss"), substring, detail (a skin's
 * hero), and only when none of those finds anything at all, a typo — a small
 * edit distance against a word or the start of one ("lylia" for Lylia,
 * "gusoin" for Gusion). Case, accents, punctuation and Cyrillic script are
 * folded first, on both sides.
 *
 * Lower scores are better; `null` is no match.
 */

/** Cyrillic to Latin, so "Лейла" and a Cyrillic query meet a Latin title. */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Lowercase, no accents, Latin script, words of letters and digits split by single spaces. */
export function normalize(text: string): string {
  // Cyrillic first: the accent folding would turn "й" into "и".
  return keySearch(text.toLowerCase().replace(/[Ѐ-ӿ]/g, (c) => CYRILLIC[c] ?? ""))
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Optimal string alignment distance (Levenshtein plus swapping two
 * neighbours: "gusoin"), giving up past `max`: the answer is then `max + 1`.
 */
export function distance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  let before = new Array<number>(b.length + 1).fill(0);
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  let current = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1);
      current[j] = d;
      if (d < best) best = d;
    }
    if (best > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return Math.min(previous[b.length], max + 1);
}

/** An entry with its search keys computed once, when the index loads. */
export interface Prepared {
  entry: EntrySearch;
  /** Normalized title, and the same without spaces. */
  title: string;
  compact: string;
  words: string[];
  initials: string;
  aliases: string[];
  detail: string;
  /** A hero's sub-page (counters, duos): after the hero page itself. */
  sub: boolean;
}

export function prepare(entry: EntrySearch): Prepared {
  const title = normalize(entry.title);
  const words = title.split(" ").filter(Boolean);
  const aliases = (entry.keywords ?? []).map((k) => normalize(k).replace(/ /g, "")).filter(Boolean);
  return {
    entry,
    title,
    compact: title.replace(/ /g, ""),
    words,
    initials: words.length > 1 ? words.map((w) => w[0]).join("") : "",
    aliases,
    detail: entry.detail ? normalize(entry.detail) : "",
    sub: entry.type === "hero" && /^\/heroes\/[^/#]+\/./.test(entry.href),
  };
}

/** Score from which a match is a typo: those only show when nothing matches better. */
export const TYPO = 10;

/** Edits forgiven for a query of this length: none under 3 letters, 1 up to 5, then 2. */
export function allowedEdits(length: number): number {
  return length < 3 ? 0 : length <= 5 ? 1 : 2;
}

const wordStarts = (words: string[], token: string) => words.some((w) => w.startsWith(token));

/** A query, normalized once for the whole index. */
export interface Query {
  compact: string;
  tokens: string[];
}

export function makeQuery(text: string): Query {
  const q = normalize(text);
  return { compact: q.replace(/ /g, ""), tokens: q ? q.split(" ") : [] };
}

/** The score of one entry, `null` if the query does not find it. */
export function score(query: Query | string, p: Prepared, typos = true): number | null {
  const { compact, tokens } = typeof query === "string" ? makeQuery(query) : query;
  if (!compact) return null;
  const penalty = p.sub ? 0.5 : 0;
  const direct = (() => {
    if (p.compact === compact) return 0;
    if (p.aliases.includes(compact)) return 1;
    if (p.compact.startsWith(compact)) return 2;
    if (compact.length >= 2 && p.aliases.some((a) => a.startsWith(compact))) return 3;
    // Every word of the query starts a word of the title, in any order: "chou counter".
    if (tokens.every((t) => wordStarts(p.words, t) || (t.length >= 2 && p.aliases.some((a) => a.startsWith(t))))) return 4;
    if (compact.length >= 2 && p.initials.startsWith(compact)) return 5;
    if (compact.length >= 3 && p.compact.includes(compact)) return 6;
    // The detail: a skin's or skill's hero, an item's category.
    if (compact.length >= 2) {
      const words = p.detail.split(" ");
      if (tokens.every((t) => wordStarts(words, t) || wordStarts(p.words, t))) return 7;
    }
    return null;
  })();
  if (direct !== null) return direct + penalty;
  if (!typos) return null;
  const max = allowedEdits(compact.length);
  if (max === 0) return null;
  // A typo against a word, the whole title or an alias, or the start of one
  // (the query is often a name typed halfway: "gusoi").
  let best = max + 1;
  for (const key of [p.compact, ...p.words, ...p.aliases]) {
    if (Math.abs(key.length - compact.length) <= max) best = Math.min(best, distance(compact, key, max));
    if (key.length > compact.length) best = Math.min(best, distance(compact, key.slice(0, compact.length), max) + 0.5);
    if (best === 0) break;
  }
  return best <= max ? TYPO + best + penalty : null;
}

/** The types a typo is looked for in: names, not skills or patch titles. */
const TYPO_TYPES = new Set<EntrySearch["type"]>(["hero", "item", "spell", "emblem", "skin", "page"]);

/** Results per group; heroes get a few more, they are what most searches want. */
export const PER_GROUP: Partial<Record<EntrySearch["type"], number>> = { hero: 8 };
const DEFAULT_PER_GROUP = 6;

export interface Group {
  type: EntrySearch["type"];
  entries: EntrySearch[];
}

/**
 * The results, grouped in `ORDER_TYPES` order (heroes first), best first
 * within a group. Typo matches are only kept when nothing matches directly:
 * "flicker" lists the spell, not every hero one letter away from it.
 */
export function searchIndex(text: string, index: Prepared[]): Group[] {
  const query = makeQuery(text);
  if (!query.compact) return [];
  const found: { p: Prepared; s: number }[] = [];
  for (const p of index) {
    const s = score(query, p, TYPO_TYPES.has(p.entry.type));
    if (s !== null) found.push({ p, s });
  }
  const direct = found.filter((f) => f.s < TYPO);
  const kept = direct.length > 0 ? direct : found;
  return ORDER_TYPES.map((type) => ({
    type,
    entries: kept
      .filter((f) => f.p.entry.type === type)
      .sort((a, b) => a.s - b.s || a.p.entry.title.localeCompare(b.p.entry.title))
      .slice(0, PER_GROUP[type] ?? DEFAULT_PER_GROUP)
      .map((f) => f.p.entry),
  })).filter((g) => g.entries.length > 0);
}

/** The types offered as "closest" when nothing matches. */
const CLOSEST_TYPES = new Set<EntrySearch["type"]>(["hero", "item", "spell", "emblem"]);

/**
 * When nothing matches: the few names nearest to the query, however far,
 * heroes before the rest at equal distance — the "did you mean" of the
 * empty state.
 */
export function closest(query: string, index: Prepared[], count = 4): EntrySearch[] {
  const q = makeQuery(query).compact;
  if (q.length < 2) return [];
  const ranked: { p: Prepared; d: number }[] = [];
  for (const p of index) {
    if (!CLOSEST_TYPES.has(p.entry.type) || p.sub) continue;
    let d = Infinity;
    for (const key of [p.compact, ...p.words, ...p.aliases]) {
      d = Math.min(d, distance(q, key));
      if (key.length > q.length) d = Math.min(d, distance(q, key.slice(0, q.length)) + 0.5);
    }
    // Relative to the query's length: 3 edits on 4 letters is no suggestion.
    if (d <= Math.max(2, Math.ceil(q.length / 2))) ranked.push({ p, d });
  }
  const rank = (t: EntrySearch["type"]) => ORDER_TYPES.indexOf(t);
  return ranked
    .sort((a, b) => a.d - b.d || rank(a.p.entry.type) - rank(b.p.entry.type) || a.p.entry.title.localeCompare(b.p.entry.title))
    .slice(0, count)
    .map((r) => r.p.entry);
}
