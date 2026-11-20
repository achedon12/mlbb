import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import heroes from "@/data/game/heroes.json";

const DIR = join(process.cwd(), "content/fr/lore");
const slugs = new Set((heroes as { slug: string }[]).map((h) => h.slug));
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => f[0] >= "n" && f[0] <= "z");

describe("hand-written French lore, heroes n to z", () => {
  it("covers every hero from n to z", () => {
    const expected = [...slugs].filter((s) => s[0] >= "n" && s[0] <= "z").sort();
    expect(files.map((f) => f.replace(/\.json$/, "")).sort()).toEqual(expected);
  });

  it.each(files)("%s parses and names a real hero", (file) => {
    const story = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    expect(slugs.has(file.replace(/\.json$/, ""))).toBe(true);
    expect(typeof story.tagline).toBe("string");
    expect(Array.isArray(story.lore)).toBe(true);
    expect(story.lore.length).toBeGreaterThan(0);
  });
});
