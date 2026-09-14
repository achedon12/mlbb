/**
 * Player profile analyses: roles and lanes, trend over matches, and what the
 * player's rank plays on their heroes.
 *
 * Pure computations, no network call, like `player-profile`: pages and tests
 * pass them responses already read by `player-api`.
 */
import type { ResolvedBuild } from "@/components/builds-by-rank";
import { buildsPlayed, counters, heroesBySlug, type BuildPlayed } from "./data";
import { GAME_LANE } from "./player-format";
import type { FrequentHero, MatchSummary } from "./player-api";
import { shownHero, type ShownHero, type HeroRow } from "./player-profile";
import type { MeasuredRank } from "./measured-ranks";
import type { Lane, Role } from "./types";
import { resolveBuild } from "./build-visuals";

// ─────────────────────────────────────────────────────────────
// Roles and lanes
// ─────────────────────────────────────────────────────────────

/** Below this, a role or lane is neither a strength nor a weakness: too few matches. */
export const MATCHES_MIN_ROLE = 10;

export interface RowRole<C extends string> {
  key: C;
  matches: number;
  wins: number;
  /** Win rate, in points. */
  rate: number;
  /** Share of counted matches, in points. */
  part: number;
}

export interface SummaryRoles<C extends string> {
  /** From most to least played. */
  rows: RowRole<C>[];
  /** Base of the match share. */
  total: number;
  /** Matches that could not be attached to anything: hero unknown to the site, missing lane. */
  excluded: number;
  /** Best and weakest rates among those played at least `MATCHES_MIN_ROLE` times. */
  strong: C | null;
  weak: C | null;
}

type Counters<C extends string> = Map<C, { matches: number; wins: number }>;

function add<C extends string>(tallies: Counters<C>, key: C, matches: number, wins: number) {
  const c = tallies.get(key) ?? { matches: 0, wins: 0 };
  c.matches += matches;
  c.wins += wins;
  tallies.set(key, c);
}

function summaryRoles<C extends string>(tallies: Counters<C>, total: number, excluded: number): SummaryRoles<C> {
  const rows = [...tallies]
    .filter(([, c]) => c.matches > 0)
    .map(([key, c]) => ({
      key,
      matches: c.matches,
      wins: c.wins,
      rate: (c.wins / c.matches) * 100,
      part: total > 0 ? (c.matches / total) * 100 : 0,
    }))
    .sort((a, b) => b.matches - a.matches || b.rate - a.rate);

  // On equal rates, the most played wins: its rate is the most reliable.
  const kept = rows.filter((l) => l.matches >= MATCHES_MIN_ROLE);
  const strong = [...kept].sort((a, b) => b.rate - a.rate || b.matches - a.matches)[0];
  const weak = [...kept].sort((a, b) => a.rate - b.rate || b.matches - a.matches)[0];
  const contrast = kept.length >= 2 && strong.rate > weak.rate;
  return { rows, total, excluded, strong: contrast ? strong.key : null, weak: contrast ? weak.key : null };
}

const sheetOf = (h: MatchSummary["hero"]) => {
  const slug = shownHero(h).slug;
  return slug ? heroesBySlug.get(slug) : undefined;
};

/**
 * Season matches by hero role, according to the site catalogue. A hero with
 * two roles counts in each: the shares can add up to more than a hundred.
 * A hero unknown to the site is left out rather than guessed.
 */
export function statsByRole(frequents: FrequentHero[]): SummaryRoles<Role> {
  const tallies: Counters<Role> = new Map();
  let total = 0;
  let excluded = 0;
  for (const f of frequents) {
    if (f.matches <= 0) continue;
    total += f.matches;
    const roles = sheetOf(f.hero)?.roles ?? [];
    if (roles.length === 0) excluded += f.matches;
    for (const role of new Set(roles)) add(tallies, role, f.matches, f.wins);
  }
  return summaryRoles(tallies, total, excluded);
}

/**
 * Lane played, match by match. The service provides it (`lid`); failing that,
 * a hero with a single lane in the catalogue lends it. A match with an unknown
 * outcome does not count: it would say nothing about the rate.
 */
export function positionOf(p: MatchSummary): Lane | null {
  if (p.lane !== null && GAME_LANE[p.lane]) return GAME_LANE[p.lane];
  const lanes = sheetOf(p.hero)?.lanes ?? [];
  return lanes.length === 1 ? lanes[0] : null;
}

export function statsByPosition(matches: MatchSummary[]): SummaryRoles<Lane> {
  const tallies: Counters<Lane> = new Map();
  let counted = 0;
  let excluded = 0;
  for (const p of matches) {
    if (p.win === null) continue;
    const lane = positionOf(p);
    if (!lane) {
      excluded++;
      continue;
    }
    counted++;
    add(tallies, lane, 1, p.win ? 1 : 0);
  }
  return summaryRoles(tallies, counted, excluded);
}

// ─────────────────────────────────────────────────────────────
// Trend over matches
// ─────────────────────────────────────────────────────────────

/** Matches in the rolling average, and in the recent "form". */
export const WINDOW_SHAPE = 10;

export interface Series {
  win: boolean;
  length: number;
}

export interface Evolution {
  /** Matches whose outcome is known. */
  matches: number;
  wins: number;
  /** Ongoing streak, starting from the most recent match. */
  ongoingSeries: Series | null;
  /** Longest win and loss streaks. */
  bestStreak: number;
  worstStreak: number;
  /** Rate over the last `WINDOW_SHAPE` matches; null if there are fewer. */
  shape: number | null;
  /**
   * Curve, from oldest to most recent match, starting at the first full
   * window: one date (UTC day) per match, the rolling rate and the cumulative
   * rate. null without two points, or without dates.
   */
  curve: { dates: string[]; rolling: number[]; cumulative: number[] } | null;
}

const dayUtc = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * Day of each match. A match without a date takes that of its older neighbour,
 * or failing that its newer one: the curve needs one date per point, and the
 * service's order is authoritative. null if no match is dated.
 */
function datesOf(timer: MatchSummary[]): string[] | null {
  const known = timer.map((p) => (p.date !== null && Number.isFinite(p.date) ? dayUtc(p.date) : null));
  const first = known.find((d) => d !== null);
  if (!first) return null;
  let previous = first;
  return known.map((d) => (previous = d ?? previous));
}

/**
 * Trend over the history read, newest to oldest as the service returns it.
 * Matches with an unknown outcome are skipped: they do not break a streak.
 */
export function evolution(matches: MatchSummary[], window = WINDOW_SHAPE): Evolution {
  const timer = matches.filter((p) => p.win !== null).reverse();
  const issues = timer.map((p) => p.win === true);
  const n = issues.length;

  let bestStreak = 0;
  let worstStreak = 0;
  let current = null as Series | null;
  for (const v of issues) {
    current = { win: v, length: current?.win === v ? current.length + 1 : 1 };
    if (v) bestStreak = Math.max(bestStreak, current.length);
    else worstStreak = Math.max(worstStreak, current.length);
  }

  const rolling: number[] = [];
  const cumulative: number[] = [];
  let won = 0;
  let inWindow = 0;
  issues.forEach((v, i) => {
    won += v ? 1 : 0;
    inWindow += v ? 1 : 0;
    if (i >= window) inWindow -= issues[i - window] ? 1 : 0;
    if (i >= window - 1) {
      rolling.push((inWindow / window) * 100);
      cumulative.push((won / (i + 1)) * 100);
    }
  });

  const dates = datesOf(timer);
  return {
    matches: n,
    wins: won,
    ongoingSeries: current,
    bestStreak,
    worstStreak,
    shape: n >= window ? rolling.at(-1)! : null,
    curve: dates && rolling.length >= 2 ? { dates: dates.slice(window - 1), rolling, cumulative } : null,
  };
}

// ─────────────────────────────────────────────────────────────
// What the rank plays
// ─────────────────────────────────────────────────────────────

export interface CounterHard {
  hero: ShownHero;
  /** Win rate gap of the player's hero against it, in points (negative). */
  advantage: number;
}

export interface HeroRankSheet {
  row: HeroRow & { hero: { slug: string } };
  /** Lane of the chosen build. */
  lane: Lane | null;
  build: ResolvedBuild | null;
  /** Rank the build comes from: the player's, or all ranks as a fallback. */
  rankBuild: MeasuredRank | null;
  weak: CounterHard[];
  rankCounters: MeasuredRank | null;
}

/** Hero from the site sheet, ready to display. */
function shownOnSite(slug: string): ShownHero | null {
  const h = heroesBySlug.get(slug);
  return h ? { slug: h.slug, name: h.name, portrait: h.images.portrait } : null;
}

/**
 * Lane to use for a hero's builds: the one where the player played it most
 * recently, if the rank has builds there; otherwise the first catalogue lane
 * that has some, then the first measured one.
 */
function laneOfPlayer(slug: string, available: string[], recent: MatchSummary[]): string | null {
  const played = new Map<string, number>();
  for (const p of recent) {
    const lane = p.lane !== null ? GAME_LANE[p.lane] : undefined;
    if (lane && shownHero(p.hero).slug === slug) played.set(lane, (played.get(lane) ?? 0) + 1);
  }
  const preferred = [...played].sort((a, b) => b[1] - a[1]).find(([l]) => available.includes(l));
  if (preferred) return preferred[0];
  const catalog = heroesBySlug.get(slug)?.lanes.find((l) => available.includes(l));
  return catalog ?? available[0] ?? null;
}

/** Most played first: the highest share of matches. */
const bySelection = (a: BuildPlayed, b: BuildPlayed) => (b.pickRate ?? -1) - (a.pickRate ?? -1);

/** The requested rank, or all ranks combined as a fallback. */
function atRank<V>(byRank: Partial<Record<MeasuredRank, V>> | undefined, bucket: MeasuredRank) {
  if (byRank?.[bucket] !== undefined) return { value: byRank[bucket]!, rank: bucket };
  if (byRank?.all !== undefined) return { value: byRank.all, rank: "all" as MeasuredRank };
  return null;
}

/**
 * For the most played heroes: the most played build at their rank — the
 * highest share of matches — and the heroes that trouble it most at that
 * rank. A hero with none of these measures is skipped.
 */
export function heroRankSheets(
  rows: HeroRow[],
  bucket: MeasuredRank,
  recent: MatchSummary[],
  howMany = 3,
): HeroRankSheet[] {
  const sheets: HeroRankSheet[] = [];
  for (const row of rows) {
    if (sheets.length >= howMany) break;
    const slug = row.hero.slug;
    if (!slug) continue;

    const byLane = buildsPlayed[slug] ?? {};
    const lane = laneOfPlayer(slug, Object.keys(byLane), recent);
    const builds = lane ? atRank(byLane[lane], bucket) : null;
    const mostPlayed = [...(builds?.value ?? [])].sort(bySelection)[0];

    const measure = atRank(counters[slug], bucket);
    const weak = [...(measure?.value.weak ?? [])]
      .filter((c) => c.advantage < 0)
      .sort((a, b) => a.advantage - b.advantage)
      .flatMap((c) => {
        const hero = shownOnSite(c.slug);
        return hero ? [{ hero, advantage: c.advantage }] : [];
      })
      .slice(0, 3);

    if (!mostPlayed && weak.length === 0) continue;
    sheets.push({
      row: { ...row, hero: { ...row.hero, slug } },
      lane: mostPlayed ? (lane as Lane) : null,
      build: mostPlayed ? resolveBuild(mostPlayed) : null,
      rankBuild: mostPlayed ? builds!.rank : null,
      weak,
      rankCounters: weak.length > 0 ? measure!.rank : null,
    });
  }
  return sheets;
}
