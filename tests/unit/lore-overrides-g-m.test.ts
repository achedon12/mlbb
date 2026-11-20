import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import heroes from "@/data/game/heroes.json";
import storiesEn from "@/data/game/stories/en.json";
import storiesFr from "@/data/game/stories/fr.json";

/**
 * Hand-written French stories for heroes g to m (content/fr/lore/<slug>.json):
 * each file parses, names a real hero, only uses the generated entry's keys
 * and keeps the English structure (paragraph count, heading positions, list
 * lengths), which the site relies on to line lists up with the English ones.
 */

type Entry = Record<string, unknown> & {
  lore?: string[];
  headings?: number[];
  trivia?: string[];
  profile?: Record<string, unknown> | null;
};

const dir = join(process.cwd(), "content/fr/lore");
const files = readdirSync(dir).filter((f) => /^[g-m].*\.json$/.test(f));
const slugs = new Set(heroes.map((h) => h.slug));
const en = storiesEn as unknown as Record<string, Entry>;
const fr = storiesFr as unknown as Record<string, Entry>;

describe("French lore overrides, g to m", () => {
  it("covers every hero from g to m", () => {
    const expected = heroes.map((h) => h.slug).filter((s) => /^[g-m]/.test(s));
    expect(files.map((f) => f.slice(0, -5)).sort()).toEqual(expected.sort());
  });

  for (const file of files) {
    const slug = file.slice(0, -5);
    it(`${slug}: valid override`, () => {
      const o = JSON.parse(readFileSync(join(dir, file), "utf8")) as Entry;
      expect(slugs.has(slug)).toBe(true);
      for (const key of Object.keys(o)) expect(Object.keys(fr[slug])).toContain(key);
      const source = en[slug];
      if (o.lore) expect(o.lore).toHaveLength(source.lore!.length);
      if (o.headings) expect(o.headings).toEqual(source.headings);
      if (o.trivia) expect(o.trivia).toHaveLength(source.trivia!.length);
      if (o.profile && source.profile) {
        for (const [key, value] of Object.entries(source.profile)) {
          if (Array.isArray(value)) expect(o.profile[key]).toHaveLength(value.length);
        }
      }
    });
  }
});
