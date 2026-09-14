import type { Teammate, CounterFigure, CountersByRank } from "./data";
import type { Duo, DuosByRank } from "./duos";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";

/**
 * Logic of the hero pair pages: head-to-head (`/compare/a-vs-b`) and
 * duos (`/heroes/{slug}/duos`). Pure module — no data file imported, only
 * types — so it can be tested without loading the game.
 */

// ── Pair address ───────────────────────────────────────────────────

export const SEPARATOR_PAIR = "-vs-";

/** Canonical order of a pair: alphabetical by slug. */
export const orderPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

/** "aamon-vs-fanny", whatever the order given. */
export const segmentPair = (a: string, b: string) => orderPair(a, b).join(SEPARATOR_PAIR);

/** Locale-less path of the head-to-head page. */
export const pathPair = (a: string, b: string) => `/compare/${segmentPair(a, b)}`;

/**
 * The two slugs of an "a-vs-b" segment. Slugs contain hyphens
 * ("x-borg", "yi-sun-shin") but never "-vs-". Null for a malformed segment
 * or a hero set against itself; `canonical` tells whether the order is right.
 */
export function readPair(segment: string): { a: string; b: string; canonical: boolean } | null {
  const i = segment.indexOf(SEPARATOR_PAIR);
  if (i <= 0) return null;
  const a = segment.slice(0, i);
  const b = segment.slice(i + SEPARATOR_PAIR.length);
  if (!b || a === b || b.includes(SEPARATOR_PAIR)) return null;
  return { a, b, canonical: a < b };
}

const lists = (m: { strong?: CounterFigure[]; weak?: CounterFigure[] } | undefined) => [
  ...(m?.strong ?? []),
  ...(m?.weak ?? []),
];

/**
 * Pairs with a measured duel: b is among a's most marked gaps (`strong` or
 * `weak` lists), or the reverse, in at least one rank. Canonical segments,
 * sorted. `exists` rules out a hero missing from the catalogue.
 */
export function pairsMeasured(counters: Record<string, CountersByRank>, exists: (slug: string) => boolean): string[] {
  return [...ranksByPair(counters, exists).keys()].sort();
}

/** Number of ranks in which each pair is measured, in either direction. */
export function ranksByPair(
  counters: Record<string, CountersByRank>,
  exists: (slug: string) => boolean,
): Map<string, number> {
  const views = new Map<string, Set<string>>();
  for (const [a, byRank] of Object.entries(counters)) {
    if (!exists(a)) continue;
    for (const r of MEASURED_RANKS) {
      for (const e of lists(byRank[r])) {
        if (e.slug === a || !exists(e.slug)) continue;
        const segment = segmentPair(a, e.slug);
        views.set(segment, (views.get(segment) ?? new Set()).add(r));
      }
    }
  }
  return new Map([...views].map(([segment, ranks]) => [segment, ranks.size]));
}

/**
 * A hero's opponents with a measured duel, with the most marked gap recorded
 * between them, in either direction, in absolute value: from the most
 * one-sided duel to the closest.
 */
export function measuredOpponents(counters: Record<string, CountersByRank>, slug: string): { slug: string; gap: number }[] {
  const gaps = new Map<string, number>();
  const rate = (other: string, v: number) => gaps.set(other, Math.max(gaps.get(other) ?? 0, Math.abs(v)));
  for (const r of MEASURED_RANKS) {
    for (const e of lists(counters[slug]?.[r])) if (e.slug !== slug) rate(e.slug, e.advantage);
  }
  for (const [other, byRank] of Object.entries(counters)) {
    if (other === slug) continue;
    for (const r of MEASURED_RANKS) for (const e of lists(byRank[r])) if (e.slug === slug) rate(other, e.advantage);
  }
  return [...gaps]
    .map(([s, gap]) => ({ slug: s, gap }))
    .sort((x, y) => y.gap - x.gap || x.slug.localeCompare(y.slug));
}

// ── Head-to-head ───────────────────────────────────────────────────

const rounded = (v: number) => Math.round(v * 10) / 10;
const average = (values: number[]) =>
  values.length > 0 ? rounded(values.reduce((s, v) => s + v, 0) / values.length) : null;

/** Duel of two heroes in a rank, from `a`'s point of view. */
export interface DuelRank {
  rank: MeasuredRank;
  /** Change in a's win rate when facing b, read from a's lists (points). */
  aAgainstB: number | null;
  /** Change in b's win rate when facing a, read from b's lists. */
  bAgainstA: number | null;
  /**
   * a's advantage, in points: aAgainstB and the negation of bAgainstA, averaged
   * when both are measured. Positive means a has the upper hand.
   */
  advantage: number;
}

export function duelByRank(counters: Record<string, CountersByRank>, a: string, b: string): DuelRank[] {
  const gap = (x: string, y: string, r: MeasuredRank) => lists(counters[x]?.[r]).find((e) => e.slug === y)?.advantage ?? null;
  return MEASURED_RANKS.flatMap((rank) => {
    const aAgainstB = gap(a, b, rank);
    const bAgainstA = gap(b, a, rank);
    const views = [aAgainstB, bAgainstA === null ? null : -bAgainstA].filter((v): v is number => v !== null);
    const advantage = average(views);
    return advantage === null ? [] : [{ rank, aAgainstB, bAgainstA, advantage }];
  });
}

/** Rank of the summary: Mythic, the reference rank for ranked players, else all ranks, else the first measured. */
export function duelOfReference(duels: DuelRank[]): DuelRank | null {
  return duels.find((d) => d.rank === "mythic") ?? duels.find((d) => d.rank === "all") ?? duels[0] ?? null;
}

/** Gap below which a duel counts as balanced, in points. */
export const THRESHOLD_BALANCE = 0.3;

/** Band ranks (excluding "all ranks") where each side has the upper hand. */
export function ranksWon(duels: DuelRank[]): { a: number; b: number; total: number } {
  const buckets = duels.filter((d) => d.rank !== "all");
  return {
    a: buckets.filter((d) => d.advantage >= THRESHOLD_BALANCE).length,
    b: buckets.filter((d) => d.advantage <= -THRESHOLD_BALANCE).length,
    total: buckets.length,
  };
}

// ── Match phases ───────────────────────────────────────────────────

export type Phase = "early" | "mid" | "late";
export const PHASES: readonly Phase[] = ["early", "mid", "late"];

/** Start minutes of a duo's buckets, in file order (BUCKETS_DUO, scripts/measures.mjs). */
export const STARTS_BUCKETS_DUO = [10, 12, 14, 16, 18, 20] as const;

/** Early game: 10 to 14 minutes; mid: 14 to 18; late: 18 and beyond. */
export const phaseOf = (minutes: number): Phase => (minutes < 14 ? "early" : minutes < 18 ? "mid" : "late");

interface Bucket {
  from: number;
  winRate: number | null;
}

/** Average rate of each phase of a duration curve; null for a phase with no bucket. */
export function rateByPhase(buckets: Bucket[] | undefined): Record<Phase, number | null> {
  const byPhase = (phase: Phase) =>
    average((buckets ?? []).flatMap((t) => (t.winRate !== null && phaseOf(t.from) === phase ? [t.winRate] : [])));
  return { early: byPhase("early"), mid: byPhase("mid"), late: byPhase("late") };
}

/** A duo's buckets, from the array aligned on STARTS_BUCKETS_DUO to timed buckets. */
export const bucketsDuo = (phases: (number | null)[] | undefined): Bucket[] =>
  (phases ?? []).slice(0, STARTS_BUCKETS_DUO.length).map((winRate, i) => ({ from: STARTS_BUCKETS_DUO[i], winRate }));

export interface PhaseDuo {
  phase: Phase;
  /** The duo's win rate over the phase, in %. */
  win: number;
  /**
   * Gain over the hero alone at the same duration and rank, in points:
   * average of the bucket-by-bucket gaps, where both are measured.
   */
  gain: number | null;
}

export function phasesDuo(phases: (number | null)[] | undefined, heroBuckets: Bucket[] | undefined): PhaseDuo[] {
  const alone = new Map((heroBuckets ?? []).flatMap((t) => (t.winRate === null ? [] : [[t.from, t.winRate] as const])));
  return PHASES.flatMap((phase) => {
    const duo = bucketsDuo(phases).filter((t): t is { from: number; winRate: number } => t.winRate !== null && phaseOf(t.from) === phase);
    if (duo.length === 0) return [];
    const gaps = duo.flatMap((t) => (alone.has(t.from) ? [t.winRate - alone.get(t.from)!] : []));
    return [{ phase, win: average(duo.map((t) => t.winRate))!, gain: average(gaps) }];
  });
}

/**
 * Best partner of each phase: the highest gain over the hero alone,
 * or the highest rate when a candidate has no measurable gain.
 */
export function bestByPhase(duos: Duo[], heroBuckets: Bucket[] | undefined): ({ slug: string } & PhaseDuo)[] {
  return PHASES.flatMap((phase) => {
    const candidates = duos.flatMap((d) => {
      const p = phasesDuo(d.phases, heroBuckets).find((x) => x.phase === phase);
      return p ? [{ slug: d.slug, ...p }] : [];
    });
    if (candidates.length === 0) return [];
    const byGain = candidates.every((c) => c.gain !== null);
    const key = (c: PhaseDuo) => (byGain ? c.gain! : c.win);
    return [candidates.reduce((m, c) => (key(c) > key(m) ? c : m))];
  });
}

/** Two heroes against match duration: each one's rate per phase, and the gap a − b. */
export function phasesDuel(
  ta: Bucket[] | undefined,
  tb: Bucket[] | undefined,
): { phase: Phase; a: number | null; b: number | null; gap: number | null }[] {
  const pa = rateByPhase(ta);
  const pb = rateByPhase(tb);
  return PHASES.map((phase) => ({
    phase,
    a: pa[phase],
    b: pb[phase],
    gap: pa[phase] !== null && pb[phase] !== null ? rounded(pa[phase]! - pb[phase]!) : null,
  }));
}

/** Phase most favourable to a (highest gap, positive) and to b (lowest, negative). */
export function readPhases(duel: ReturnType<typeof phasesDuel>): { a: Phase | null; b: Phase | null } {
  const measures = duel.filter((p): p is typeof p & { gap: number } => p.gap !== null);
  const top = measures.reduce<(typeof measures)[number] | null>((m, p) => (!m || p.gap > m.gap ? p : m), null);
  const bottom = measures.reduce<(typeof measures)[number] | null>((m, p) => (!m || p.gap < m.gap ? p : m), null);
  return { a: top && top.gap > 0 ? top.phase : null, b: bottom && bottom.gap < 0 ? bottom.phase : null };
}

// ── Same team ──────────────────────────────────────────────────────

/** Duos in counters format: `strong` for the best partners, `weak` for the worst. */
export function duosAsCounters(byRank: DuosByRank): CountersByRank {
  return Object.fromEntries(
    Object.entries(byRank).flatMap(([r, d]) => (d ? [[r, { strong: d.best, weak: d.worst, winRate: d.winRate }]] : [])),
  );
}

export interface LinkTeam {
  rank: MeasuredRank;
  /** Hero whose rate changes. */
  from: string;
  /** Teammate who makes it change. */
  partner: string;
  advantage: number;
  source: "duos" | "teammates";
}

/**
 * What each one gains or loses playing with the other, rank by rank: duos
 * (compatibility) first, academy teammates as a fallback.
 */
export function linksTeam(
  duos: Record<string, DuosByRank>,
  teammates: Record<string, Partial<Record<MeasuredRank, Teammate[]>>>,
  a: string,
  b: string,
): LinkTeam[] {
  return MEASURED_RANKS.flatMap((rank) =>
    [
      [a, b],
      [b, a],
    ].flatMap(([hero, partner]): LinkTeam[] => {
      const d = duos[hero]?.[rank];
      const duo = [...(d?.best ?? []), ...(d?.worst ?? [])].find((e) => e.slug === partner);
      if (duo) return [{ rank, from: hero, partner, advantage: duo.advantage, source: "duos" }];
      const c = teammates[hero]?.[rank]?.find((e) => e.slug === partner);
      return c ? [{ rank, from: hero, partner, advantage: c.advantage, source: "teammates" }] : [];
    }),
  );
}
