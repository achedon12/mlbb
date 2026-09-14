import { describe, expect, it } from "vitest";
import { countryName, readableRank } from "@/lib/ranks";

describe("readableRank — Warrior to Epic tiers", () => {
  it("places the first rank_level in Warrior III", () => {
    const r = readableRank(1);
    expect(r.key).toBe("warrior");
    expect(r.division).toBe("III");
    expect(r.mythic).toBe(false);
    expect(r.image).toMatch(/^\/visuels\/rangs\//);
  });

  it("counts the stars within the division", () => {
    // Epic I covers rank_level 100 to 105: 103 = 4th star.
    const r = readableRank(103);
    expect(r.key).toBe("epic");
    expect(r.division).toBe("I");
    expect(r.stars).toBe(4);
    expect(r.unitStars).toBe("star");
  });
});

describe("readableRank — Legend", () => {
  it("places 106 to 135 in Legend V to I, like the official table", () => {
    expect(readableRank(106)).toMatchObject({ key: "legend", division: "V", stars: 1, mythic: false });
    expect(readableRank(111)).toMatchObject({ key: "legend", division: "V", stars: 6 });
    expect(readableRank(130)).toMatchObject({ key: "legend", division: "I", stars: 1 });
    expect(readableRank(135)).toMatchObject({ key: "legend", division: "I", mythic: false });
  });

  it("only enters Mythic at 136, with no star", () => {
    expect(readableRank(136)).toMatchObject({ key: "mythic", stars: 0, mythic: true });
  });
});

describe("readableRank — Mythic family", () => {
  it("counts 30 stars for rank_level 166 (real reference point) and ranks it in Honor", () => {
    const r = readableRank(166);
    expect(r.stars).toBe(30);
    expect(r.key).toBe("mythic-honor");
    expect(r.mythic).toBe(true);
  });

  it("keeps the best rank (182) in Honor, never Glory", () => {
    const r = readableRank(182);
    expect(r.stars).toBe(46);
    expect(r.key).toBe("mythic-honor");
  });

  it("respects the sub-tier thresholds", () => {
    expect(readableRank(160).key).toBe("mythic"); // 24 stars
    expect(readableRank(161).key).toBe("mythic-honor"); // 25
    expect(readableRank(186).key).toBe("mythic-glory"); // 50
    expect(readableRank(236).key).toBe("mythic-immortal"); // 100
  });

  it("never drops below zero stars when entering Mythic", () => {
    // Official table: Mythic starts at 136, after Legend I.
    expect(readableRank(136).stars).toBe(0);
    expect(readableRank(136).mythic).toBe(true);
  });
});

describe("countryName", () => {
  it("names the country in the reader's language", () => {
    expect(countryName("FR", "fr")).toBe("France");
    expect(countryName("fr", "en")).toBe("France");
    expect(countryName("DE", "en")).toBe("Germany");
    expect(countryName("DE", "fr")).toBe("Allemagne");
    expect(countryName("DE", "it")).toBe("Germania");
    expect(countryName("DE", "es")).toBe("Alemania");
    expect(countryName("US", "en")).toBe("United States");
  });

  it("returns the code as is when empty or not a region code", () => {
    expect(countryName("ZZ", "en")).toBe("ZZ");
    expect(countryName("XX", "fr")).toBe("XX");
    expect(countryName("", "en")).toBe("");
    expect(countryName("123", "fr")).toBe("123");
  });
});
