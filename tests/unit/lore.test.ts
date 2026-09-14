import { describe, expect, it } from "vitest";
import { allHeroes } from "@/lib/data";
import {
  heroReleaseKey,
  buildLinks,
  splitRelation,
  factionsLore,
  citedHeroes,
  linksLore,
  heroPatterns,
  pairsLore,
  pairsFeatured,
  regionByKey,
  regionsLore,
  summaryRegion,
} from "@/lib/lore";

describe("splitRelation", () => {
  it("separates names from the nature of the relationship", () => {
    expect(splitRelation("Gusion, Eren (younger brothers)")).toEqual({ names: "Gusion, Eren", nature: "younger brothers" });
    expect(splitRelation("Terizla, Thamuz, (companions)")).toEqual({ names: "Terizla, Thamuz,", nature: "companions" });
  });

  it("keeps inner parentheses and accepts a line without a nature", () => {
    expect(splitRelation("Ken (Outfit 2) (rival (former))")).toEqual({ names: "Ken (Outfit 2)", nature: "rival (former)" });
    expect(splitRelation("Unknown sisters")).toEqual({ names: "Unknown sisters", nature: null });
  });
});

describe("citedHeroes", () => {
  const patterns = heroPatterns([
    { slug: "sun", name: "Sun" },
    { slug: "yi-sun-shin", name: "Yi Sun-shin" },
    { slug: "yin", name: "Yin" },
    { slug: "chang-e", name: "Chang'e" },
    { slug: "aamon", name: "Aamon" },
  ]);

  it("finds names as whole words, case-insensitively, in reading order", () => {
    expect(citedHeroes("chang'e, Aamon", patterns)).toEqual(["chang-e", "aamon"]);
    expect(citedHeroes("Yinyang", patterns)).toEqual([]);
  });

  it("does not match a name inside a longer name, and ignores itself", () => {
    expect(citedHeroes("Yi Sun-shin", patterns)).toEqual(["yi-sun-shin"]);
    expect(citedHeroes("Sun, Yi Sun-shin", patterns)).toEqual(["sun", "yi-sun-shin"]);
    expect(citedHeroes("Aamon, Yin", patterns, "aamon")).toEqual(["yin"]);
  });
});

describe("links and pairs", () => {
  const list = [
    { slug: "aamon", name: "Aamon" },
    { slug: "gusion", name: "Gusion" },
    { slug: "alice", name: "Alice" },
    { slug: "miya", name: "Miya" },
  ];
  const sheet = (relations: string[]) => ({ profile: { relations, affiliations: [], species: null } });
  const en = {
    aamon: sheet(["Gusion (younger brother)"]),
    gusion: sheet(["Aamon (older brother)"]),
    alice: sheet(["Miya, Aamon, Gusion (enemies)"]),
    miya: sheet([]),
  };
  const fr = {
    aamon: sheet(["Gusion (frère cadet)"]),
    gusion: sheet(["Aamon (frère aîné)"]),
    alice: sheet(["Miya, Aamon, Gusion (ennemis)"]),
    miya: sheet([]),
  };
  const links = buildLinks(list, en, fr);

  it("reads the nature in the page's language and counts the group size", () => {
    expect(links.find((l) => l.de === "aamon")).toEqual({
      de: "aamon",
      to: "gusion",
      nature: "frère cadet",
      natureEn: "younger brother",
      group: 1,
    });
    expect(links.filter((l) => l.de === "alice").map((l) => [l.to, l.group])).toEqual([
      ["miya", 3],
      ["aamon", 3],
      ["gusion", 3],
    ]);
  });

  it("ranks a personal, mutual link before a list of enemies", () => {
    const names = new Map(list.map((h) => [h.slug, h.name]));
    const pairs = pairsLore(links, names);
    expect([pairs[0].a, pairs[0].b]).toEqual(["aamon", "gusion"]);
    expect(pairs[0].deA?.nature).toBe("frère cadet");
    expect(pairs[0].deB?.nature).toBe("frère aîné");
    // Each hero appears only once in the showcase.
    const featured = pairsFeatured(pairs, 5);
    const slugs = featured.flatMap((p) => [p.a, p.b]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("heroOutputKey", () => {
  it("makes a wiki date comparable", () => {
    expect(heroReleaseKey("26 October 2021")).toBe("2021-10-26");
    expect(heroReleaseKey("January 2017")).toBe("2017-01");
    expect(heroReleaseKey("2016")).toBe("2016");
    expect(heroReleaseKey("TBA")).toBeNull();
    expect(heroReleaseKey(null)).toBeNull();
  });
});

describe("real data", () => {
  it("places each hero with a region in exactly one region", () => {
    const ranges = regionsLore.flatMap((r) => r.heroes.map((h) => h.slug));
    expect(ranges.length).toBe(allHeroes.filter((h) => h.region).length);
    expect(new Set(ranges).size).toBe(ranges.length);
    expect(new Set(regionsLore.map((r) => r.key)).size).toBe(regionsLore.length);
  });

  it("links Aamon to Gusion, with the nature from the French page", () => {
    const link = linksLore("fr").find((l) => l.de === "aamon" && l.to === "gusion");
    expect(link?.natureEn).toBe("younger brothers");
    expect(link?.nature).toBe("frères cadets");
  });

  it("groups House Paxley and drops hostile affiliations", () => {
    const factions = factionsLore("en");
    expect(factions.find((f) => f.name === "Paxley House")?.heroes).toEqual(["aamon", "gusion", "marcel"]);
    expect(factions.some((f) => /hostile|enem|former/i.test(f.name))).toBe(false);
  });

  it("summarizes a region with only its internal links", () => {
    const r = regionByKey.get("moniyan-empire")!;
    const members = new Set(r.heroes.map((h) => h.slug));
    const summary = summaryRegion(r, "en");
    expect(summary.internal.every((p) => members.has(p.a) && members.has(p.b))).toBe(true);
    expect(summary.external.every((p) => members.has(p.a) !== members.has(p.b))).toBe(true);
    expect(summary.roles.reduce((n, x) => n + x.n, 0)).toBeGreaterThanOrEqual(r.heroes.length);
  });
});
