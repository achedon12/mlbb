import { describe, expect, it } from "vitest";
import type { Catalog, SkinCatalog } from "@/lib/skin-catalog";
import {
  summaryCollection,
  compareRarity,
  coveragePrice,
  writeOwnership,
  readOwnership,
  skinsCollectible,
} from "@/lib/collection";

const skin = (p: Partial<SkinCatalog> & { id: string; hero: string }): SkinCatalog => ({
  name: `Skin ${p.id}`,
  rarity: 1,
  series: null,
  release: "2024-01-01",
  availability: "Available",
  price: {},
  acquisition: null,
  image: null,
  anchor: "",
  ...p,
});

/** Two heroes: one sold for diamonds and battle points, the other for battle points only. */
const catalog: Catalog = {
  maj: "2026-09-11",
  heroes: [
    { slug: "miya", name: "Miya", roles: ["Marksman"], icon: null },
    { slug: "balmond", name: "Balmond", roles: ["Fighter"], icon: null },
  ],
  skins: [
    skin({ id: "m0", hero: "miya", rarity: 0, price: { dm: 599, bp: 32000 } }),
    skin({ id: "m1", hero: "miya", rarity: 6, series: "Legend", price: { mc: 200 } }),
    skin({ id: "m2", hero: "miya", rarity: 4, series: "Epic", price: { dm: 899 } }),
    skin({ id: "m3", hero: "miya", rarity: 1, price: { dm: 269 } }),
    skin({ id: "b0", hero: "balmond", rarity: 0, price: { bp: 6500 } }),
    skin({ id: "b1", hero: "balmond", rarity: 3, series: "StarLight", availability: "Limited", acquisition: "2019/02 StarLight Member" }),
    skin({ id: "b2", hero: "balmond", rarity: 4, series: "Epic", availability: "Upcoming", release: "202X" }),
  ],
};

const ownership = (heroes: string[], skins: string[]) => ({ heros: new Set(heroes), skins: new Set(skins) });

describe("summaryCollection", () => {
  it("counts only collectible skins: neither default nor announced skins", () => {
    expect(skinsCollectible(catalog).map((s) => s.id)).toEqual(["m1", "m2", "m3", "b1"]);
    const b = summaryCollection(catalog, ownership([], []));
    expect(b.heroes).toMatchObject({ owned: 0, total: 2, diamonds: 0 });
    expect(b.skins).toMatchObject({ owned: 0, total: 4, diamonds: 0 });
    expect(b.diamonds).toBe(0);
    expect(b.plusRare).toEqual([]);
  });

  it("sums diamonds, and keeps battle points and other currencies separate", () => {
    const b = summaryCollection(catalog, ownership(["miya", "balmond"], ["m1", "m2", "m3", "b1"]));
    expect(b.heroes).toMatchObject({ owned: 2, diamonds: 599, battlePoints: 38500, withoutDiamond: 1 });
    expect(b.skins).toMatchObject({ owned: 4, diamonds: 1168, withoutDiamond: 2, others: { mc: 200 } });
    expect(b.diamonds).toBe(1767);
  });

  it("breaks down by rarity, from rarest to most common", () => {
    const b = summaryCollection(catalog, ownership([], ["m2", "m3"]));
    expect(b.byRarity.map((r) => [r.rank, r.owned, r.total, r.diamonds])).toEqual([
      [6, 0, 1, 0],
      [4, 1, 1, 899],
      [3, 0, 1, 0],
      [1, 1, 1, 269],
    ]);
  });

  it("puts started series first, by completion rate", () => {
    const b = summaryCollection(catalog, ownership([], ["b1"]));
    expect(b.bySeries.map((s) => [s.series, s.owned, s.total])).toEqual([
      ["StarLight", 1, 1],
      ["Epic", 0, 1],
      ["Legend", 0, 1],
    ]);
  });

  it("puts the rarest piece first", () => {
    const b = summaryCollection(catalog, ownership([], ["m3", "b1", "m1"]));
    expect(b.plusRare.map((s) => s.id)).toEqual(["m1", "b1", "m3"]);
  });

  it("ignores an unknown id left over from an old sync", () => {
    expect(summaryCollection(catalog, ownership(["inconnu"], ["zzz"])).diamonds).toBe(0);
  });
});

describe("compareRarity", () => {
  it("at equal rarity, prefers limited edition, then the smallest series, then the oldest", () => {
    const sizes = new Map([
      ["Grande", 50],
      ["Petite", 3],
    ]);
    const list = [
      skin({ id: "dispo", hero: "x", rarity: 3, series: "Petite" }),
      skin({ id: "grande", hero: "x", rarity: 3, availability: "Limited", series: "Grande" }),
      skin({ id: "petite", hero: "x", rarity: 3, availability: "Limited", series: "Petite", release: "2020" }),
      skin({ id: "ancienne", hero: "x", rarity: 3, availability: "Limited", series: "Petite", release: "2018-02" }),
    ];
    expect(list.sort(compareRarity(sizes)).map((s) => s.id)).toEqual(["ancienne", "petite", "grande", "dispo"]);
  });
});

describe("coveragePrice", () => {
  it("counts heroes and skins priced in diamonds, and those in another currency", () => {
    expect(coveragePrice(catalog)).toEqual({
      heroes: 2,
      heroDiamonds: 1,
      skins: 4,
      skinsDiamonds: 2,
      skinsOtherCurrency: 1,
    });
  });
});

describe("saved data", () => {
  it("reads saved data back and drops anything that is not text", () => {
    expect(readOwnership('{"heros":["miya",3],"skins":["m1"]}')).toEqual({ heros: ["miya"], skins: ["m1"] });
  });

  it("starts from scratch on a missing, corrupted or differently formatted value", () => {
    const empty = { heros: [], skins: [] };
    expect(readOwnership(null)).toEqual(empty);
    expect(readOwnership("{abime")).toEqual(empty);
    expect(readOwnership("[1,2]")).toEqual(empty);
    expect(readOwnership('"texte"')).toEqual(empty);
  });

  it("writes sorted saved data that reads back identically", () => {
    const raw = writeOwnership(ownership(["miya", "balmond"], ["m3", "m1"]));
    expect(raw).toBe('{"heros":["balmond","miya"],"skins":["m1","m3"]}');
    expect(readOwnership(raw)).toEqual({ heros: ["balmond", "miya"], skins: ["m1", "m3"] });
  });
});
