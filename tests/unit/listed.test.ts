import { describe, expect, it } from "vitest";
import { allHeroes, heroesBySlug, illustrations } from "@/lib/data";
import { collaborationOf } from "@/lib/collaborations";
import { isPublishedArtwork, listedHeroes, listedSkins, shownIllustrations } from "@/lib/listed";
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

  it("withholds an altered copy, a crop on the hand-checked list and another hero's artwork", () => {
    const skins = [skin("Death"), skin("Gemini - Halo"), skin("Leona"), skin("Captain Thorns")];
    const byName = {
      Death: "/visuels/heros/aldous/illustrations/death.webp",
      "Gemini - Halo": "/visuels/heros/karina/illustrations/gemini-halo.webp",
      Leona: "/visuels/heros/karina/illustrations/leona.webp",
      "Captain Thorns": "/visuels/heros/miya/illustrations/captain-thorns.webp",
    };
    const files: Record<string, string> = {
      [byName.Death]: "File:Aldous Death-picsay.png",
      [byName["Gemini - Halo"]]: "File:Selena (Gemini - Shadow).jpg",
      [byName.Leona]: "File:Karina (Leona).jpg",
      [byName["Captain Thorns"]]: "File:Miya (Captain Thorns).jpg",
    };
    expect(shownIllustrations(byName, skins, NOW, (path) => files[path])).toEqual({ Leona: byName.Leona });
  });

  it("keeps an artwork whose source is unknown", () => {
    expect(shownIllustrations({ Leona: "/visuels/heros/karina/illustrations/leona.webp" }, [skin("Leona")], NOW)).toEqual({
      Leona: "/visuels/heros/karina/illustrations/leona.webp",
    });
  });
});

describe("isPublishedArtwork", () => {
  it("reads the hero from the path for the hand-checked list", () => {
    expect(isPublishedArtwork("/visuels/heros/selena/illustrations/gemini-shadow.webp", "File:Selena (Gemini - Shadow).jpg")).toBe(true);
    expect(isPublishedArtwork("/visuels/heros/karina/illustrations/gemini-halo.webp", "File:Selena (Gemini - Shadow).jpg")).toBe(false);
    expect(isPublishedArtwork("/visuels/heros/thamuz/illustrations/lord-lava.webp", "File:Thamuz (Lord Lava; unreleased revamp).jpg")).toBe(false);
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

  it("shows no altered or mismatched artwork the audit of November 2026 found", () => {
    expect(illustrations.aldous?.Death).toBeUndefined();
    expect(illustrations.alice?.["Jade Empress"]).toBeUndefined();
    expect(illustrations.karina?.["Gemini - Halo"]).toBeUndefined();
    expect(illustrations.miya?.["Captain Thorns"]).toBeUndefined();
    // Selena's own artwork, the one Karina's row borrowed, is still shown.
    expect(illustrations.selena?.["Gemini - Shadow"]).toBeDefined();
  });
});
