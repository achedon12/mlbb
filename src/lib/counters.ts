import type { CountersByRank } from "./data";
import type { BucketDuration } from "./evolution";
import { profileDuration, type ProfileDuration } from "./composition";
import { LANES } from "./draft";
import { MEASURED_RANKS, type MeasuredRank } from "./measured-ranks";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { Lane, Role } from "./types";

/**
 * Logic of a hero's "counters" page: everything derived from the data,
 * without writing any prose. Pure module — no catalogue or file imported —
 * so it can be tested without loading the game data.
 */

/**
 * « d'Aamon », « de Gusion »: French possessive complement, elided before a
 * vowel. The "h" and "y" in game names are pronounced: no elision.
 */
export function frenchOf(name: string): string {
  return /^[aeiouàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`;
}

// ── Counters, all ranks combined ───────────────────────────────────

/** An opponent named in several ranks, with the hero's average gap against them. */
export interface AggregatedCounter {
  slug: string;
  /** Number of ranks where they appear among the largest gaps. */
  ranks: number;
  /** Average gap, in points, over those ranks (from the page hero's point of view). */
  average: number;
}

const rounded = (v: number) => Math.round(v * 10) / 10;

/**
 * Most pronounced opponents, all ranks combined. Rank buckets are read one
 * by one — `all` already aggregates them and would count twice — and `all`
 * is only used when there is no bucket. An opponent present in more ranks
 * comes first: it is a consistent counter, not a one-bucket fluke. On a tie,
 * the most pronounced average gap wins.
 */
export function aggregateCounters(byRank: CountersByRank, direction: "strong" | "weak"): AggregatedCounter[] {
  const buckets = MEASURED_RANKS.filter((r) => r !== "all" && byRank[r]);
  const readValues = buckets.length > 0 ? buckets : byRank.all ? (["all"] as const) : [];
  const total = new Map<string, { ranks: number; sum: number }>();
  for (const rank of readValues) {
    for (const e of byRank[rank]?.[direction] ?? []) {
      const c = total.get(e.slug) ?? { ranks: 0, sum: 0 };
      total.set(e.slug, { ranks: c.ranks + 1, sum: c.sum + e.advantage });
    }
  }
  return [...total]
    .map(([slug, c]) => ({ slug, ranks: c.ranks, average: rounded(c.sum / c.ranks) }))
    .sort(
      (a, b) =>
        b.ranks - a.ranks ||
        (direction === "strong" ? b.average - a.average : a.average - b.average) ||
        a.slug.localeCompare(b.slug),
    );
}

/** Rank of the summary sentence: Mythic, the reference rank for ranked players, otherwise all ranks. */
export function summaryRank(byRank: CountersByRank): MeasuredRank | null {
  if (byRank.mythic) return "mythic";
  if (byRank.all) return "all";
  return MEASURED_RANKS.find((r) => byRank[r]) ?? null;
}

// ── Summary sentence ───────────────────────────────────────────────

/** « +3,3 pts », « −4,3 pts »: signed gap, one decimal, in the locale's format. */
export function formatGap(locale: Locale, t: T, value: number): string {
  const n = new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  return `${n} ${t("counters.pts")}`;
}

/** « A, B et C », « A, B and C ». */
export function listNames(locale: Locale, names: string[]): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
}

/** "Gloo (−4.3 pts), Hayabusa and Silvanna": the first carries its gap, the others just their name. */
function head(locale: Locale, t: T, list: { name: string; advantage: number }[]): string {
  const [first, ...run] = list;
  return listNames(locale, [`${first.name} (${formatGap(locale, t, first.advantage)})`, ...run.map((e) => e.name)]);
}

/**
 * Summary sentence, built from measurements only: "In Mythic, Aamon struggles
 * most against Gloo (−4.3 pts), Hayabusa and Silvanna, and has the edge over
 * Cici (+3.1 pts) and Marcel." Three counters, two victims at most.
 */
export function summarySentence(
  locale: Locale,
  t: T,
  o: {
    name: string;
    rank: MeasuredRank;
    weak: { name: string; advantage: number }[];
    strong: { name: string; advantage: number }[];
  },
): string {
  const context =
    o.rank === "all"
      ? t("pages.heroCounters.allRanks")
      : t("pages.heroCounters.atRank", { rank: t(`measuredRanks.${o.rank}`) });
  const weak = [...o.weak].sort((a, b) => a.advantage - b.advantage).slice(0, 3);
  const strong = [...o.strong].sort((a, b) => b.advantage - a.advantage).slice(0, 2);
  if (weak.length === 0) return t("pages.heroCounters.noMeasure", { name: o.name });
  const variables = { context, name: o.name, weakAgainst: head(locale, t, weak) };
  return strong.length > 0
    ? t("pages.heroCounters.overview", { ...variables, strongAgainst: head(locale, t, strong) })
    : t("pages.heroCounters.overviewNoStrong", variables);
}

// ── Recommended items, by rule ─────────────────────────────────────

/**
 * Why an item is suggested. No win measurement behind it: a rule read from
 * the hero's page (damage type, role, specialties) and from their most
 * played build (lifesteal).
 */
export type ReasonItem = "magic" | "physical" | "attacks" | "healing" | "control";

/**
 * Reference items for each rule, by catalogue slug. Healing has one item per
 * equipment family — defense, physical, magic —: each player takes the one
 * that fits their build.
 */
export const ITEMS_BY_REASON: Record<ReasonItem, string[]> = {
  magic: ["athena-s-shield", "radiant-armor", "tough-boots"],
  physical: ["antique-cuirass", "warrior-boots"],
  attacks: ["blade-armor", "chastise-pauldron"],
  healing: ["dominance-ice", "sea-halberd", "necklace-of-durance"],
  control: ["tough-boots"],
};

export interface ProfileThreat {
  /** Wiki damage type ("Magic", "Physical", "Mixed"; the typo "Phyiscal" exists). */
  typeDamage: string | null;
  roles: Role[];
  /** Wiki specialties, in English ("Regen", "Crowd Control"). */
  specialties: string[];
  /** True when their most played build has lifesteal or spell vamp. */
  lifesteal: boolean;
}

/** Item bonuses that heal their wearer on each hit. */
export function hasLifesteal(bonus: (string | null)[]): boolean {
  return bonus.some((b) => !!b && /lifesteal|spell vamp/i.test(b));
}

/** Rules that apply to the hero, in display order. */
export function reasonsCounter(p: ProfileThreat): ReasonItem[] {
  const damage = (p.typeDamage ?? "").toLowerCase().replace("phyiscal", "physical");
  const reasons: ReasonItem[] = [];
  if (damage === "magic" || damage === "mixed") reasons.push("magic");
  if (damage === "physical" || damage === "mixed") reasons.push("physical");
  if (p.roles.includes("Marksman")) reasons.push("attacks");
  if (p.specialties.includes("Regen") || p.lifesteal) reasons.push("healing");
  if (p.specialties.some((s) => s === "Crowd Control" || s === "Control")) reasons.push("control");
  return reasons;
}

/**
 * Items to build against the hero, without duplicates: an item named by two
 * rules keeps the first. `exists` drops a slug gone from the catalogue after a sync.
 */
export function itemsCounter(p: ProfileThreat, exists: (slug: string) => boolean): { slug: string; reason: ReasonItem }[] {
  const seen = new Set<string>();
  return reasonsCounter(p).flatMap((reason) =>
    ITEMS_BY_REASON[reason].flatMap((slug) => {
      if (seen.has(slug) || !exists(slug)) return [];
      seen.add(slug);
      return [{ slug, reason }];
    }),
  );
}

// ── Match duration ─────────────────────────────────────────────────

export interface MomentsMatch {
  weak: BucketDuration;
  strong: BucketDuration;
  profile: ProfileDuration;
}

/** Duration bucket where the hero wins least, and the one where they win most. */
export function momentsMatch(buckets: BucketDuration[] | undefined): MomentsMatch | null {
  if (!buckets || buckets.length < 2) return null;
  const weak = buckets.reduce((m, x) => (x.winRate < m.winRate ? x : m));
  const strong = buckets.reduce((m, x) => (x.winRate > m.winRate ? x : m));
  if (weak === strong) return null;
  return { weak, strong, profile: profileDuration(buckets.map((x) => x.winRate)) };
}

// ── Counters by position ───────────────────────────────────────────

/**
 * Counters grouped by the position they play: the direct matchup on the
 * hero's lane first, then the other positions. A counter played in several
 * positions appears under each.
 */
export function countersByLane(
  counters: AggregatedCounter[],
  lanesOf: (slug: string) => Lane[],
  heroLanes: Lane[],
  max = 4,
): { lane: Lane; counters: AggregatedCounter[] }[] {
  const order = [...heroLanes, ...LANES.filter((l) => !heroLanes.includes(l))];
  return order
    .map((lane) => ({ lane, counters: counters.filter((c) => lanesOf(c.slug).includes(lane)).slice(0, max) }))
    .filter((g) => g.counters.length > 0);
}
