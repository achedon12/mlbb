import type { BuildPlayed, BuildsHero } from "./data";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";

/**
 * Usage of a build choice — item, emblem, spell — read from the builds
 * actually played.
 *
 * Each hero publishes, by lane and by rank, its three most played builds
 * with their share of games (`selection`) and their win rate.
 * Turning these tables around gives what no item page says: who takes
 * this item, in which lane, and with what result.
 *
 * Pure functions, without imported data: tests pass them hand-made
 * builds.
 */

/** Keys of a build for the studied choice type (item slugs, emblem, spell). */
export type Extract = (b: BuildPlayed) => Iterable<string>;

export interface UsageHero {
  slug: string;
  /** Lane where the choice weighs the most for this hero. */
  lane: string;
  /** Share of the hero's games, in this lane, played with a build containing the choice (in %). */
  selection: number;
  /** Win rate of these builds, average weighted by their share (in %). */
  win: number | null;
}

/** Build accumulator: total share and weighted win rate. */
class Total {
  part = 0;
  private won = 0;
  private pese = 0;
  private raw: number[] = [];

  add(b: BuildPlayed) {
    const part = b.pickRate ?? 0;
    this.part += part;
    if (b.winRate === null) return;
    this.raw.push(b.winRate);
    if (part > 0) {
      this.won += b.winRate * part;
      this.pese += part;
    }
  }

  /** Without a known share, the simple average rather than no rate. */
  get win(): number | null {
    if (this.pese > 0) return this.won / this.pese;
    return this.raw.length ? this.raw.reduce((s, v) => s + v, 0) / this.raw.length : null;
  }
}

const byPart = (a: UsageHero, b: UsageHero) =>
  b.selection - a.selection || (b.win ?? 0) - (a.win ?? 0) || a.slug.localeCompare(b.slug);

/**
 * For each choice, the heroes that take it at the requested rank, the most committed
 * first. A hero appears only once, in the lane where the choice takes
 * the largest share of their games.
 */
export function usageByChoice(
  builds: Record<string, BuildsHero>,
  extract: Extract,
  rank: MeasuredRank = "all",
): Map<string, UsageHero[]> {
  const byChoice = new Map<string, Map<string, UsageHero>>();
  for (const [slug, byLane] of Object.entries(builds)) {
    for (const [lane, byRank] of Object.entries(byLane)) {
      const totals = new Map<string, Total>();
      for (const b of byRank[rank] ?? []) {
        // An item taken twice in the same build only counts once.
        for (const key of new Set(extract(b))) {
          const c = totals.get(key) ?? new Total();
          c.add(b);
          totals.set(key, c);
        }
      }
      for (const [key, c] of totals) {
        const byHero = byChoice.get(key) ?? new Map<string, UsageHero>();
        byChoice.set(key, byHero);
        const current = byHero.get(slug);
        if (!current || c.part > current.selection) {
          byHero.set(slug, { slug, lane, selection: c.part, win: c.win });
        }
      }
    }
  }
  return new Map([...byChoice].map(([key, byHero]) => [key, [...byHero.values()].sort(byPart)]));
}

export interface SummaryRank {
  rank: MeasuredRank;
  /** Number of heroes taking the choice at this rank. */
  heroes: number;
  /** Most committed hero at this rank. */
  first: UsageHero | null;
  /** Average win rate of the builds concerned, weighted by their share (in %). */
  win: number | null;
}

/** One row per measured rank, from the usages already computed for each. */
export function summaryByRank(usages: Partial<Record<MeasuredRank, UsageHero[]>>): SummaryRank[] {
  return MEASURED_RANKS.map((rank) => {
    const list = usages[rank] ?? [];
    let won = 0;
    let pese = 0;
    for (const u of list) {
      if (u.win === null || u.selection <= 0) continue;
      won += u.win * u.selection;
      pese += u.selection;
    }
    return { rank, heroes: list.length, first: list[0] ?? null, win: pese > 0 ? won / pese : null };
  });
}

export interface PartChoice {
  key: string;
  /** Share of the kept builds, weighted by their share of games (in %). */
  part: number;
}

/**
 * Distribution of a choice among builds that fill another one: the
 * talents taken with an emblem, the spells taken with it. Each build weighs its
 * share of games; a build without a known share weighs as the weakest.
 */
export function partsByChoice(
  builds: Record<string, BuildsHero>,
  keep: (b: BuildPlayed) => boolean,
  extract: Extract,
  rank: MeasuredRank = "all",
): PartChoice[] {
  const weight = new Map<string, number>();
  let total = 0;
  for (const byLane of Object.values(builds)) {
    for (const byRank of Object.values(byLane)) {
      for (const b of byRank[rank] ?? []) {
        if (!keep(b)) continue;
        const p = b.pickRate && b.pickRate > 0 ? b.pickRate : 0.01;
        total += p;
        for (const key of new Set(extract(b))) weight.set(key, (weight.get(key) ?? 0) + p);
      }
    }
  }
  if (total === 0) return [];
  return [...weight]
    .map(([key, p]) => ({ key, part: (p / total) * 100 }))
    .sort((a, b) => b.part - a.part || a.key.localeCompare(b.key));
}
