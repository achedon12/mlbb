import { describe, expect, it } from "vitest";
import { coreItemsFor, countersFor, moversFor, patchChangesFor } from "@/lib/tier-list-extras";
import type { BuildPlayed, BuildsHero, CountersByRank } from "@/lib/data";

const counter = (slug: string, advantage: number) => ({ slug, advantage });
const build = (items: string[]): BuildPlayed => ({
  items,
  emblem: null,
  talents: [],
  spell: null,
  winRate: 50,
  pickRate: 10,
});

describe("a hero's counters in its preview", () => {
  const byRank: CountersByRank = {
    all: { strong: [], weak: [counter("saber", -4), counter("natalia", -3), counter("lukas", -2), counter("gone", -1)], winRate: 50 },
    mythic: { strong: [], weak: [counter("natalia", -5), counter("gone", -4)], winRate: 50 },
  };
  const known = (s: string) => s !== "gone";

  it("takes the page's rank, and drops heroes the catalogue does not know", () => {
    expect(countersFor(byRank, "mythic", known)).toEqual(["natalia"]);
  });

  it("falls back on all ranks when the rank was not measured", () => {
    expect(countersFor(byRank, "epic", known)).toEqual(["saber", "natalia", "lukas"]);
  });

  it("is empty for a hero without counters", () => {
    expect(countersFor(undefined, "all", known)).toEqual([]);
  });
});

describe("a hero's core items in its preview", () => {
  const byLane: BuildsHero = {
    Exp: { all: [build(["a", "b", "c", "d"])] },
    Jungle: { all: [build(["j1", "j2", "j3"])], mythic: [build(["m1", "m2", "m3"])] },
  };

  it("takes the page's lane, at the page's rank, three items", () => {
    expect(coreItemsFor(byLane, ["Exp", "Jungle"], "Jungle", "mythic")).toEqual(["m1", "m2", "m3"]);
    expect(coreItemsFor(byLane, ["Exp", "Jungle"], "Exp", "all")).toEqual(["a", "b", "c"]);
  });

  it("falls back on the hero's first lane with a build, and on all ranks", () => {
    expect(coreItemsFor(byLane, ["Gold", "Jungle"], "Gold", "epic")).toEqual(["j1", "j2", "j3"]);
    expect(coreItemsFor(byLane, ["Roam"], null, "all")).toEqual(["a", "b", "c"]);
  });

  it("is empty without a build", () => {
    expect(coreItemsFor(undefined, ["Exp"], null, "all")).toEqual([]);
  });
});

describe("the week's movers of a list", () => {
  const series = (from: number, to: number) => ({
    start: "2026-11-01",
    winRate: [from, from, from, from, (from + to) / 2, to, to, to],
  });
  const all: Record<string, ReturnType<typeof series>> = {
    up: series(50, 52),
    flat: series(50, 50.1),
    down: series(52, 50.5),
  };

  it("ranks rises and drops apart, ignoring rounding noise", () => {
    const { rises, drops } = moversFor(Object.keys(all), (s) => all[s]);
    expect(rises.map((m) => m.slug)).toEqual(["up"]);
    expect(drops.map((m) => m.slug)).toEqual(["down"]);
    expect(rises[0].variation.gap).toBe(2);
  });
});

describe("the heroes a patch touched in a list", () => {
  it("keeps the ranking's order and lists each hero once", () => {
    const adjustments = [
      { slug: "b", type: "nerf" as const },
      { slug: "x", type: "buff" as const },
      { slug: "a", type: "buff" as const },
      { slug: "b", type: "adjust" as const },
    ];
    expect(patchChangesFor(adjustments, ["a", "b", "c"])).toEqual([
      { slug: "a", type: "buff" },
      { slug: "b", type: "nerf" },
    ]);
    expect(patchChangesFor(undefined, ["a"])).toEqual([]);
  });
});
