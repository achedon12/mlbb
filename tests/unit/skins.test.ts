import { describe, expect, it } from "vitest";
import { createTFrom } from "@/i18n/t";
import { heroesBySlug } from "@/lib/data";
import {
  anchorSkin,
  uniqueAnchors,
  encodeImage,
  filterGroups,
  formatRelease,
  imageOfThumb,
  imageThumb,
  shortenImage,
  type GroupSkins,
} from "@/lib/skins";
import {
  anchorsGallery,
  lastSkins,
  elide,
  heroGallery,
  groupsSkins,
  heroesWithSkins,
  gallerySkinCount,
  titleGallery,
} from "@/lib/hero-skins";

describe("skin anchors", () => {
  it("gives a readable anchor, parentheses included", () => {
    expect(anchorSkin("Night's Edge")).toBe("skin-night-s-edge");
    expect(anchorSkin("Ken (Outfit 2)")).toBe("skin-ken-outfit-2");
    expect(anchorSkin("Épée & Roses")).toBe("skin-epee-roses");
    expect(anchorSkin("★")).toBe("skin-sans-nom");
  });

  it("makes two names that reduce to the same text unique", () => {
    expect(uniqueAnchors(["A b", "A-b", "C", "a B"])).toEqual(["skin-a-b", "skin-a-b-2", "skin-c", "skin-a-b-3"]);
  });
});

describe("release dates", () => {
  it("formats a full date or a month in the language", () => {
    expect(formatRelease("2016-12-11", "fr")).toBe("11 décembre 2016");
    expect(formatRelease("2016-12-11", "en")).toBe("December 11, 2016");
    expect(formatRelease("2018-08", "fr")).toBe("août 2018");
  });

  it("leaves a bare or approximate year as is", () => {
    expect(formatRelease("2016", "fr")).toBe("2016");
    expect(formatRelease("201X", "en")).toBe("201X");
  });
});

describe("thumbnail images", () => {
  it("encodes a portrait by the skin id, and finds it back", () => {
    const path = "/visuels/heros/angela/skins/552-dove-love.png";
    expect(encodeImage("angela", "Dove & Love", "552", path)).toBe("552");
    expect(imageOfThumb("angela", ["Dove & Love", "552", 0])).toBe(path);
  });

  it("encodes an illustration with a star, and finds it back", () => {
    const path = "/visuels/heros/aamon/illustrations/soul-reaver.webp";
    expect(encodeImage("aamon", "Soul Reaver", null, path)).toBe("*");
    expect(imageOfThumb("aamon", ["Soul Reaver", "*", 0])).toBe(path);
  });

  it("keeps a path outside the naming rule whole", () => {
    expect(encodeImage("aamon", "Duke of Shards", "1091", "/ailleurs/duke.png")).toBe("/ailleurs/duke.png");
    expect(imageOfThumb("aamon", ["Duke of Shards", "/ailleurs/duke.png", 0])).toBe("/ailleurs/duke.png");
    expect(encodeImage("aamon", "Duke of Shards", "1091", null)).toBeNull();
    expect(imageOfThumb("aamon", ["Duke of Shards", null, 0])).toBeNull();
  });

  it("shortens a path under the hero folder, and restores it", () => {
    const path = "/visuels/heros/aamon/skins/1091-duke-of-shards.png";
    expect(shortenImage("aamon", path)).toBe("skins/1091-duke-of-shards.png");
    expect(imageThumb("aamon", shortenImage("aamon", path))).toBe(path);
    expect(shortenImage("aamon", "/visuels/autre.png")).toBe("/visuels/autre.png");
    expect(imageThumb("aamon", null)).toBeNull();
  });
});

describe("gallery filters", () => {
  const GROUPS: GroupSkins[] = [
    { slug: "aamon", name: "Aamon", roles: ["Assassin"], skins: [["Duke of Shards", null, 0], ["Soul Vessels", null, 4]] },
    { slug: "miya", name: "Miya", roles: ["Marksman"], skins: [["Moonlight Archer", null, 0], ["Suzuhime", null, 3]] },
    { slug: "chou", name: "Chou", roles: ["Fighter"], skins: [["Soul Vessels", null, 4]] },
  ];
  const empty = { role: null, search: "" };

  it("keeps everything without a filter", () => {
    expect(filterGroups(GROUPS, empty)).toEqual(GROUPS);
  });

  it("filters by role", () => {
    expect(filterGroups(GROUPS, { ...empty, role: "Marksman" }).map((g) => g.slug)).toEqual(["miya"]);
  });

  it("keeps a whole hero when the search matches its name", () => {
    expect(filterGroups(GROUPS, { ...empty, search: "MIY" })).toEqual([GROUPS[1]]);
  });

  it("otherwise keeps only the skins whose name matches", () => {
    const r = filterGroups(GROUPS, { ...empty, search: "vessel" });
    expect(r.map((g) => [g.slug, g.skins.map(([name]) => name)])).toEqual([
      ["aamon", ["Soul Vessels"]],
      ["chou", ["Soul Vessels"]],
    ]);
  });

  it("combines role and search", () => {
    expect(filterGroups(GROUPS, { role: "Fighter", search: "vessel" }).map((g) => g.slug)).toEqual(["chou"]);
    expect(filterGroups(GROUPS, { role: "Tank", search: "" })).toEqual([]);
  });
});

describe("gallery titles", () => {
  const t = createTFrom({ pages: { heroSkins: { title: "Skins de {nom}", titleElision: "Skins d'{nom}" } } });

  it("elides in French before a vowel, and only there", () => {
    expect(titleGallery(t, "fr", "Aamon")).toBe("Skins d'Aamon");
    expect(titleGallery(t, "fr", "Esmeralda")).toBe("Skins d'Esmeralda");
    expect(titleGallery(t, "fr", "Balmond")).toBe("Skins de Balmond");
    expect(titleGallery(t, "fr", "Yu Zhong")).toBe("Skins de Yu Zhong");
    expect(elide("en", "Aamon")).toBe(false);
  });
});

describe("hero galleries (synced data)", () => {
  it("joins catalog portraits and illustrations, and keeps standalone illustrations apart", () => {
    for (const h of heroesWithSkins) {
      const g = heroGallery(h);
      expect(g.skins).toHaveLength(h.skins.length);
      const taken = new Set(g.skins.map((s) => s.illustration));
      expect(g.others.every((a) => !taken.has(a.illustration))).toBe(true);
      expect(g.total).toBe(g.skins.length + g.others.length);
      expect(g.total).toBeGreaterThan(0);
    }
  });

  it("gives each skin in a gallery a unique anchor", () => {
    for (const h of heroesWithSkins) {
      const anchors = anchorsGallery(heroGallery(h));
      expect(new Set(anchors).size).toBe(anchors.length);
    }
  });

  it("opens no gallery for a hero without any visual", () => {
    const without = [...heroesBySlug.values()].filter((h) => !heroesWithSkins.includes(h));
    for (const h of without) expect(heroGallery(h).total).toBe(0);
  });

  it("puts every listed skin in the catalog groups, in alphabetical order", () => {
    const groups = groupsSkins();
    expect(groups.reduce((n, g) => n + g.skins.length, 0)).toBe(gallerySkinCount);
    const names = groups.map((g) => g.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("finds the exact image of each thumbnail, encoded as short as possible", () => {
    let whole = 0;
    let total = 0;
    for (const g of groupsSkins()) {
      const gallery = heroGallery(heroesBySlug.get(g.slug)!);
      const expected = [...gallery.skins.map((s) => s.portrait ?? s.illustration), ...gallery.others.map((a) => a.illustration)];
      expect(g.skins.map((v) => imageOfThumb(g.slug, v))).toEqual(expected);
      for (const [, image] of g.skins) {
        total += 1;
        if (image?.startsWith("/")) whole += 1;
      }
    }
    expect(whole / total).toBeLessThan(0.02);
  });

  it("sorts the latest skins from newest to oldest", () => {
    const dates = lastSkins(12).map((e) => e.skin.release!);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
