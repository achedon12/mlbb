import type { Lane, Role } from "./types";
import { keySearch } from "./utils";

/**
 * MLBB quiz: daily challenge and practice.
 *
 * Module with no data and no browser dependency. The server uses it to
 * draw the daily challenge from the pool (`quiz-data.ts`); the client, to
 * redo the same draw offline from the cached pool, and for
 * practice rounds.
 *
 * The challenge depends only on the UTC date: everyone gets the same one, in
 * every language — only the texts change. Each pick takes the candidate with
 * the smallest hash of "date + slug" rather than an index in a list:
 * a newly released hero does not reshuffle challenges already played.
 */

export type TypeRound = "skill" | "skin" | "story" | "item" | "duel";
export type GuessType = Exclude<TypeRound, "duel">;

/** Order of the daily challenge rounds, also used by the share grid. */
export const ORDER_CHALLENGE: TypeRound[] = ["skill", "skin", "story", "item", "duel"];

/** Attempts per round: five for a hero among 133, four for an item. */
export const ATTEMPTS: Record<GuessType, number> = { skill: 5, skin: 5, story: 5, item: 4 };

/** Pairs in the "higher or lower" duel: three daily, one in practice. */
export const PAIRS_DUEL = 3;

/** First challenge: a day's number is counted from this one. */
export const EPOCH = "2026-09-11";

/** Attempt that gives up the round: it ends it without counting as one more error. */
export const ABANDON = "-";

/** Zoom level of a skin illustration, error after error. */
export const ZOOMS = [3.2, 2.4, 1.8, 1.35, 1];

/** Icon of each round in the shared grid: it reveals nothing about the answer. */
export const EMOJI_ROUND: Record<TypeRound, string> = {
  skill: "✨",
  skin: "🎨",
  story: "📜",
  item: "🛡️",
  duel: "⚖️",
};

// ─────────────────────────────────────────────────────────────
// Pool
// ─────────────────────────────────────────────────────────────

/** A hero as the quiz compares it: enough to suggest, compare and give hints. */
export interface QuizHero {
  slug: string;
  nom: string;
  icone: string | null;
  roles: Role[];
  lanes: Lane[];
  annee: number | null;
  /** Region, already translated. */
  region: string | null;
}

/** An item as the answer field suggests and compares it. */
export interface ItemRoster {
  slug: string;
  nom: string;
  icone: string | null;
  prix: number | null;
  /** Category, already translated. */
  categorie: string;
}

export interface ItemQuiz extends ItemRoster {
  bonus: string;
  recette: { nom: string; icone: string | null }[];
  /** Passive or unique effect, item name masked. */
  passif: string | null;
}

export interface SkillQuiz {
  nom: string;
  icone: string;
  /** Start of the description, hero name masked. */
  extrait: string | null;
}

export interface SkinQuiz {
  nom: string;
  image: string;
}

/**
 * Everything needed to draw rounds, in one language. The server
 * serves it for practice (`/quiz/<locale>.json`); the daily challenge only sends
 * the draw.
 */
export interface PoolQuiz {
  /** Changes on every sync: the browser cache is then refreshed. */
  version: string;
  /** Date of the win rate snapshot. */
  mesure: string;
  heros: QuizHero[];
  competences: Record<string, SkillQuiz[]>;
  histoires: Record<string, string[]>;
  skins: Record<string, SkinQuiz[]>;
  objets: ItemQuiz[];
  /** Win rate across all ranks, heroes with enough games only. */
  victoires: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────
// Rounds
// ─────────────────────────────────────────────────────────────

export interface DuelHero {
  slug: string;
  victoire: number;
}
export type PairDuel = [DuelHero, DuelHero];

export type Round =
  | { type: "skill"; reponse: string; nom: string; icone: string; extrait: string | null }
  /** `foyer`: point of the illustration the image is zoomed on, as fractions. */
  | { type: "skin"; reponse: string; image: string; skin: string; foyer: [number, number] }
  | { type: "story"; reponse: string; extraits: string[] }
  | {
      type: "item";
      reponse: string;
      bonus: string;
      prix: number | null;
      categorie: string;
      recette: { nom: string; icone: string | null }[];
      passif: string | null;
    }
  | { type: "duel"; paires: PairDuel[] };

export interface Challenge {
  jour: string;
  numero: number;
  version: string;
  mesure: string;
  manches: Round[];
}

/**
 * Randomness source for a draw: maps a key to a number in [0, 1[.
 * The daily challenge derives it from a hash (same key, same number); practice
 * from `Math.random`.
 */
export type Draw = (key: string) => number;

/** 32-bit FNV-1a hash: short, dependency-free, identical everywhere. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Reproducible draw: one seed, then each key always gives the same number. */
export function fixedDraw(seed: string): Draw {
  return (key) => hash(`${seed}|${key}`) / 4294967296;
}

/** Candidate with the smallest draw: stable when the list grows by an element that does not win. */
function choose<T>(candidates: T[], key: (x: T) => string, draw: Draw): T | undefined {
  let best: T | undefined;
  let value = Infinity;
  for (const c of candidates) {
    const v = draw(key(c));
    if (v < value) {
      value = v;
      best = c;
    }
  }
  return best;
}

const hint = (n: number, r: number) => Math.min(n - 1, Math.floor(r * n));
const rounded = (v: number) => Math.round(v * 100) / 100;

/**
 * A round of the requested type. `excluded` avoids reusing a hero or an
 * item already drawn (it is filled in along the way); `pairs` sets the length of the
 * duel. Returns `null` when the pool has no candidate.
 */
export function generateRound(
  pool: PoolQuiz,
  type: TypeRound,
  draw: Draw,
  o: { excluded?: Set<string>; pairs?: number; recipeOnly?: boolean } = {},
): Round | null {
  const excluded = o.excluded ?? new Set<string>();
  const free = pool.heros.filter((h) => !excluded.has(h.slug));

  if (type === "skill") {
    const h = choose(free.filter((x) => pool.competences[x.slug]?.length), (x) => `competence:${x.slug}`, draw);
    if (!h) return null;
    const list = pool.competences[h.slug];
    const c = list[hint(list.length, draw(`competence:${h.slug}:laquelle`))];
    excluded.add(h.slug);
    return { type, reponse: h.slug, nom: c.nom, icone: c.icone, extrait: c.extrait };
  }

  if (type === "skin") {
    const h = choose(free.filter((x) => pool.skins[x.slug]?.length), (x) => `skin:${x.slug}`, draw);
    if (!h) return null;
    const list = pool.skins[h.slug];
    const s = list[hint(list.length, draw(`skin:${h.slug}:lequel`))];
    excluded.add(h.slug);
    // The zoom point stays near the center, where the character stands.
    const home: [number, number] = [
      rounded(0.3 + 0.4 * draw(`skin:${h.slug}:x`)),
      rounded(0.25 + 0.35 * draw(`skin:${h.slug}:y`)),
    ];
    return { type, reponse: h.slug, image: s.image, skin: s.nom, foyer: home };
  }

  if (type === "story") {
    const h = choose(free.filter((x) => pool.histoires[x.slug]?.length), (x) => `histoire:${x.slug}`, draw);
    if (!h) return null;
    const list = pool.histoires[h.slug];
    const i = hint(list.length, draw(`histoire:${h.slug}:lequel`));
    excluded.add(h.slug);
    const excerpts = list.length > 1 ? [list[i], list[(i + 1) % list.length]] : [list[i]];
    return { type, reponse: h.slug, extraits: excerpts };
  }

  if (type === "item") {
    const candidates = pool.objets.filter((x) => !excluded.has(x.slug) && (!o.recipeOnly || x.recette.length));
    const obj = choose(candidates, (x) => `objet:${x.slug}`, draw);
    if (!obj) return null;
    excluded.add(obj.slug);
    return {
      type,
      reponse: obj.slug,
      bonus: obj.bonus,
      prix: obj.prix,
      categorie: obj.categorie,
      recette: obj.recette,
      passif: obj.passif,
    };
  }

  // Duel: two heroes with win rates far enough apart for there to be an answer,
  // not so far that it is obvious.
  const measures = free.filter((h) => pool.victoires[h.slug] !== undefined);
  const pairs: PairDuel[] = [];
  for (let n = 0; n < (o.pairs ?? 1); n++) {
    const key = (x: QuizHero) => `duel:${n}:${x.slug}`;
    const a = choose(measures.filter((x) => !excluded.has(x.slug)), key, draw);
    if (!a) break;
    const va = pool.victoires[a.slug];
    const b = choose(
      measures.filter((x) => {
        const gap = Math.abs(pool.victoires[x.slug] - va);
        return x.slug !== a.slug && !excluded.has(x.slug) && gap >= 0.5 && gap <= 6;
      }),
      (x) => `duel:${n}:b:${x.slug}`,
      draw,
    );
    if (!b) break;
    excluded.add(a.slug).add(b.slug);
    pairs.push([
      { slug: a.slug, victoire: va },
      { slug: b.slug, victoire: pool.victoires[b.slug] },
    ]);
  }
  return pairs.length ? { type: "duel", paires: pairs } : null;
}

/** Daily challenge: one round of each type, in grid order, with no repeated hero. */
export function generateChallenge(pool: PoolQuiz, day: string): Challenge {
  const draw = fixedDraw(`defi:${day}`);
  const excluded = new Set<string>();
  const rounds = ORDER_CHALLENGE.flatMap((type) => {
    const m = generateRound(pool, type, draw, { excluded, pairs: PAIRS_DUEL, recipeOnly: true });
    return m ? [m] : [];
  });
  return { jour: day, numero: numberChallenge(day), version: pool.version, mesure: pool.mesure, manches: rounds };
}

// ─────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────

/** UTC day of a date, "2026-09-11": the challenge changes at midnight UTC for everyone. */
export function dayUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && dayUtc(d) === day;
}

export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayUtc(d);
}

export function numberChallenge(day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / 86_400_000) + 1;
}

// ─────────────────────────────────────────────────────────────
// Texts
// ─────────────────────────────────────────────────────────────

export const MASK = "▢▢▢";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Masks a name in a text: the full name, case-insensitive, then each of
 * its parts of at least three letters that starts with an uppercase letter
 * ("Popol and Kupa" masks "Popol" and "Kupa", not "and"; "Yi
 * Sun-shin" masks "Sun" without touching the sun in a sentence).
 */
export function maskName(text: string, names: string[]): string {
  let output = text;
  const full = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  const edge = (pattern: string, flags: string) =>
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, flags);
  if (full.length) output = output.replace(edge(full.map(escape).join("|"), "giu"), MASK);
  const matches = [
    ...new Set(full.flatMap((n) => n.split(/[\s.'’-]+/).filter((p) => p.length >= 3 && /^\p{Lu}/u.test(p)))),
  ].sort((a, b) => b.length - a.length);
  if (matches.length) output = output.replace(edge(matches.map(escape).join("|"), "gu"), MASK);
  return output;
}

/** Cuts a text to about `max` characters, at the end of a sentence if possible, otherwise of a word. */
export function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const start = clean.slice(0, max);
  const sentence = Math.max(start.lastIndexOf(". "), start.lastIndexOf("! "), start.lastIndexOf("? "));
  if (sentence >= max * 0.45) return start.slice(0, sentence + 1);
  const word = start.lastIndexOf(" ");
  return `${start.slice(0, word > 0 ? word : max).replace(/[,;:]$/, "")}…`;
}

// ─────────────────────────────────────────────────────────────
// Answers and comparisons
// ─────────────────────────────────────────────────────────────

/** Winner of each duel pair. */
export function responsesDuel(round: Extract<Round, { type: "duel" }>): string[] {
  return round.paires.map(([a, b]) => (a.victoire >= b.victoire ? a.slug : b.slug));
}

export function attemptsMax(round: Round): number {
  return round.type === "duel" ? round.paires.length : ATTEMPTS[round.type];
}

/** Errors in a guessing round: they unlock hints, one by one. */
export function errors(round: Round, attempts: string[]): number {
  if (round.type === "duel") return 0;
  return attempts.filter((e) => e !== ABANDON && e !== round.reponse).length;
}

export function roundSuccessful(round: Round, attempts: string[]): boolean {
  if (round.type === "duel") {
    const good = responsesDuel(round);
    return attempts.length === good.length && attempts.every((e, i) => e === good[i]);
  }
  return attempts.includes(round.reponse);
}

export function roundFinished(round: Round, attempts: string[]): boolean {
  if (round.type === "duel") return attempts.length >= round.paires.length;
  return attempts.includes(round.reponse) || attempts.includes(ABANDON) || attempts.length >= ATTEMPTS[round.type];
}

/** Points: one per guess found, one per duel pair. */
export function pointsRound(round: Round, attempts: string[]): number {
  if (round.type === "duel") {
    const good = responsesDuel(round);
    return attempts.filter((e, i) => e === good[i]).length;
  }
  return attempts.includes(round.reponse) ? 1 : 0;
}

export function pointsMax(rounds: Round[]): number {
  return rounds.reduce((n, m) => n + (m.type === "duel" ? m.paires.length : 1), 0);
}

export type Agreement = "yes" | "partial" | "no";
/** Position of the answer relative to the attempt: `higher` = more recent, more expensive. */
export type Direction = "equal" | "higher" | "lower" | "unknown";

function agreement<T>(attempt: T[], target: T[]): Agreement {
  const common = attempt.filter((x) => target.includes(x)).length;
  if (common === 0) return "no";
  return common === target.length && attempt.length === target.length ? "yes" : "partial";
}

function direction(attempt: number | null, target: number | null): Direction {
  if (attempt === null || target === null) return "unknown";
  return attempt === target ? "equal" : target > attempt ? "higher" : "lower";
}

/** What a wrong hero has in common with the answer: one more hint with each attempt. */
export function compareHeroes(attempt: QuizHero, target: QuizHero) {
  return {
    roles: agreement(attempt.roles, target.roles),
    lanes: agreement(attempt.lanes, target.lanes),
    year: direction(attempt.annee, target.annee),
    region: (attempt.region && attempt.region === target.region ? "yes" : "no") as Agreement,
  };
}

export function compareItems(attempt: ItemRoster, target: ItemRoster) {
  return {
    price: direction(attempt.prix, target.prix),
    category: (attempt.categorie === target.categorie ? "yes" : "no") as Agreement,
  };
}

/**
 * Answer field suggestions: the start of the name first, then the start
 * of a word, then any part. Case- and accent-insensitive.
 */
export function searchOptions<T extends { slug: string; name: string }>(
  options: T[],
  text: string,
  excluded: Set<string>,
  max = 8,
): T[] {
  const term = keySearch(text.trim());
  if (!term) return [];
  const rank = (name: string) => {
    const key = keySearch(name);
    if (key.startsWith(term)) return 0;
    if (key.split(/[\s.'’-]+/).some((m) => m.startsWith(term))) return 1;
    return key.includes(term) ? 2 : -1;
  };
  return options
    .filter((o) => !excluded.has(o.slug))
    .map((o) => ({ o, r: rank(o.name) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.o.name.localeCompare(b.o.name))
    .slice(0, max)
    .map((x) => x.o);
}

// ─────────────────────────────────────────────────────────────
// Sharing and statistics
// ─────────────────────────────────────────────────────────────

/**
 * Grid row: one square per attempt, revealing nothing about the answer. Unplayed
 * attempts stay black; an abandoned round fills with red,
 * so it does not read as a round not yet played.
 */
export function rowGrid(round: Round, attempts: string[]): string {
  if (round.type === "duel") {
    const good = responsesDuel(round);
    const squares = good.map((b, i) => (attempts[i] === undefined ? "⬛" : attempts[i] === b ? "🟩" : "🟥"));
    return `${EMOJI_ROUND.duel} ${squares.join("")}`;
  }
  const played = attempts.filter((e) => e !== ABANDON).map((e) => (e === round.reponse ? "🟩" : "🟥"));
  const rest = attempts.includes(ABANDON) ? "🟥" : "⬛";
  const empty = Array(Math.max(0, ATTEMPTS[round.type] - played.length)).fill(rest);
  return `${EMOJI_ROUND[round.type]} ${[...played, ...empty].join("")}`;
}

export function textShare(o: {
  number: number;
  points: number;
  max: number;
  series: number;
  rows: string[];
  url: string;
}): string {
  const series = o.series >= 2 ? ` 🔥${o.series}` : "";
  return [`MLBBDex Quiz #${o.number} · ${o.points}/${o.max}${series}`, ...o.rows, o.url].join("\n");
}

export interface StatsQuiz {
  joues: number;
  serie: number;
  meilleure: number;
  /** Last completed day. */
  dernier: string | null;
  /** Number of challenges per score, from 0 to the maximum. */
  distribution: number[];
}

export const STATS_EMPTY: StatsQuiz = { joues: 0, serie: 0, meilleure: 0, dernier: null, distribution: [] };

/** Records a completed challenge. A day already counted is not counted twice. */
export function saveMatch(stats: StatsQuiz, day: string, points: number): StatsQuiz {
  if (stats.dernier === day) return stats;
  const series = stats.dernier === shiftDay(day, -1) ? stats.serie + 1 : 1;
  const distribution = [...stats.distribution];
  while (distribution.length <= points) distribution.push(0);
  distribution[points] += 1;
  return { joues: stats.joues + 1, serie: series, meilleure: Math.max(stats.meilleure, series), dernier: day, distribution };
}

/** Streak to display: broken if neither today nor yesterday was played. */
export function currentStreak(stats: StatsQuiz, today: string): number {
  return stats.dernier === today || stats.dernier === shiftDay(today, -1) ? stats.serie : 0;
}
