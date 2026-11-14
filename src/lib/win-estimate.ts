import { assignLanes, breakdownDamage, MIN_ALERTS, THRESHOLDS, type Gap, type MeasuresRank, type TypeDamage } from "./composition";
import { LANES, type DraftHero } from "./draft";
import type { Side } from "./draft-simulation";
import type { Lane } from "./types";

/**
 * Estimated win probability of a draft, while it is being played.
 *
 * Five factors, each a number of win-rate points from the blue side's point
 * of view (positive: blue ahead):
 *
 * - strength: the heroes' own win rate at the rank, as a gap to 50 %;
 * - counters: the duels between the two line-ups, measured at the rank, or a
 *   flat value when only the wiki names the relation;
 * - synergy: the pairs inside each team, same conventions;
 * - composition: a hero with no free lane, a team with no tank;
 * - damage: a team dealing almost a single damage type.
 *
 * Each factor is multiplied by its weight, the products are added into one
 * edge, and a logistic curve turns the edge into a probability. Equal teams
 * (and an empty draft) give 50 %; the result never leaves 25-75 %, because
 * a draft alone does not decide a match. Pure module: no data import, it runs
 * in the browser and is tested without the game catalogue.
 */

export type FactorKey = "strength" | "counters" | "synergy" | "composition" | "damage";
export const FACTORS: readonly FactorKey[] = ["strength", "counters", "synergy", "composition", "damage"];

/**
 * Weight of each factor. Win rates, duels and duos all overlap (a hero's win
 * rate already includes the duels it usually plays): adding them at full
 * value would count the same matches several times, so they are halved. The
 * composition and damage penalties are already written in edge points.
 */
export const WEIGHTS: Record<FactorKey, number> = { strength: 0.5, counters: 0.5, synergy: 0.5, composition: 1, damage: 1 };

/** Points given to a relation only the wiki names (no measurement at the rank). */
export const WIKI_COUNTER = 1;
export const WIKI_SYNERGY = 0.5;
/** Penalties, in edge points. Two heroes for one lane is the costliest mistake of a draft. */
export const PENALTIES = { lane: 4, tank: 1.5, damage: 1.5 };

/**
 * Logit per edge point: 0.04 makes one point of edge worth about one point of
 * probability around 50 %, the slope of the logistic curve there being 1/4.
 */
export const LOGIT_PER_POINT = 0.04;
export const BOUNDS = { min: 0.25, max: 0.75 };

/** What the model reads from a hero. */
export type EstimateHero = Pick<DraftHero, "slug" | "lanes" | "roles" | "win" | "strongAgainst" | "weakAgainst" | "synergies"> & {
  damage: TypeDamage | null;
};

/** Roster and measurements, indexed once for the many estimates of a turn. */
export interface EstimateContext {
  bySlug: Map<string, EstimateHero>;
  /** Win rate at the rank, else the all-ranks one; null when unknown. */
  rate: (slug: string) => number | null;
  /** `hero`'s gap when it loses to `opponent` (negative), measured at the rank. */
  loses: (hero: string, opponent: string) => number | null;
  /** What `hero` gains with `partner` (positive), measured at the rank. */
  gains: (hero: string, partner: string) => number | null;
  measured: boolean;
}

const index = (lists: Record<string, Gap[]> | undefined) => {
  const map = new Map<string, Map<string, number>>();
  for (const [slug, list] of Object.entries(lists ?? {})) map.set(slug, new Map(list));
  return (a: string, b: string) => map.get(a)?.get(b) ?? null;
};

export function estimateContext(catalog: EstimateHero[], measures: MeasuresRank | null): EstimateContext {
  const bySlug = new Map(catalog.map((h) => [h.slug, h]));
  const loses = index(measures?.weak);
  const gainsRaw = index(measures?.teammates);
  return {
    bySlug,
    rate: (slug) => measures?.stats[slug]?.[0] ?? bySlug.get(slug)?.win ?? null,
    loses: (h, o) => {
      const v = loses(h, o);
      return v !== null && v < 0 ? v : null;
    },
    gains: (h, p) => {
      const v = gainsRaw(h, p);
      return v !== null && v > 0 ? v : null;
    },
    measured: measures !== null,
  };
}

/** Rounded half away from zero: the same draft seen from the other side gives the opposite figures. */
const round1 = (v: number) => (Math.sign(v) * Math.round(Math.abs(v) * 10)) / 10 + 0;
const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);

/** One duel between a blue hero and a red one; `points` from blue's side. */
export interface DuelEdge {
  blue: string;
  red: string;
  points: number;
  measured: boolean;
}

/** `hero`'s edge over `opponent`: the measured reads averaged, else the wiki relation, else null. */
export function duelEdge(ctx: EstimateContext, hero: string, opponent: string): { points: number; measured: boolean } | null {
  const heroLoses = ctx.loses(hero, opponent);
  const opponentLoses = ctx.loses(opponent, hero);
  const reads = [heroLoses, opponentLoses === null ? null : -opponentLoses].filter((v): v is number => v !== null);
  if (reads.length > 0) return { points: sum(reads) / reads.length, measured: true };
  const h = ctx.bySlug.get(hero);
  const o = ctx.bySlug.get(opponent);
  if (!h || !o) return null;
  const wins = h.strongAgainst.includes(opponent) || o.weakAgainst.includes(hero);
  const suffers = h.weakAgainst.includes(opponent) || o.strongAgainst.includes(hero);
  if (wins === suffers) return null;
  return { points: wins ? WIKI_COUNTER : -WIKI_COUNTER, measured: false };
}

export interface PairEdge {
  a: string;
  b: string;
  points: number;
  measured: boolean;
}

/** What two teammates gain together: the best measured direction, else a known synergy, else null. */
export function pairEdge(ctx: EstimateContext, a: string, b: string): { points: number; measured: boolean } | null {
  const reads = [ctx.gains(a, b), ctx.gains(b, a)].filter((v): v is number => v !== null);
  if (reads.length > 0) return { points: Math.max(...reads), measured: true };
  const x = ctx.bySlug.get(a);
  const y = ctx.bySlug.get(b);
  if (!x || !y) return null;
  return x.synergies.includes(b) || y.synergies.includes(a) ? { points: WIKI_SYNERGY, measured: false } : null;
}

/** What one team's picks say on their own. */
export interface TeamFactors {
  /** Heroes the catalogue knows, in pick order. */
  slugs: string[];
  strength: number;
  /** Win rate of each pick with one; null for the others. */
  rates: { slug: string; rate: number | null }[];
  synergy: number;
  pairs: PairEdge[];
  composition: number;
  /** Heroes with no free lane. */
  laneConflicts: string[];
  noTank: boolean;
  damage: number;
  /** Dominant damage type when the team deals almost only one. */
  oneDamage: "physical" | "magic" | null;
}

export function teamFactors(ctx: EstimateContext, picks: string[]): TeamFactors {
  const slugs = [...new Set(picks)].filter((s) => ctx.bySlug.has(s));
  const team = slugs.map((s) => ctx.bySlug.get(s)!);
  const rates = slugs.map((slug) => ({ slug, rate: ctx.rate(slug) }));
  const pairs: PairEdge[] = [];
  slugs.forEach((a, i) => {
    for (const b of slugs.slice(i + 1)) {
      const e = pairEdge(ctx, a, b);
      if (e) pairs.push({ a, b, ...e });
    }
  });
  const { extra } = assignLanes(team);
  // Same rules as the team analyzer's alerts: judged from three heroes.
  const noTank = team.length >= MIN_ALERTS && !team.some((h) => h.roles.includes("Tank"));
  const d = breakdownDamage(team);
  const typed = d.physical + d.magic + d.mixed;
  const oneDamage =
    typed >= MIN_ALERTS && d.physicalShare !== null
      ? d.physicalShare >= THRESHOLDS.damage
        ? "physical"
        : d.physicalShare <= 1 - THRESHOLDS.damage
          ? "magic"
          : null
      : null;
  return {
    slugs,
    rates,
    strength: sum(rates.map((r) => (r.rate === null ? 0 : r.rate - 50))),
    synergy: sum(pairs.map((p) => p.points)),
    pairs: pairs.sort((x, y) => y.points - x.points),
    composition: -(extra.length * PENALTIES.lane + (noTank ? PENALTIES.tank : 0)),
    laneConflicts: extra,
    noTank,
    damage: oneDamage ? -PENALTIES.damage : 0,
    oneDamage,
  };
}

export type Confidence = "low" | "medium" | "high";

export interface Estimate {
  /** Blue's win probability, between `BOUNDS.min` and `BOUNDS.max`. */
  blue: number;
  red: number;
  /** Weighted edge in points, blue's side; the logistic curve's input. */
  edge: number;
  /** Weighted contribution of each factor to the edge, blue's side. */
  factors: Record<FactorKey, number>;
  teams: Record<Side, TeamFactors>;
  /** Duels between the line-ups, most one-sided first. */
  duels: DuelEdge[];
  /** True when the clamp cut the curve's value. */
  clamped: boolean;
  confidence: Confidence;
  /** Picks the estimate rests on, both sides. */
  picks: number;
}

export const logistic = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Confidence of the estimate: it says how much of the draft is known, not how
 * right the model is. Below four picks, low; from eight, high, unless the
 * rank's measurements are missing (only the wiki and the all-ranks rates are
 * read then), which takes one level off.
 */
export function confidenceOf(picks: number, measured: boolean): Confidence {
  const level = picks < 4 ? 0 : picks < 8 ? 1 : 2;
  const levels: Confidence[] = ["low", "medium", "high"];
  return levels[Math.max(0, level - (measured ? 0 : 1))];
}

export function estimate(ctx: EstimateContext, blue: string[], red: string[]): Estimate {
  const teams = { blue: teamFactors(ctx, blue), red: teamFactors(ctx, red) };
  // A hero picked on both sides (impossible in a legal draft) counts for neither.
  const both = new Set(teams.blue.slugs.filter((s) => teams.red.slugs.includes(s)));
  if (both.size > 0) {
    teams.blue = teamFactors(ctx, teams.blue.slugs.filter((s) => !both.has(s)));
    teams.red = teamFactors(ctx, teams.red.slugs.filter((s) => !both.has(s)));
  }
  const duels: DuelEdge[] = [];
  for (const b of teams.blue.slugs) {
    for (const r of teams.red.slugs) {
      const e = duelEdge(ctx, b, r);
      if (e) duels.push({ blue: b, red: r, ...e });
    }
  }
  duels.sort((x, y) => Math.abs(y.points) - Math.abs(x.points) || x.blue.localeCompare(y.blue) || x.red.localeCompare(y.red));

  const raw: Record<FactorKey, number> = {
    strength: teams.blue.strength - teams.red.strength,
    counters: sum(duels.map((d) => d.points)),
    synergy: teams.blue.synergy - teams.red.synergy,
    composition: teams.blue.composition - teams.red.composition,
    damage: teams.blue.damage - teams.red.damage,
  };
  const factors = Object.fromEntries(FACTORS.map((k) => [k, round1(raw[k] * WEIGHTS[k])])) as Record<FactorKey, number>;
  const edge = sum(FACTORS.map((k) => raw[k] * WEIGHTS[k]));
  const curve = logistic(LOGIT_PER_POINT * edge);
  const p = Math.min(BOUNDS.max, Math.max(BOUNDS.min, curve));
  const picks = teams.blue.slugs.length + teams.red.slugs.length;
  return {
    blue: p,
    red: 1 - p,
    edge: round1(edge),
    factors,
    teams,
    duels,
    clamped: p !== curve,
    confidence: confidenceOf(picks, ctx.measured),
    picks,
  };
}

/** Probabilities as whole percentages adding up to 100. */
export function percentages(e: Pick<Estimate, "blue">): Record<Side, number> {
  const blue = Math.round(e.blue * 100);
  return { blue, red: 100 - blue };
}

// -- Next pick ----------------------------------------------------------

/** Why a pick is suggested; the sentence is built in the page language. */
export type PickReason =
  | { type: "counter"; targets: string[]; points: number; measured: boolean }
  | { type: "duo"; partners: string[]; points: number; measured: boolean }
  | { type: "strength"; rate: number }
  | { type: "lane"; lane: Lane }
  | { type: "tank" }
  | { type: "damage"; damage: TypeDamage };

export interface PickSuggestion {
  slug: string;
  /** The side's win probability with this pick. */
  probability: number;
  /** Change brought by the pick, in probability (0.03: three points). */
  delta: number;
  /** Lane the hero would take; null when every one of its lanes is taken. */
  lane: Lane | null;
  /** The pick's strongest arguments, at most two. */
  reasons: PickReason[];
}

/**
 * Best next picks for a side: every hero still available is added to the
 * side's picks and the estimate is recomputed; the ones that raise the side's
 * probability the most come first. Heroes that add a lane are kept, as long
 * as some do: the lane penalty already says it, the filter makes it certain.
 */
export function suggestPicks(
  ctx: EstimateContext,
  { side, picks, excluded, limit = 3 }: { side: Side; picks: Record<Side, string[]>; excluded: Set<string>; limit?: number },
): PickSuggestion[] {
  const allies = picks[side];
  const enemies = picks[side === "blue" ? "red" : "blue"];
  const of = (e: Estimate) => (side === "blue" ? e.blue : e.red);
  const before = estimate(ctx, picks.blue, picks.red);
  const team = allies.flatMap((s) => (ctx.bySlug.has(s) ? [ctx.bySlug.get(s)!] : []));
  const filledBefore = LANES.length - assignLanes(team).missing.length;
  const taken = new Set([...excluded, ...picks.blue, ...picks.red]);

  const scored = [...ctx.bySlug.values()]
    .filter((h) => !taken.has(h.slug))
    .map((h) => {
      const next = { ...picks, [side]: [...allies, h.slug] } as Record<Side, string[]>;
      const after = estimate(ctx, next.blue, next.red);
      const assignment = assignLanes([...team, h]);
      const fills = LANES.length - assignment.missing.length > filledBefore;
      const lane = LANES.find((l) => assignment.lanes[l] === h.slug) ?? null;
      // Unclamped edge for the ranking: near the bounds the probability no
      // longer moves, the edge still tells the picks apart.
      const edge = side === "blue" ? after.edge : -after.edge;
      return { h, after, fills, lane, edge };
    });
  const useful = scored.some((s) => s.fills) ? scored.filter((s) => s.fills) : scored;
  return useful
    .sort((a, b) => b.edge - a.edge || a.h.slug.localeCompare(b.h.slug))
    .slice(0, limit)
    .map(({ h, after, lane }) => ({
      slug: h.slug,
      probability: of(after),
      delta: of(after) - of(before),
      lane,
      reasons: pickReasons(ctx, h, { allies, enemies, lane, before: before.teams[side], after: after.teams[side] }),
    }));
}

function pickReasons(
  ctx: EstimateContext,
  h: EstimateHero,
  o: { allies: string[]; enemies: string[]; lane: Lane | null; before: TeamFactors; after: TeamFactors },
): PickReason[] {
  const out: { reason: PickReason; weight: number }[] = [];
  const duels = o.enemies.flatMap((e) => {
    const d = duelEdge(ctx, h.slug, e);
    return d && d.points > 0 ? [{ e, ...d }] : [];
  });
  if (duels.length > 0) {
    const points = sum(duels.map((d) => d.points));
    out.push({
      reason: { type: "counter", targets: duels.map((d) => d.e), points: round1(points), measured: duels.some((d) => d.measured) },
      weight: points * WEIGHTS.counters,
    });
  }
  const pairs = o.allies.flatMap((a) => {
    const p = pairEdge(ctx, h.slug, a);
    return p ? [{ a, ...p }] : [];
  });
  if (pairs.length > 0) {
    const points = sum(pairs.map((p) => p.points));
    out.push({
      reason: { type: "duo", partners: pairs.map((p) => p.a), points: round1(points), measured: pairs.some((p) => p.measured) },
      weight: points * WEIGHTS.synergy,
    });
  }
  const rate = ctx.rate(h.slug);
  if (rate !== null && rate > 50) out.push({ reason: { type: "strength", rate: round1(rate) }, weight: (rate - 50) * WEIGHTS.strength });
  const tankless = !o.allies.some((a) => ctx.bySlug.get(a)?.roles.includes("Tank"));
  if (h.roles.includes("Tank") && tankless && o.allies.length > 0) out.push({ reason: { type: "tank" }, weight: PENALTIES.tank });
  if (o.before.oneDamage && !o.after.oneDamage && h.damage) out.push({ reason: { type: "damage", damage: h.damage }, weight: PENALTIES.damage });
  const reasons = out.sort((a, b) => b.weight - a.weight).slice(0, 2).map((r) => r.reason);
  // Nothing else to say: the lane it takes is still an argument.
  if (reasons.length === 0 && o.lane) reasons.push({ type: "lane", lane: o.lane });
  return reasons;
}
