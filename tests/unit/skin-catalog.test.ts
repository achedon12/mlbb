import { describe, expect, it } from "vitest";
import { createTFrom } from "@/i18n/t";
import {
  anchorsOf,
  decodeIndex,
  encodeIndex,
  isReleased,
  filterSkins,
  groupByDate,
  readRelease,
  newest,
  seriesStats,
  textPrice,
  truncateGroups,
  type Catalog,
  type CatalogHero,
  type SkinCatalog,
} from "@/lib/skin-catalog";
import { catalogSkins, dateReference, readPrice, cleanObtain, releasedSkins } from "@/lib/skin-catalog-server";
import { allHeroes } from "@/lib/data";
import { anchorsGallery, heroGallery } from "@/lib/hero-skins";

const skin = (p: Partial<SkinCatalog> & { id: string }): SkinCatalog => ({
  name: `Skin ${p.id}`,
  hero: "aamon",
  rarity: 3,
  series: null,
  release: null,
  availability: "Available",
  price: {},
  acquisition: null,
  image: null,
  anchor: "",
  ...p,
});

const HEROES: CatalogHero[] = [
  { slug: "aamon", name: "Aamon", roles: ["Assassin"], icon: "/visuels/heros/aamon/icone.png" },
  { slug: "chang-e", name: "Chang'e", roles: ["Mage"], icon: null },
];
const bySlug = new Map(HEROES.map((h) => [h.slug, h]));

describe("readOutput", () => {
  it("reads a date to the day, the month or the year", () => {
    expect(readRelease("2025-05-01")).toEqual({ year: 2025, month: 5, day: 1 });
    expect(readRelease("2025-05")).toEqual({ year: 2025, month: 5, day: null });
    expect(readRelease("2016")).toEqual({ year: 2016, month: null, day: null });
  });

  it("refuses an approximate or missing date", () => {
    expect(readRelease("202X")).toBeNull();
    expect(readRelease("202XX")).toBeNull();
    expect(readRelease(null)).toBeNull();
  });
});

describe("isReleased", () => {
  const ref = "2026-09-11";
  it("compares a date at its own precision", () => {
    expect(isReleased(skin({ id: "1", release: "2026-09" }), ref)).toBe(true);
    expect(isReleased(skin({ id: "2", release: "2026" }), ref)).toBe(true);
    expect(isReleased(skin({ id: "3", release: "2026-09-11" }), ref)).toBe(true);
    expect(isReleased(skin({ id: "4", release: "2026-09-12" }), ref)).toBe(false);
    expect(isReleased(skin({ id: "5", release: "2026-12-18" }), ref)).toBe(false);
  });

  it("leaves out announced skins and unreadable dates", () => {
    expect(isReleased(skin({ id: "1", release: "2025-01", availability: "Upcoming" }), ref)).toBe(false);
    expect(isReleased(skin({ id: "2", release: "202X" }), ref)).toBe(false);
    expect(isReleased(skin({ id: "3" }), ref)).toBe(false);
  });
});

describe("groupByDate", () => {
  const list = [
    skin({ id: "a", release: "2025-03-02" }),
    skin({ id: "b", release: "2025-11" }),
    skin({ id: "c", release: "2025" }),
    skin({ id: "d", release: "2024-03-10" }),
    skin({ id: "e", release: "2025-03-20" }),
    skin({ id: "f", release: "202X" }),
  ];

  it("sorts from newest to oldest, the unknown month at the end of the year", () => {
    const g = groupByDate(list, "recent");
    expect(g.map((a) => [a.year, a.total])).toEqual([
      [2025, 4],
      [2024, 1],
    ]);
    expect(g[0].month.map((m) => m.month)).toEqual([11, 3, null]);
    expect(g[0].month[1].skins.map((s) => s.id)).toEqual(["e", "a"]);
  });

  it("reads a year from January to December in chronological order", () => {
    const g = groupByDate(list, "chronological");
    expect(g.map((a) => a.year)).toEqual([2024, 2025]);
    expect(g[1].month.map((m) => m.month)).toEqual([3, 11, null]);
    expect(g[1].month[0].skins.map((s) => s.id)).toEqual(["a", "e"]);
  });

  it("truncates in steps without losing the year's total", () => {
    const t = truncateGroups(groupByDate(list, "recent"), 2);
    expect(t).toHaveLength(1);
    expect(t[0].total).toBe(4);
    expect(t[0].month.flatMap((m) => m.skins.map((s) => s.id))).toEqual(["b", "e"]);
  });

  it("gives the newest skins dated at least to the month", () => {
    expect(newest(list, 3).map((s) => s.id)).toEqual(["b", "e", "a"]);
  });
});

describe("filterSkins", () => {
  const list = [
    skin({ id: "1", name: "Night's Edge", series: "Epic", rarity: 4, release: "2023-01" }),
    skin({ id: "2", name: "Moon Rabbit", hero: "chang-e", series: "Collector", rarity: 2, release: "2024" }),
    skin({ id: "3", name: "Vessel of Deceit", series: "Epic", rarity: 4, release: "2024-06-01" }),
  ];
  const ids = (f: Parameters<typeof filterSkins>[2]) => filterSkins(list, bySlug, f).map((s) => s.id);

  it("combines hero, role, series, rarity and year", () => {
    expect(ids({ hero: "aamon" })).toEqual(["1", "3"]);
    expect(ids({ role: "Mage" })).toEqual(["2"]);
    expect(ids({ series: "Epic", year: 2024 })).toEqual(["3"]);
    expect(ids({ rarity: 2 })).toEqual(["2"]);
  });

  it("searches the skin name and the hero name, ignoring case and accents", () => {
    expect(ids({ search: "VESSEL" })).toEqual(["3"]);
    expect(ids({ search: "chang'e" })).toEqual(["2"]);
  });

  it("counts series and their bounds", () => {
    expect(seriesStats(list)).toEqual([
      { series: "Epic", total: 2, first: "2023-01", last: "2024-06-01" },
      { series: "Collector", total: 1, first: "2024", last: "2024" },
    ]);
  });
});

describe("compact index", () => {
  const catalog: Catalog = {
    maj: "2026-09-11",
    heroes: HEROES,
    skins: [
      skin({ id: "10", name: "Duke of Shards", rarity: 0, price: { dm: 599, bp: 32000 }, anchor: "skin-duke-of-shards" }),
      skin({
        id: "11",
        name: "Night's Edge",
        series: "Epic",
        release: "2023-01",
        availability: "Limited",
        image: "/visuels/heros/aamon/skins/11-night-s-edge.png",
        anchor: "skin-night-s-edge",
      }),
      skin({ id: "12", name: "Night S Edge", acquisition: "Event", anchor: "skin-night-s-edge-2" }),
      skin({ id: "20", name: "Moon Rabbit", hero: "chang-e", series: "Epic", anchor: "skin-moon-rabbit" }),
    ],
  };

  it("decodes identically, with anchors recomputed", () => {
    expect(decodeIndex(JSON.parse(JSON.stringify(encodeIndex(catalog))))).toEqual(catalog);
  });

  it("shortens paths under the hero folder and shares series", () => {
    const index = encodeIndex(catalog);
    expect(index.series).toEqual(["Epic"]);
    expect(index.skins[1][9]).toBe("skins/11-night-s-edge.png");
    expect(index.heros[0][3]).toBe("icone.png");
  });

  it("suffixes two anchors that collide", () => {
    expect(anchorsOf(["A&B", "A B", "C"])).toEqual(["skin-a-b", "skin-a-b-2", "skin-c"]);
  });
});

describe("textPrice", () => {
  const t = createTFrom({ skinsUI: { diamonds: "Diamonds", battlePoints: "Battle Points" } });
  const count = new Intl.NumberFormat("en");
  it("writes each priced currency, in currency order", () => {
    expect(textPrice({ bp: 32000, dm: 599 }, t, count)).toBe("599 diamonds · 32,000 battle points");
    expect(textPrice({}, t, count)).toBeNull();
  });
});

describe("real catalog", () => {
  const c = catalogSkins();

  it("only has skins linked to a catalog hero, with unique ids", () => {
    const slugs = new Set(c.heroes.map((h) => h.slug));
    expect(c.skins.every((s) => slugs.has(s.hero))).toBe(true);
    expect(new Set(c.skins.map((s) => s.id)).size).toBe(c.skins.length);
  });

  it("gives each skin the gallery anchor of its hero", () => {
    for (const h of allHeroes.filter((x) => x.skins.length > 0)) {
      const g = heroGallery(h);
      const expected = anchorsGallery(g).slice(0, g.skins.length);
      expect(c.skins.filter((s) => s.hero === h.slug).map((s) => s.anchor)).toEqual(expected);
    }
  });

  it("schedules no default skin, no announced skin and no date after the data", () => {
    for (const s of releasedSkins()) {
      expect(s.rarity).toBeGreaterThan(0);
      expect(s.availability).not.toBe("Upcoming");
      expect(s.release! <= dateReference.slice(0, s.release!.length)).toBe(true);
    }
  });

  it("survives the round trip through the compact index", () => {
    expect(decodeIndex(JSON.parse(JSON.stringify(encodeIndex(c))))).toEqual(c);
  });

  it("cleans wiki links and ignores unreadable prices", () => {
    expect(cleanObtain("Obtained via the [[MLBB × Naruto|MLBB X Naruto]] event")).toBe(
      "Obtained via the MLBB X Naruto event",
    );
    expect(cleanObtain("[[M5 Pass]]")).toBe("M5 Pass");
    expect(readPrice({ dm: "599", bp: "abc", other: "Twilight Pass" })).toEqual({ dm: 599 });
  });
});
