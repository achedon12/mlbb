import { describe, expect, it } from "vitest";
import { changesOfTier, groupAdjustments, firstNBy, type SeriesTier } from "@/lib/meta-report";
import type { Tier } from "@/lib/types";

/** Simplified rule: the score is the win rate, three tiers. */
const rule = {
  score: (t: { winRate: number; banRate: number }) => t.winRate,
  tier: (s: number): Tier => (s >= 53 ? "S" : s >= 50 ? "A" : "B"),
};

/** Eight days of measures, interpolated from the rate seven days ago to today's rate. */
const series = (before: number, after: number): SeriesTier => ({
  start: "2026-09-04",
  winRate: Array.from({ length: 8 }, (_, k) => Math.round((before + ((after - before) * k) / 7) * 10) / 10),
  banRate: Array.from({ length: 8 }, () => 5),
});

describe("tier changes", () => {
  it("spots rises and drops, strongest first", () => {
    const { climbs, drops } = changesOfTier(
      [
        { slug: "monte", series: series(51, 53.5), tierCurrent: "S" },
        { slug: "bond", series: series(49, 54), tierCurrent: "S" },
        { slug: "chute", series: series(52, 49), tierCurrent: "B" },
        { slug: "stable", series: series(51, 52), tierCurrent: "A" },
      ],
      rule,
    );
    expect(climbs.map((c) => [c.slug, c.before, c.after, c.gap])).toEqual([
      ["bond", "B", "S", 2],
      ["monte", "A", "S", 1],
    ]);
    expect(drops.map((c) => [c.slug, c.before, c.after, c.gap])).toEqual([["chute", "A", "B", -1]]);
    expect(climbs[0].days).toBe(7);
  });

  it("drops a change the displayed ranking does not confirm", () => {
    const { climbs } = changesOfTier([{ slug: "borne", series: series(51, 53), tierCurrent: "A" }], rule);
    expect(climbs).toEqual([]);
  });

  it("says nothing without a series, without a D-7 reference or without a measured ban", () => {
    const short: SeriesTier = { start: "2026-09-09", winRate: [50, 51, 54], banRate: [5, 5, 5] };
    const withoutBan: SeriesTier = { ...series(49, 54), banRate: Array.from({ length: 8 }, () => null) };
    const result = changesOfTier(
      [
        { slug: "rien", series: null, tierCurrent: "S" },
        { slug: "courte", series: short, tierCurrent: "S" },
        { slug: "sans-ban", series: withoutBan, tierCurrent: "S" },
      ],
      rule,
    );
    expect(result).toEqual({ climbs: [], drops: [] });
  });
});

describe("patch summary", () => {
  it("groups heroes by direction, each only once, with an unknown type among the adjustments", () => {
    const groups = groupAdjustments([
      { slug: "a", type: "buff" },
      { slug: "b", type: "nerf" },
      { slug: "a", type: "adjust" },
      { slug: "c", type: null },
      { slug: "d", type: "adjust" },
    ]);
    expect(groups.buff.map((x) => x.slug)).toEqual(["a"]);
    expect(groups.nerf.map((x) => x.slug)).toEqual(["b"]);
    expect(groups.adjust.map((x) => x.slug)).toEqual(["c", "d"]);
  });
});

describe("top by a measure", () => {
  it("sorts from highest to lowest, ties by slug, without mutating the input", () => {
    const entries = [
      { hero: { slug: "b" }, ban: 10 },
      { hero: { slug: "a" }, ban: 10 },
      { hero: { slug: "c" }, ban: 30 },
    ];
    expect(firstNBy(entries, (e) => e.ban, 2).map((e) => e.hero.slug)).toEqual(["c", "a"]);
    expect(entries[0].hero.slug).toBe("b");
  });
});
