import { describe, expect, it } from "vitest";
import type { BuildPlayed, BuildsHero } from "@/lib/data";
import { partsByChoice, summaryByRank, usageByChoice } from "@/lib/usage-builds";
import { emblemsSheets, spellSheets, usage } from "@/lib/usage-sheets";
import { itemsFor } from "@/lib/data";

const build = (items: string[], pickRate: number | null, winRate: number | null, extra: Partial<BuildPlayed> = {}): BuildPlayed => ({
  items,
  emblem: "Assassin",
  talents: ["Thrill", "Seasoned Hunter", "Killing Spree"],
  spell: "Retribution",
  winRate,
  pickRate,
  ...extra,
});

const byItem = (b: BuildPlayed) => b.items;

const builds: Record<string, BuildsHero> = {
  aamon: {
    Jungle: {
      all: [build(["Lame", "Bottes"], 6, 54), build(["Lame", "Baton"], 2, 58), build(["Baton"], 4, 50)],
      mythic: [build(["Lame"], 5, 60)],
    },
    Mid: { all: [build(["Lame"], 3, 40)] },
  },
  gusion: {
    Jungle: { all: [build(["Lame", "Lame"], 10, 52)] },
  },
  miya: {
    Gold: { all: [build(["Bottes"], null, 51), build(["Bottes", "Arc"], null, 49)] },
  },
};

describe("usageByChoice", () => {
  const usages = usageByChoice(builds, byItem);

  it("sums the share of builds containing the item and weights their rate", () => {
    const aamon = usages.get("Lame")!.find((u) => u.slug === "aamon")!;
    expect(aamon.lane).toBe("Jungle");
    expect(aamon.selection).toBe(8);
    // (54 * 6 + 58 * 2) / 8
    expect(aamon.win).toBeCloseTo(55);
  });

  it("keeps the lane where the item weighs most, one row per hero", () => {
    const rows = usages.get("Lame")!.filter((u) => u.slug === "aamon");
    expect(rows).toHaveLength(1);
    expect(rows[0].lane).not.toBe("Mid");
  });

  it("ranks heroes from most to least committed", () => {
    expect(usages.get("Lame")!.map((u) => u.slug)).toEqual(["gusion", "aamon"]);
  });

  it("counts an item taken twice in the same build only once", () => {
    expect(usages.get("Lame")!.find((u) => u.slug === "gusion")!.selection).toBe(10);
  });

  it("falls back on the simple average when no share is known", () => {
    const miya = usages.get("Bottes")!.find((u) => u.slug === "miya")!;
    expect(miya.selection).toBe(0);
    expect(miya.win).toBeCloseTo(50);
  });

  it("reads the requested rank", () => {
    const mythic = usageByChoice(builds, byItem, "mythic");
    expect(mythic.get("Lame")).toEqual([{ slug: "aamon", lane: "Jungle", selection: 5, win: 60 }]);
    expect(mythic.get("Baton")).toBeUndefined();
  });
});

describe("summaryByRank", () => {
  it("gives one row per rank, with the top hero and a weighted rate", () => {
    const summary = summaryByRank({
      all: [
        { slug: "gusion", lane: "Jungle", selection: 10, win: 52 },
        { slug: "aamon", lane: "Jungle", selection: 5, win: 58 },
      ],
    });
    expect(summary).toHaveLength(6);
    expect(summary[0]).toMatchObject({ rank: "all", heroes: 2, first: { slug: "gusion" } });
    expect(summary[0].win).toBeCloseTo(54);
    expect(summary[1]).toEqual({ rank: "epic", heroes: 0, first: null, win: null });
  });
});

describe("partsByChoice", () => {
  it("spreads a choice across the kept builds, weighted by their share", () => {
    const parts = partsByChoice(
      { a: { Jungle: { all: [build([], 3, 50, { spell: "Flicker" }), build([], 1, 50), build([], 4, 50, { emblem: "Mage" })] } } },
      (b) => b.emblem === "Assassin",
      (b) => (b.spell ? [b.spell] : []),
    );
    expect(parts).toEqual([
      { key: "Flicker", part: 75 },
      { key: "Retribution", part: 25 },
    ]);
  });

  it("returns nothing without a kept build", () => {
    expect(partsByChoice(builds, () => false, byItem)).toEqual([]);
  });
});

describe("item, emblem and spell pages", () => {
  it("resolves the items of played builds to known items", () => {
    const slugs = new Set(itemsFor("en").map((o) => o.slug));
    const cited = itemsFor("en").filter((o) => usage("item", o.slug).length > 0);
    expect(cited.length).toBeGreaterThan(10);
    expect(cited.every((o) => slugs.has(o.slug))).toBe(true);
  });

  it("gives each emblem a short address and finds its heroes", () => {
    expect(emblemsSheets.map((e) => e.slug)).toEqual(["tank", "fighter", "assassin", "mage", "marksman", "support"]);
    expect(usage("emblem", "assassin").length).toBeGreaterThan(0);
  });

  it("covers described spells and those that builds only mention", () => {
    const slugs = spellSheets.map((s) => s.slug);
    expect(slugs).toContain("flicker");
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(usage("spell", "retribution").length).toBeGreaterThan(0);
  });
});
