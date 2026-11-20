import { describe, expect, it } from "vitest";
import { allHeroes, heroesBySlug, illustrations, loneIllustrations } from "@/lib/data";
import { collaborationOf } from "@/lib/collaborations";
import { isPublishedArtwork, listedHeroes, listedSkins, shownIllustrations, sortIllustrations } from "@/lib/listed";
import { heroArt } from "@/components/hero-art";
import { artOf } from "@/components/tool-art";
import { normalizeNameSkin } from "@/lib/utils";
import type { GeneratedHero, Skin } from "@/lib/types";
import visualSources from "@/data/game/visual-sources.json";

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

  it("checks the original's size once the manifest records it", () => {
    const path = "/visuels/heros/layla/illustrations/x.webp";
    expect(isPublishedArtwork(path, { file: "File:Layla (X).jpg", width: 1920, height: 1080 })).toBe(true);
    expect(isPublishedArtwork(path, { file: "File:Layla (X).jpg", width: 696, height: 392 })).toBe(false);
    expect(isPublishedArtwork(path, { file: "File:Layla (X).jpg", width: 1080, height: 1350 })).toBe(false);
    expect(isPublishedArtwork(path, { file: "File:Layla (X).jpg" })).toBe(true);
  });

  it("leaves out an advanced-server, teaser or screenshot copy", () => {
    const path = "/visuels/heros/suyou/illustrations/x.webp";
    expect(isPublishedArtwork(path, "File:Suyou (Frostblade Duelist; Advance Server).jpg")).toBe(false);
    expect(isPublishedArtwork(path, "File:Suyou Frostblade Duelist teaser.png")).toBe(false);
    expect(isPublishedArtwork(path, "File:Suyou screenshot.png")).toBe(false);
  });
});

describe("sortIllustrations", () => {
  const NOW_MS = NOW;
  const day = 86_400_000;
  const sources: Record<string, { file: string; timestamp: string }> = {
    "/a.webp": { file: "File:Layla (Bunny Babe).jpg", timestamp: "2019-01-01T00:00:00Z" },
    "/b.webp": { file: "File:Layla (Sunset Waltz).jpg", timestamp: "2023-10-09T00:00:00Z" },
    "/c.webp": { file: "File:Layla (Midnight Rhythm).jpg", timestamp: new Date(NOW_MS - 10 * day).toISOString() },
  };
  const byName = { "Bunny Babe": "/a.webp", "Sunset Waltz": "/b.webp", "Midnight Rhythm": "/c.webp" };

  it("keeps catalogue artworks as final, the others as lone, a recent one provisional", () => {
    const { final, lone } = sortIllustrations(byName, [skin("Bunny Babe")], NOW_MS, (p) => sources[p]);
    expect(final).toEqual({ "Bunny Babe": "/a.webp" });
    expect(lone).toEqual([
      { name: "Sunset Waltz", illustration: "/b.webp", provisional: false },
      { name: "Midnight Rhythm", illustration: "/c.webp", provisional: true },
    ]);
  });

  it("matches the catalogue by normalised name", () => {
    const { final } = sortIllustrations({ "Vessel Of Deceit": "/a.webp" }, [skin("Vessel of Deceit")], NOW_MS, (p) => sources[p]);
    expect(final).toEqual({ "Vessel Of Deceit": "/a.webp" });
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
    const sources = visualSources as Record<string, { file?: string }>;
    // The audit found a PicSay edit (Aldous "Death"), another hero's file
    // (Alice "Jade Empress" from Atlas's, Karina "Gemini - Halo" from
    // Selena's) and a low-resolution copy (Miya "Captain Thorns"). Each is
    // either withheld or, once the sync found the official file, shown from
    // the hero's own published artwork.
    for (const [hero, skin, label] of [
      ["aldous", "Death", "Aldous"],
      ["alice", "Jade Empress", "Alice"],
      ["karina", "Gemini - Halo", "Karina"],
      ["miya", "Captain Thorns", "Miya"],
    ] as const) {
      const path = illustrations[hero]?.[skin];
      if (!path) continue;
      const source = sources[`public${path}`];
      expect(isPublishedArtwork(path, source), `${hero} ${skin}`).toBe(true);
      expect(source?.file ?? "", `${hero} ${skin}`).toContain(label);
    }
    expect(isPublishedArtwork("/visuels/heros/aldous/illustrations/death.webp", { file: "File:Aldous Death-picsay.png" })).toBe(false);
    // Selena's own artwork, the one Karina's row borrowed, is still shown.
    expect(illustrations.selena?.["Gemini - Shadow"]).toBeDefined();
  });

  it("draws every poster from a released catalogue skin's artwork", () => {
    for (const h of allHeroes) {
      const names = new Set(h.skins.map((s) => normalizeNameSkin(s.name)));
      for (const name of Object.keys(illustrations[h.slug] ?? {})) expect(names.has(normalizeNameSkin(name)), `${h.slug} ${name}`).toBe(true);
    }
    // Martis, the timer's face: "Asura King" matches no catalogue skin.
    expect(heroArt("martis")).not.toBe("/visuels/heros/martis/illustrations/asura-king.webp");
    expect(artOf("martis")).not.toBe("/visuels/heros/martis/illustrations/asura-king.webp");
    expect(loneIllustrations.martis?.map((a) => a.name)).toContain("Asura King");
  });
});
