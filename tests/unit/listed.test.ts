import { describe, expect, it } from "vitest";
import { allHeroes, heroesBySlug, illustrations } from "@/lib/data";
import { collaborationOf } from "@/lib/collaborations";
import { listedHeroes, listedSkins, shownIllustrations } from "@/lib/listed";
import type { GeneratedHero, Skin } from "@/lib/types";

const NOW = Date.UTC(2026, 10, 19, 12);

const hero = (slug: string, release: string | null, extra: Partial<GeneratedHero> = {}) =>
  ({ slug, name: slug, id: "1", release, ...extra }) as GeneratedHero;
const skin = (name: string, extra: Partial<Skin> = {}): Skin => ({
  id: name,
  name,
  release: "2020-01-01",
  availability: "Available",
  rarity: null,
  label: null,
  price: {},
  ...extra,
});

describe("listedHeroes", () => {
  it("leaves out a hero announced without a date (Dori, TBA)", () => {
    expect(listedHeroes([hero("dori", "TBA"), hero("kalea", "15 January 2026")], NOW).map((h) => h.slug)).toEqual([
      "kalea",
    ]);
  });
});

describe("listedSkins", () => {
  it("leaves out skins marked upcoming or without a date", () => {
    const skins = [
      skin("Shadowbringer"),
      skin("Cyber Infiltrator", { release: "202X", availability: "Upcoming" }),
      skin("The Purifier", { release: "202X", availability: "Limited" }),
    ];
    expect(listedSkins(skins, NOW).map((s) => s.name)).toEqual(["Shadowbringer"]);
  });
});

describe("shownIllustrations", () => {
  it("withholds the artwork of unreleased and collaboration skins", () => {
    const skins = [
      skin("The Protector"),
      skin("The Purifier", { release: "202X" }),
      skin("Neymar Jr", { label: "Neymar Jr" }),
    ];
    const byName = {
      "The Protector": "/a.webp",
      "The Purifier": "/b.webp",
      "Neymar Jr.": "/c.webp",
    };
    expect(shownIllustrations(byName, skins, NOW)).toEqual({ "The Protector": "/a.webp" });
  });
});

describe("collaborationOf", () => {
  it("names the licensed franchise of a collaboration skin", () => {
    expect(collaborationOf({ label: "Naruto" })).toBe("NARUTO");
    expect(collaborationOf({ label: "Pacquiao Licensed" })).toBe("Manny Pacquiao");
    expect(collaborationOf({ label: "StarLight" })).toBeNull();
    expect(collaborationOf({ label: null })).toBeNull();
  });
});

describe("catalogue as the site reads it", () => {
  it("lists no unreleased hero and no unreleased skin", () => {
    expect(heroesBySlug.has("dori")).toBe(false);
    for (const h of allHeroes) {
      for (const s of h.skins) expect(s.availability, `${h.slug} ${s.name}`).not.toBe("Upcoming");
    }
    expect(illustrations.dori).toBeUndefined();
  });
});
