/**
 * Player profile: their figures, compared with the site's.
 *
 * The service provides the matches and heroes played; the site knows each
 * hero's win rate in each rank bracket. Combining both places the player
 * against other players of their level, and yields a few simple tips.
 * Everything is computed here, with no network call: pages and tests pass
 * responses already read by `player-api`.
 */
import { allHeroes } from "./data";
import type { FrequentHero, GameHero, Participant, MatchSummary } from "./player-api";
import { readableRank } from "./ranks";
import type { MeasuredRank } from "./measured-ranks";
import { statsByRank } from "./tier-list";
import { keySearch } from "./utils";

/** Hero ready to display: the site sheet when it exists, otherwise what the service says. */
export interface ShownHero {
  slug: string | null;
  name: string;
  portrait: string | null;
}

const keyName = (name: string) => keySearch(name).replace(/[^a-z0-9]/g, "");

/**
 * Game ID to site sheet. The wiki numbers heroes like the game, followed by a
 * digit: Fanny, game hero 17, is "171"; Miya, hero 1, "011".
 */
const BY_HID = new Map(allHeroes.map((h) => [Math.floor(Number(h.id) / 10), h]));
const BY_NAME = new Map(allHeroes.map((h) => [keyName(h.name), h]));

export function shownHero(h: GameHero): ShownHero {
  // Name first: a new hero numbered differently must not borrow another
  // one. The ID catches diverging spellings.
  const site = BY_NAME.get(keyName(h.name)) ?? BY_HID.get(h.hid);
  if (!site) return { slug: null, name: h.name, portrait: h.image };
  return { slug: site.slug, name: site.name, portrait: site.images.portrait ?? h.image };
}

/**
 * Measurement bracket of the player's rank.
 *
 * The site measures heroes from Epic to Mythic Glory. Below that, no bracket
 * matches: the comparison is against all ranks combined. Immortal, beyond the
 * last measured bracket, is compared with Glory.
 */
const BUCKETS: Partial<Record<string, MeasuredRank>> = {
  epic: "epic",
  legend: "legend",
  mythic: "mythic",
  "mythic-honor": "honor",
  "mythic-glory": "glory",
  "mythic-immortal": "glory",
};

export function bucketOfRank(rankLevel: number): MeasuredRank {
  if (!Number.isFinite(rankLevel) || rankLevel < 1) return "all";
  return BUCKETS[readableRank(rankLevel).key] ?? "all";
}

/** A hero's win rate in the bracket, or all ranks combined as a fallback. */
export function averageOfRank(slug: string, bucket: MeasuredRank): { win: number; bucket: MeasuredRank } | null {
  const stats = statsByRank(slug);
  const kept = stats[bucket] ? bucket : stats.all ? "all" : null;
  return kept ? { win: stats[kept]!.winRate, bucket: kept } : null;
}

export interface HeroRow {
  hero: ShownHero;
  matches: number;
  wins: number;
  /** Player's win rate, in points (0 to 100). */
  rate: number;
  /** Hero's win rate among all players of the bracket, in points. */
  average: number | null;
  bucketAverage: MeasuredRank | null;
  /** Player's rate minus the average, in points. */
  gap: number | null;
  note: number | null;
}

/** Heroes played, from most to least played, each against the bracket average. */
export function compareHeroes(frequents: FrequentHero[], bucket: MeasuredRank): HeroRow[] {
  return frequents
    .filter((f) => f.matches > 0)
    .map((f) => {
      const shown = shownHero(f.hero);
      const rate = (f.wins / f.matches) * 100;
      const average = shown.slug ? averageOfRank(shown.slug, bucket) : null;
      return {
        hero: shown,
        matches: f.matches,
        wins: f.wins,
        rate,
        average: average?.win ?? null,
        bucketAverage: average?.bucket ?? null,
        gap: average ? rate - average.win : null,
        note: f.note,
      };
    })
    .sort((a, b) => b.matches - a.matches || b.wins - a.wins);
}

export interface SummarySeason {
  matches: number;
  wins: number;
  /** Win rate, in points; null without matches. */
  rate: number | null;
  heroes: number;
}

/** Season summary, summed over heroes played: the service does not provide it ready-made. */
export function summarySeason(frequents: FrequentHero[]): SummarySeason {
  const matches = frequents.reduce((n, f) => n + f.matches, 0);
  const wins = frequents.reduce((n, f) => n + f.wins, 0);
  return { matches, wins, rate: matches ? (wins / matches) * 100 : null, heroes: frequents.length };
}

/** Below this, a win rate on a hero says nothing yet. */
export const MATCHES_MIN = 5;
/** Gap from the average, in points, from which a hero is flagged. */
export const MARGIN_POINTS = 3;

/**
 * Lower bound of the Wilson interval (90%). Ranks heroes by what their rate
 * guarantees rather than what it shows: 5 wins in 5 matches rank behind 17
 * in 20.
 */
function boundLow(wins: number, matches: number): number {
  if (matches === 0) return 0;
  const z = 1.645;
  const p = wins / matches;
  const z2 = z * z;
  const center = p + z2 / (2 * matches);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * matches)) / matches);
  return (center - margin) / (1 + z2 / matches);
}

/** Heroes that win games for the player, played enough to be credible. */
export function bestHero(rows: HeroRow[], howMany = 3): HeroRow[] {
  return rows
    .filter((l) => l.matches >= MATCHES_MIN && l.rate > 50)
    .sort((a, b) => boundLow(b.wins, b.matches) - boundLow(a.wins, a.matches))
    .slice(0, howMany);
}

/**
 * Heroes clearly below the bracket average. Ranked by excess matches lost —
 * the gap times the number of matches: a slightly weak but heavily played
 * hero costs more than a one-off failure.
 */
export function belowAverageHeroes(rows: HeroRow[], howMany = 3): HeroRow[] {
  const missing = (l: HeroRow) => (-(l.gap ?? 0) * l.matches) / 100;
  return rows
    .filter((l) => l.matches >= MATCHES_MIN && l.gap !== null && l.gap <= -MARGIN_POINTS)
    .sort((a, b) => missing(b) - missing(a))
    .slice(0, howMany);
}

/** Number of recent matches whose details are read to spot opponents. */
export const ANALYZED_MATCHES = 12;

export interface AnalyzedMatch {
  /** Outcome according to the match list; failing that, the details' one. */
  win: boolean | null;
  participants: Participant[];
}

export interface Nemesis {
  hero: ShownHero;
  defeats: number;
  encounters: number;
}

/**
 * Opposing heroes that keep showing up in the player's losses.
 *
 * The player is found in the details by their ID; their team identifies, by
 * elimination, the opponents. A match where they do not appear, or without
 * teams, is ignored rather than guessed. A hero is only kept from two losses
 * on: a single one does not make a trend.
 */
export function nemeses(
  matches: AnalyzedMatch[],
  me: { roleId: number; zoneId: number },
  howMany = 3,
): { list: Nemesis[]; analyzed: number } {
  const counters = new Map<number, { hero: GameHero; defeats: number; encounters: number }>();
  let analyzed = 0;

  for (const match of matches) {
    const own = match.participants.find(
      (p) => p.roleId === me.roleId && (p.zoneId === null || p.zoneId === me.zoneId),
    );
    const win = match.win ?? own?.win ?? null;
    if (!own || own.team === null || win === null) continue;

    const opponents = match.participants.filter((p) => p.team !== null && p.team !== own.team);
    if (opponents.length === 0) continue;
    analyzed++;

    const seen = new Set<number>();
    for (const a of opponents) {
      if (seen.has(a.hero.hid)) continue;
      seen.add(a.hero.hid);
      const c = counters.get(a.hero.hid) ?? { hero: a.hero, defeats: 0, encounters: 0 };
      c.encounters++;
      if (!win) c.defeats++;
      counters.set(a.hero.hid, c);
    }
  }

  const list = [...counters.values()]
    .filter((c) => c.defeats >= 2)
    .sort((a, b) => b.defeats - a.defeats || b.defeats / b.encounters - a.defeats / a.encounters)
    .slice(0, howMany)
    .map((c) => ({ hero: shownHero(c.hero), defeats: c.defeats, encounters: c.encounters }));

  return { list, analyzed };
}

/** Match ready to display, sendable as is to the browser. */
export interface MatchShown {
  id: string;
  hero: ShownHero;
  win: boolean | null;
  eliminations: number;
  deaths: number;
  assists: number;
  note: number | null;
  mvp: boolean;
  lane: number | null;
  date: number | null;
}

export function showMatch(p: MatchSummary): MatchShown {
  return {
    id: p.id,
    hero: shownHero(p.hero),
    win: p.win,
    eliminations: p.eliminations,
    deaths: p.deaths,
    assists: p.assists,
    note: p.note,
    mvp: p.mvp,
    lane: p.lane,
    date: p.date,
  };
}
