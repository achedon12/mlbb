import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOverride, applyOverrides, overridesFolder, readOverrides } from "@/lib/lore-overrides";
import { allHeroes, stories } from "@/lib/data";
import storiesEn from "@/data/game/stories/en.json";
import storiesFr from "@/data/game/stories/fr.json";
import type { HeroStory } from "@/lib/types";

const base: HeroStory = {
  tagline: "Machine tagline.",
  lore: ["Heading", "First.", "Second."],
  headings: [0],
  profile: {
    fullName: null,
    title: null,
    species: "Humain",
    gender: "Femme",
    age: null,
    origin: null,
    birthday: "6 décembre",
    affiliations: ["A"],
    relations: ["B (amie)"],
    powers: ["C"],
  },
  trivia: ["Machine trivia."],
};

describe("applyOverride", () => {
  it("replaces the keys it has and keeps the others", () => {
    const story = applyOverride(base, { tagline: "Relu.", lore: ["Intertitre", "Premier.", "Second."] });
    expect(story.tagline).toBe("Relu.");
    expect(story.lore[1]).toBe("Premier.");
    expect(story.headings).toEqual([0]);
    expect(story.trivia).toEqual(["Machine trivia."]);
    expect(story.profile).toEqual(base.profile);
  });

  it("merges the profile field by field", () => {
    const story = applyOverride(base, { profile: { species: "Elfe", powers: ["Magie"] } });
    expect(story.profile).toMatchObject({ species: "Elfe", gender: "Femme", birthday: "6 décembre", powers: ["Magie"] });
  });

  it("drops chapter titles left pointing at a lore split differently", () => {
    expect(applyOverride(base, { lore: ["Un seul paragraphe."] }).headings).toEqual([]);
    expect(applyOverride(base, { lore: ["Un.", "Titre"], headings: [1] }).headings).toEqual([1]);
  });

  it("builds a story for a hero the generated file lacks, without touching the input", () => {
    const all = { masha: base };
    const out = applyOverrides(all, { nouveau: { lore: ["Texte."] } });
    expect(out.nouveau).toMatchObject({ tagline: null, lore: ["Texte."], profile: null, trivia: [] });
    expect(all).toEqual({ masha: base });
    expect(applyOverrides(all, {})).toBe(all);
  });
});

describe("readOverrides", () => {
  const folder = mkdtempSync(join(tmpdir(), "mlbb-lore-"));
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("keys the files by slug and names a broken one", () => {
    writeFileSync(join(folder, "alice.json"), JSON.stringify({ tagline: "Reine." }));
    writeFileSync(join(folder, "README.md"), "# Notes");
    expect(readOverrides(folder)).toEqual({ alice: { tagline: "Reine." } });
    writeFileSync(join(folder, "zilong.json"), "{ nope");
    expect(() => readOverrides(folder)).toThrow(/zilong\.json/);
  });

  it("reads nothing from a missing folder", () => {
    expect(readOverrides(join(folder, "absent"))).toEqual({});
  });
});

/** The committed files: the site renders them, a mistake shows on a hero page. */
describe("content/fr/lore", () => {
  const overrides = readOverrides(overridesFolder("fr"));
  const slugs = new Set(allHeroes.map((h) => h.slug));
  const en = storiesEn as unknown as Record<string, HeroStory>;
  const KEYS = new Set(["tagline", "lore", "headings", "profile", "trivia"]);
  const PROFILE_KEYS = new Set(Object.keys(base.profile!));

  it.each(Object.entries(overrides))("%s is a well-formed story", (slug, o) => {
    expect(slugs.has(slug), `unknown hero ${slug}`).toBe(true);
    for (const k of Object.keys(o)) expect(KEYS.has(k), `unknown key ${k}`).toBe(true);
    if (o.tagline !== undefined) expect(o.tagline === null || typeof o.tagline === "string").toBe(true);
    for (const list of [o.lore, o.trivia]) {
      if (list === undefined) continue;
      expect(Array.isArray(list)).toBe(true);
      for (const p of list) expect(typeof p === "string" && p.trim().length > 0).toBe(true);
    }
    const story = stories("fr")[slug];
    for (const i of story.headings ?? []) expect(i).toBeLessThan(story.lore.length);
    if (o.profile) {
      for (const k of Object.keys(o.profile)) expect(PROFILE_KEYS.has(k), `unknown profile key ${k}`).toBe(true);
      // Factions and lore links pair each line with the English one by position.
      for (const k of ["affiliations", "relations"] as const) {
        if (o.profile[k]) expect(o.profile[k]!.length, k).toBe(en[slug]?.profile?.[k]?.length ?? 0);
      }
    }
  });

  it("is what stories('fr') serves, and leaves the other languages alone", () => {
    const fr = storiesFr as unknown as Record<string, HeroStory>;
    for (const [slug, o] of Object.entries(overrides)) {
      if (o.lore) expect(stories("fr")[slug].lore).toEqual(o.lore);
      if (o.tagline !== undefined) expect(stories("fr")[slug].tagline).toBe(o.tagline);
    }
    expect(stories("en")).toBe(storiesEn);
    expect(Object.keys(stories("fr")).length).toBeGreaterThanOrEqual(Object.keys(fr).length);
  });
});
