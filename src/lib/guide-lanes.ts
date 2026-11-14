import type { BuildPlayed, BuildsHero } from "./data";
import type { MeasuredRank } from "./measured-ranks";
import type { Lane } from "./types";

/**
 * What a lane plays, read from the builds actually played.
 *
 * Each hero publishes, by lane and rank, its most played builds with their
 * share of the hero's games. A lane's guide wants the other view: across every
 * hero played there, which items, spells, emblems and talents come back the
 * most. Each hero weighs by how much it is played (its pick rate), so that an
 * item bought by one hero nobody picks does not outrank an item every popular
 * hero builds.
 *
 * Pure functions, without imported data: tests pass them hand-made builds.
 */

export type KitPart = "items" | "spells" | "emblems" | "talents";

export interface KitChoice {
  /** The game's English name, as the builds name it ("Flicker", "Mage"). */
  name: string;
  /** Share of the lane's measured builds that contain it, in %. */
  share: number;
}

export type LaneKit = Record<KitPart, KitChoice[]>;

const EXTRACT: Record<KitPart, (b: BuildPlayed) => string[]> = {
  items: (b) => b.items,
  spells: (b) => (b.spell ? [b.spell] : []),
  emblems: (b) => (b.emblem ? [b.emblem] : []),
  talents: (b) => b.talents,
};

/**
 * The most common choices of a lane, by part, the most frequent first.
 * `weights` gives each hero's weight (its pick rate); a hero without one
 * does not count.
 */
export function laneKit(
  builds: Record<string, BuildsHero>,
  weights: Record<string, number | undefined>,
  lane: Lane,
  rank: MeasuredRank = "all",
): LaneKit {
  const totals: Record<KitPart, Map<string, number>> = {
    items: new Map(),
    spells: new Map(),
    emblems: new Map(),
    talents: new Map(),
  };
  let mass = 0;
  for (const [slug, byLane] of Object.entries(builds)) {
    const weight = weights[slug] ?? 0;
    const list = byLane[lane]?.[rank] ?? [];
    if (weight <= 0 || list.length === 0) continue;
    for (const b of list) {
      const part = (b.pickRate ?? 0) * weight;
      if (part <= 0) continue;
      mass += part;
      for (const kind of Object.keys(EXTRACT) as KitPart[]) {
        // An item bought twice, or a talent listed twice, counts once per build.
        for (const name of new Set(EXTRACT[kind](b))) {
          totals[kind].set(name, (totals[kind].get(name) ?? 0) + part);
        }
      }
    }
  }
  const ranked = (m: Map<string, number>): KitChoice[] =>
    [...m]
      .map(([name, value]) => ({ name, share: mass > 0 ? (value / mass) * 100 : 0 }))
      .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
  return {
    items: ranked(totals.items),
    spells: ranked(totals.spells),
    emblems: ranked(totals.emblems),
    talents: ranked(totals.talents),
  };
}

/** How many choices of each part a guide shows: enough to read a trend, not a catalogue. */
export const KIT_SIZE: Record<KitPart, number> = { items: 6, spells: 3, emblems: 2, talents: 4 };

/** Below this share, a choice is noise rather than a habit of the lane. */
export const KIT_MIN_SHARE = 5;

/** The choices a guide shows: the most common ones, above the noise floor. */
export function shownKit(kit: LaneKit): LaneKit {
  const keep = (part: KitPart) => kit[part].filter((c) => c.share >= KIT_MIN_SHARE).slice(0, KIT_SIZE[part]);
  return { items: keep("items"), spells: keep("spells"), emblems: keep("emblems"), talents: keep("talents") };
}
