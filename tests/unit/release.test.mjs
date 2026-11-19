import { describe, expect, it } from "vitest";
import {
  isListedHero,
  isReleasedHero,
  isReleasedSkin,
  releaseStart,
  releaseState,
  skinRelease,
} from "../../scripts/release.mjs";

/** 19 November 2026, noon UTC. */
const NOW = Date.UTC(2026, 10, 19, 12);

describe("releaseStart", () => {
  it("reads the wiki's date formats, to the day, the month or the year", () => {
    expect(releaseStart("16 May 2016")).toBe(Date.UTC(2016, 4, 16));
    expect(releaseStart("2024-01-01")).toBe(Date.UTC(2024, 0, 1));
    expect(releaseStart("December 2016")).toBe(Date.UTC(2016, 11, 1));
    expect(releaseStart("2026-11")).toBe(Date.UTC(2026, 10, 1));
    expect(releaseStart("2018")).toBe(Date.UTC(2018, 0, 1));
    expect(releaseStart("[[Patch Notes/1.4.66|16 March 2020]]")).toBe(Date.UTC(2020, 2, 16));
  });

  it("finds no date in TBA, 202X or an empty field", () => {
    expect(releaseStart("TBA")).toBeNull();
    expect(releaseStart("202X")).toBeNull();
    expect(releaseStart("")).toBeNull();
    expect(releaseStart(null)).toBeNull();
  });
});

describe("releaseState", () => {
  it("counts a period as out once it has started", () => {
    expect(releaseState("2026-11", NOW)).toBe("past");
    expect(releaseState("19 November 2026", NOW)).toBe("past");
    expect(releaseState("2026-12-18", NOW)).toBe("future");
    expect(releaseState("2026-12", NOW)).toBe("future");
    expect(releaseState("TBA", NOW)).toBe("unknown");
  });
});

describe("isReleasedHero", () => {
  const dori = { slug: "dori", release: "TBA" };
  const kalea = { slug: "kalea", release: "15 January 2026" };
  const official = new Set(["kalea"]);

  it("leaves out a hero the official list does not have (Dori, November 2026)", () => {
    expect(isReleasedHero(dori, { official, now: NOW })).toBe(false);
    expect(isReleasedHero(kalea, { official, now: NOW })).toBe(true);
  });

  it("leaves out a hero dated in the future, even when a list already has it", () => {
    const soon = { slug: "noctis", release: "4 December 2026" };
    expect(isReleasedHero(soon, { official: new Set(["noctis"]), now: NOW })).toBe(false);
  });

  it("lets the official list vouch for a hero the wiki has not dated yet", () => {
    expect(isReleasedHero({ slug: "zetian", release: null }, { official: new Set(["zetian"]), now: NOW })).toBe(true);
  });

  it("without the official list, needs a past date and a finished page", () => {
    expect(isReleasedHero(dori, { now: NOW })).toBe(false);
    expect(isReleasedHero(kalea, { now: NOW })).toBe(true);
    expect(isReleasedHero(kalea, { now: NOW, unfinished: true })).toBe(false);
  });

  it("trusts the sync's verdict once it is written", () => {
    expect(isListedHero({ ...dori, released: true }, NOW)).toBe(true);
    expect(isListedHero(dori, NOW)).toBe(false);
  });
});

describe("isReleasedSkin", () => {
  it("leaves out a skin marked upcoming or dated 202X (Helcurt, Bruno)", () => {
    expect(isReleasedSkin({ release: "202X", availability: "Upcoming" }, NOW)).toBe(false);
    expect(isReleasedSkin({ release: "202X", availability: "Limited" }, NOW)).toBe(false);
    expect(isReleasedSkin({ release: "2026-12-18", availability: "Available" }, NOW)).toBe(false);
    expect(isReleasedSkin({ release: "2017-12-12", availability: "Available" }, NOW)).toBe(true);
  });

  it("trusts the sync's verdict once it is written", () => {
    expect(isReleasedSkin({ release: null, availability: null, released: true }, NOW)).toBe(true);
  });
});

describe("skinRelease", () => {
  const purifier = { id: "101210", release: "202X", availability: "Limited", label: "Collector" };

  it("dates a skin the module left at 202X from its Collector month", () => {
    expect(skinRelease(purifier, { month: "2026-11", now: NOW })).toEqual({ release: "2026-11", released: true });
  });

  it("keeps out a skin of a month that has not started", () => {
    expect(skinRelease({ id: "1265", release: null }, { month: "2026-12", confirmed: true, now: NOW })).toEqual({
      release: "2026-12",
      released: false,
    });
  });

  it("lets Liquipedia confirm a skin the module dates wrongly (Sora, December 2026)", () => {
    const azure = { id: "1312", release: "2026-12-18", availability: "Available" };
    expect(skinRelease(azure, { now: NOW }).released).toBe(false);
    expect(skinRelease(azure, { confirmed: true, now: NOW }).released).toBe(true);
  });

  it("keeps a hero's default skin, which ships with the hero", () => {
    expect(skinRelease({ id: "1311", release: "TBA" }, { base: true, now: NOW }).released).toBe(true);
  });

  it("leaves out a skin no source dates or confirms", () => {
    expect(skinRelease({ id: "517", release: "202X", availability: "Upcoming" }, { now: NOW }).released).toBe(false);
    expect(skinRelease({ id: "1096", release: null, availability: null }, { now: NOW }).released).toBe(false);
  });
});
