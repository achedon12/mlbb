import rawData from "@/data/jeu/esports.json";
import { classementComplet } from "./tier-list";

/**
 * Esports: World Championships (M-series), MSC and the current MPL seasons.
 *
 * The data comes from Liquipedia (`node scripts/esports.mjs`), under the
 * CC BY-SA 3.0 license: every page showing it credits the source and its
 * pages. Nothing is made up here: the figures are counts over the drafts the
 * source records, game by game.
 */

export type Series = "m" | "msc" | "mpl";
export type Region = "id" | "ph" | "my";
export type Status = "live" | "upcoming" | "finished";

/** A source label mapped to a translatable key ("Upper Bracket Final", "Week 3"). */
export interface SourceLabel {
  kind: "grandFinal" | "thirdPlace" | "final" | "semifinal" | "quarterfinal" | "round" | "week" | "day" | "group";
  n?: number;
  letter?: string;
  side?: "upper" | "lower";
}

export interface StandingRow {
  rank: number;
  team: string;
  /** Series won, lost. */
  series: [number, number];
  /** Games won, lost. */
  games: [number, number];
  /** Zone marked by the source (up, seedup, stayup, stay, staydown, down). */
  zone: string | null;
}

export interface Standing {
  title: string | null;
  label: SourceLabel | null;
  kind: "league" | "swiss";
  rows: StandingRow[];
}

export interface BracketMatch {
  teams: (string | null)[];
  /** Text of an opponent not known yet ("Seed 3"). */
  placeholders: (string | null)[];
  score: [number, number] | null;
  winner: 1 | 2 | null;
  date: string | null;
}

export interface Round {
  title: string | null;
  label: SourceLabel | null;
  number: number | null;
  matches: BracketMatch[];
}

export interface Bracket {
  title: string | null;
  label: SourceLabel | null;
  rounds: Round[];
}

export interface Stage {
  title: string | null;
  key: string;
  page: string;
  standings: Standing[];
  brackets: Bracket[];
}

export interface HeroCounts {
  slug: string;
  picks: number;
  bans: number;
  wins: number;
  losses: number;
}

export interface DraftGame {
  winner: 1 | 2;
  duration: string | null;
  team1Side: "blue" | "red" | null;
  /** Site slugs; the source name when the hero is not recognized. */
  picks: [string[], string[]];
  bans: [string[], string[]];
}

export interface DraftMatch {
  date: string;
  stage: string | null;
  teams: [string, string];
  score: [number, number] | null;
  winner: 1 | 2 | null;
  games: DraftGame[];
}

export interface SourcePage {
  title: string;
  url: string;
  /** Date of the revision read, ISO. */
  revision: string;
}

export interface Tournament {
  slug: string;
  series: Series;
  region?: Region;
  number: number;
  /** Latest started edition of its series. */
  current: boolean;
  page: string;
  name: string;
  shortName: string;
  /** Dates as the source gives them, sometimes partial ("2026-11", "2027"). */
  startDate: string | null;
  endDate: string | null;
  prizePool: { amount: number; currency: string } | null;
  teamCount: number | null;
  city: string | null;
  country: string | null;
  patch: string | null;
  endPatch: string | null;
  sources: SourcePage[];
  stages: Stage[];
  games: number;
  matches: number;
  lastMatch: string | null;
  nextMatch: string | null;
  champion: string | null;
  heroes: HeroCounts[];
  drafts: DraftMatch[];
}

interface EsportsData {
  updatedAt: string | null;
  source: { name: string; url: string; license: string; licenseUrl: string };
  unmappedHeroes: { name: string; count: number }[];
  tournaments: Tournament[];
}

const data = rawData as unknown as EsportsData;

export const esportsSource = data.source;
/** Date of the most recent source page. */
export const esportsUpdatedAt = data.updatedAt;
export const tournaments = data.tournaments;
export const tournamentBySlug = new Map(tournaments.map((t) => [t.slug, t]));

// ─────────────────────────────────────────────────────────────
// Status and order
// ─────────────────────────────────────────────────────────────

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** A partial date ("2027-01") is compared at its own precision only. */
const reached = (date: string, day: string) => date <= day.slice(0, date.length);
const passed = (date: string, day: string) => date < day.slice(0, date.length);

/**
 * Upcoming until the start date is reached; finished once the final is
 * played or the end date has passed; live in between. Evaluated when the page
 * renders, so every build refreshes it.
 */
export function tournamentStatus(t: Tournament, now = new Date()): Status {
  const day = dayOf(now);
  if (t.startDate && !reached(t.startDate, day) && t.matches === 0) return "upcoming";
  if (t.champion) return "finished";
  // A year-only end date ("2026") is too vague to close a tournament.
  if (t.endDate && t.endDate.length >= 7 && passed(t.endDate, day) && !t.nextMatch) return "finished";
  return "live";
}

const STATUS_ORDER: Record<Status, number> = { live: 0, upcoming: 1, finished: 2 };

/** Live first, then upcoming, then finished from the most recent. */
export function sortedTournaments(now = new Date()): Tournament[] {
  return [...tournaments].sort(
    (a, b) =>
      STATUS_ORDER[tournamentStatus(a, now)] - STATUS_ORDER[tournamentStatus(b, now)] ||
      (b.startDate ?? "").localeCompare(a.startDate ?? ""),
  );
}

// ─────────────────────────────────────────────────────────────
// Pro meta: tournaments taken into account
// ─────────────────────────────────────────────────────────────

/**
 * Pro meta window. A World Championship played eight months earlier, on
 * another patch, would skew the comparison with today's rates: only live
 * tournaments, or those whose last match is under four months old, count.
 */
export const META_WINDOW_DAYS = 120;

export function metaTournaments(now = new Date()): Tournament[] {
  const limit = dayOf(new Date(now.getTime() - META_WINDOW_DAYS * 86_400_000));
  return tournaments.filter(
    (t) => t.current && t.games > 0 && (tournamentStatus(t, now) === "live" || (t.lastMatch ?? "") >= limit),
  );
}

export interface ProHero extends HeroCounts {
  /** Share of games where the hero is picked or banned, in %. */
  presence: number;
  /** Wins over picks, in %; `null` without a pick. */
  winRate: number | null;
}

/** Presence and win rate of a counts line, over `games` games. */
export function withRates(c: HeroCounts, games: number): ProHero {
  return {
    ...c,
    presence: games ? ((c.picks + c.bans) / games) * 100 : 0,
    winRate: c.picks ? (c.wins / c.picks) * 100 : null,
  };
}

/** Sum of the counts of several tournaments, hero by hero. */
export function combine(list: Tournament[]): { games: number; heroes: ProHero[] } {
  const games = list.reduce((n, t) => n + t.games, 0);
  const sums = new Map<string, HeroCounts>();
  for (const t of list) {
    for (const h of t.heroes) {
      const s = sums.get(h.slug) ?? { slug: h.slug, picks: 0, bans: 0, wins: 0, losses: 0 };
      s.picks += h.picks;
      s.bans += h.bans;
      s.wins += h.wins;
      s.losses += h.losses;
      sums.set(h.slug, s);
    }
  }
  return {
    games,
    heroes: [...sums.values()].map((s) => withRates(s, games)).sort((a, b) => b.presence - a.presence || a.slug.localeCompare(b.slug)),
  };
}

/**
 * Minimum picks to rank a win rate: 5% of the games, and at least ten.
 * Below that, two more wins move the rate by twenty points.
 */
export const minimumPicks = (games: number) => Math.max(10, Math.ceil(games * 0.05));

/** Top `n` heroes by a value, ties broken by slug for a stable order. */
function top(list: ProHero[], value: (h: ProHero) => number, n: number, keep: (h: ProHero) => boolean = () => true) {
  return list
    .filter(keep)
    .sort((a, b) => value(b) - value(a) || a.slug.localeCompare(b.slug))
    .slice(0, n);
}

export function proMeta(now = new Date(), n = 8) {
  const covered = metaTournaments(now);
  const { games, heroes } = combine(covered);
  const minimum = minimumPicks(games);
  return {
    tournaments: covered,
    games,
    heroes,
    minimum,
    picked: top(heroes, (h) => h.picks, n),
    banned: top(heroes, (h) => h.bans, n),
    winners: top(heroes, (h) => h.winRate ?? 0, n, (h) => h.picks >= minimum),
  };
}

// ─────────────────────────────────────────────────────────────
// Pro play vs ranked
// ─────────────────────────────────────────────────────────────

export interface ProVsRankedRow {
  slug: string;
  proPresence: number;
  proRank: number;
  /** Share of ranked games where the hero is picked or banned, in %. */
  rankedPresence: number;
  rankedRank: number;
  rankedWinRate: number;
  /** Places gained in pro compared with ranked (positive = more valued in pro). */
  gap: number;
}

/**
 * Presence in ranked games, in % of games. The game's pick rate is a share of
 * all picks (it sums to 100 over every hero): with ten picks per game, it is a
 * tenth of the share of games where the hero is picked. A hero cannot be both
 * picked and banned in the same game, so the two add up.
 */
export const rankedPresence = (r: { pickRate: number; banRate: number }) => Math.min(100, r.pickRate * 10 + r.banRate);

/** Rank of each value (1 = highest); ties share the rank. */
export function ranks(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.values()].sort((a, b) => b - a);
  return new Map([...values].map(([slug, v]) => [slug, sorted.indexOf(v) + 1]));
}

/**
 * Each hero is placed twice over the same list: by its pro presence and by
 * its ranked presence. The gap in places shows where one world values it far
 * more than the other. No comparison of raw percentages: ten bans per pro
 * game against a queue where bans are optional, the scales do not match;
 * ranks do.
 */
export function compareProRanked(
  pro: { slug: string; presence: number }[],
  ranked: { slug: string; pickRate: number; banRate: number; winRate: number }[],
): ProVsRankedRow[] {
  const proBySlug = new Map(pro.map((h) => [h.slug, h.presence]));
  const proRanks = ranks(new Map(ranked.map((r) => [r.slug, proBySlug.get(r.slug) ?? 0])));
  const rankedRanks = ranks(new Map(ranked.map((r) => [r.slug, rankedPresence(r)])));
  return ranked.map((r) => ({
    slug: r.slug,
    proPresence: proBySlug.get(r.slug) ?? 0,
    proRank: proRanks.get(r.slug)!,
    rankedPresence: rankedPresence(r),
    rankedRank: rankedRanks.get(r.slug)!,
    rankedWinRate: r.winRate,
    gap: rankedRanks.get(r.slug)! - proRanks.get(r.slug)!,
  }));
}

/** Pro presence needed to count as a "pro pick": one game in five. */
export const NOTABLE_PRO_PRESENCE = 20;
/** Ranked places needed to count as a ranked favorite. */
export const NOTABLE_RANKED_RANK = 25;

export function proVsRanked(now = new Date(), n = 8) {
  const { heroes, games } = combine(metaTournaments(now));
  const rows = compareProRanked(
    heroes,
    classementComplet.map((e) => ({ slug: e.hero.slug, pickRate: e.pickRate, banRate: e.banRate, winRate: e.winRate })),
  );
  return {
    games,
    total: rows.length,
    proFavorites: rows
      .filter((r) => r.proPresence >= NOTABLE_PRO_PRESENCE && r.gap > 0)
      .sort((a, b) => b.gap - a.gap || b.proPresence - a.proPresence)
      .slice(0, n),
    rankedFavorites: rows
      .filter((r) => r.rankedRank <= NOTABLE_RANKED_RANK && r.gap < 0)
      .sort((a, b) => a.gap - b.gap || b.rankedPresence - a.rankedPresence)
      .slice(0, n),
  };
}

// ─────────────────────────────────────────────────────────────
// One hero in pro play
// ─────────────────────────────────────────────────────────────

export interface HeroInPro extends ProHero {
  games: number;
  /** Presence rank among the heroes seen in pro play. */
  rank: number;
  /** Heroes seen in pro play, to put the rank in context. */
  heroesSeen: number;
  tournaments: Tournament[];
}

/** The hero in the pro meta, or `null` if it was never picked nor banned. */
export function heroInPro(slug: string, now = new Date()): HeroInPro | null {
  const covered = metaTournaments(now);
  const { games, heroes } = combine(covered);
  const h = heroes.find((x) => x.slug === slug);
  if (!h || games === 0) return null;
  return {
    ...h,
    games,
    rank: heroes.filter((x) => x.presence > h.presence).length + 1,
    heroesSeen: heroes.length,
    tournaments: covered.filter((t) => t.heroes.some((x) => x.slug === slug)),
  };
}
