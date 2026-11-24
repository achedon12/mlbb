import { describe, expect, it } from "vitest";
import heroColors from "@/data/hero-colors.json";
import { allHeroes, illustrations } from "@/lib/data";
import {
  DEFAULT_ACCENT,
  MIN_CONTRAST,
  NIGHT_GROUNDS,
  contrast,
  heroAccent,
  readableAccent,
} from "@/lib/hero-accent";
import { dominantAccent } from "../../scripts/hero-colors.mjs";

const COLORS = heroColors as Record<string, string>;

describe("readableAccent", () => {
  it("reaches text contrast on every night ground, for every measured artwork", () => {
    for (const raw of Object.values(COLORS)) {
      const accent = readableAccent(raw);
      for (const ground of NIGHT_GROUNDS) expect(contrast(accent, ground)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("lifts a very dark colour and keeps its hue family", () => {
    const accent = readableAccent("#1a0a40");
    expect(contrast(accent, NIGHT_GROUNDS[3])).toBeGreaterThanOrEqual(MIN_CONTRAST);
    const [r, , b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
  });

  it("falls back to the gold for a malformed colour", () => {
    expect(readableAccent("not a colour")).toBe(DEFAULT_ACCENT);
  });

  it("keeps the gold readable too", () => {
    for (const ground of NIGHT_GROUNDS) expect(contrast(DEFAULT_ACCENT, ground)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});

describe("heroAccent", () => {
  it("is the gold for an artwork without a measure", () => {
    expect(heroAccent(null)).toBe(DEFAULT_ACCENT);
    expect(heroAccent("/visuels/heros/nobody/illustrations/none.webp")).toBe(DEFAULT_ACCENT);
  });

  it("covers the poster of nearly every hero", () => {
    const posters = allHeroes.map((h) => Object.values(illustrations[h.slug] ?? {})[0]).filter(Boolean);
    const measured = posters.filter((p) => COLORS[p]);
    expect(measured.length / posters.length).toBeGreaterThan(0.9);
  });
});

describe("dominantAccent", () => {
  it("picks the most present saturated hue and ignores greys", () => {
    const red = [200, 40, 40];
    const grey = [120, 120, 120];
    const pixels = [...red, ...red, ...red, ...grey, ...grey, ...grey, ...grey, ...grey];
    expect(dominantAccent(Uint8Array.from(pixels), 3)).toBe("#c82828");
  });

  it("is null for a grey image", () => {
    expect(dominantAccent(Uint8Array.from([10, 10, 10, 240, 240, 240]), 3)).toBeNull();
  });
});
