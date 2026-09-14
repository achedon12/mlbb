/**
 * Ranked tier scale, from Warrior to Mythic Immortal.
 *
 * Two sources, which agree:
 *
 * - divisions and `rank_level` ranges: the game's official table, as
 *   returned by the statistics API (`/api/academy/ranks`, 29 entries, retrieved
 *   on September 11, 2026). It is the table `ranks.ts` takes its thresholds from; the
 *   tests check that both stay aligned;
 * - stars per division, mythic points, draft, bans and star points:
 *   the "Ranked" page of the Fandom wiki (accessed on September 11, 2026).
 *
 * A division covers `starsMax + 1` rank_levels (from 0 to max stars), except
 * Warrior II and I, which cover three: you enter them with one star.
 *
 * End-of-season rewards come from the "Season Rank Rewards" page
 * of the same wiki: amounts from a past season, to be presented as such.
 */
import { readableRank } from "./ranks";
import type { MeasuredRank } from "./measured-ranks";

export const SOURCES_RANKS = {
  ranked: "https://mobilelegends.fandom.com/wiki/Ranked",
  rewards: "https://mobilelegends.fandom.com/wiki/Season_Rank_Rewards",
  table: "https://arena.rone.dev/api/academy/ranks",
} as const;

export interface TierScale {
  /** Emblem and label key (`rankNames.*`). */
  key: string;
  /** Divisions, from lowest to highest; empty in the Mythic family. */
  divisions: string[];
  /** Maximum stars per division; null in the Mythic family, which counts points. */
  starsMax: number | null;
  /** Mythic points of the tier, bounds included; `max` null for the last one. */
  points: { min: number; max: number | null } | null;
  /** rank_level range from the official table; `end` null for the last tier. */
  rankLevel: { start: number; end: number | null };
  /** Rank bracket for which the game publishes measurements, if any. */
  measure: MeasuredRank | null;
  /** Tier family, for shared rules (draft, star points). */
  family: FamilyRank;
}

export type FamilyRank = "warrior" | "elite" | "master" | "grandmaster" | "epic" | "legend" | "mythic";

export const SCALE: TierScale[] = [
  {
    key: "warrior",
    divisions: ["III", "II", "I"],
    starsMax: 3,
    points: null,
    rankLevel: { start: 1, end: 10 },
    measure: null,
    family: "warrior",
  },
  {
    key: "elite",
    divisions: ["III", "II", "I"],
    starsMax: 4,
    points: null,
    rankLevel: { start: 11, end: 25 },
    measure: null,
    family: "elite",
  },
  {
    key: "master",
    divisions: ["IV", "III", "II", "I"],
    starsMax: 4,
    points: null,
    rankLevel: { start: 26, end: 45 },
    measure: null,
    family: "master",
  },
  {
    key: "grandmaster",
    divisions: ["V", "IV", "III", "II", "I"],
    starsMax: 5,
    points: null,
    rankLevel: { start: 46, end: 75 },
    measure: null,
    family: "grandmaster",
  },
  {
    key: "epic",
    divisions: ["V", "IV", "III", "II", "I"],
    starsMax: 5,
    points: null,
    rankLevel: { start: 76, end: 105 },
    measure: "epic",
    family: "epic",
  },
  {
    key: "legend",
    divisions: ["V", "IV", "III", "II", "I"],
    starsMax: 5,
    points: null,
    rankLevel: { start: 106, end: 135 },
    measure: "legend",
    family: "legend",
  },
  {
    key: "mythic",
    divisions: [],
    starsMax: null,
    points: { min: 0, max: 24 },
    rankLevel: { start: 136, end: 160 },
    measure: "mythic",
    family: "mythic",
  },
  {
    key: "mythic-honor",
    divisions: [],
    starsMax: null,
    points: { min: 25, max: 49 },
    rankLevel: { start: 161, end: 185 },
    measure: "honor",
    family: "mythic",
  },
  {
    key: "mythic-glory",
    divisions: [],
    starsMax: null,
    points: { min: 50, max: 99 },
    rankLevel: { start: 186, end: 235 },
    measure: "glory",
    family: "mythic",
  },
  {
    key: "mythic-immortal",
    divisions: [],
    starsMax: null,
    points: { min: 100, max: null },
    rankLevel: { start: 236, end: null },
    measure: null,
    family: "mythic",
  },
];

/** Color and emblem of a tier: those from `ranks.ts`, except Legend, which is not listed there. */
export function tierAppearance(p: TierScale): { color: string; image: string | null } {
  const r = readableRank(p.rankLevel.start);
  return { color: r.color, image: r.image };
}

/**
 * Rules per family, "Ranked" page: the draft opens at Epic V, with 3,
 * 4 then 5 bans per team in Epic, Legend and Mythic; climb
 * points grant one extra star at 100%, protection points prevent
 * losing one. The Mythic family has no climb points.
 */
export const RULES_FAMILY: Record<
  FamilyRank,
  { bans: number | null; climbPoints: number | null; pointsProtection: number }
> = {
  warrior: { bans: null, climbPoints: 100, pointsProtection: 100 },
  elite: { bans: null, climbPoints: 200, pointsProtection: 200 },
  master: { bans: null, climbPoints: 300, pointsProtection: 300 },
  "grandmaster": { bans: null, climbPoints: 500, pointsProtection: 500 },
  epic: { bans: 3, climbPoints: 700, pointsProtection: 700 },
  legend: { bans: 4, climbPoints: 1000, pointsProtection: 1000 },
  mythic: { bans: 5, climbPoints: null, pointsProtection: 1500 },
};

/**
 * End-of-season rewards by final rank, "Season Rank Rewards" page:
 * battle points, tickets and premium fragments. Amounts from a past
 * season; the game sometimes adjusts them.
 */
export const REWARDS_SEASON: {
  family: FamilyRank;
  battlePoints: number;
  tickets: number;
  fragments: number | null;
  emblem?: boolean;
}[] = [
  { family: "warrior", battlePoints: 500, tickets: 50, fragments: 1 },
  { family: "elite", battlePoints: 1000, tickets: 100, fragments: 3 },
  { family: "master", battlePoints: 2000, tickets: 150, fragments: null },
  { family: "grandmaster", battlePoints: 3500, tickets: 300, fragments: null },
  { family: "epic", battlePoints: 6500, tickets: 500, fragments: null },
  { family: "legend", battlePoints: 10000, tickets: 750, fragments: null },
  { family: "mythic", battlePoints: 10000, tickets: 750, fragments: null, emblem: true },
];

/** First tier of the family, to display its name and emblem. */
export function tierOfFamily(family: FamilyRank): TierScale {
  return SCALE.find((p) => p.family === family)!;
}
