import { describe, expect, it } from "vitest";
import { analysisFor, heroAnalyses } from "@/lib/data";
import { LOCALES } from "@/i18n/config";
import type { HeroAnalysis } from "@/lib/types";

const FRENCH = /\b(avec|dans|très|adversaires|lorsqu|jusqu|également)\b/i;

describe("analysisFor", () => {
  const source = heroAnalyses[0].analysis!;

  it("returns the French source as is", () => {
    expect(analysisFor(source, "fr")).toBe(source);
  });

  it("returns null without an analysis", () => {
    expect(analysisFor(null, "en")).toBeNull();
  });

  it("translates the prose but keeps the facts of the source", () => {
    const en = analysisFor(source, "en")!;
    expect(en.summary).not.toBe(source.summary);
    expect(en.analysis).not.toBe(source.analysis);
    expect(en.slug).toBe(source.slug);
    expect(en.strongAgainst).toEqual(source.strongAgainst);
    expect(en.weakAgainst).toEqual(source.weakAgainst);
    expect(en.skills.map((s) => [s.type, s.cooldown, s.cost])).toEqual(source.skills.map((s) => [s.type, s.cooldown, s.cost]));
    expect(en.builds.map((b) => [b.items, b.emblem, b.talent, b.spell])).toEqual(
      source.builds.map((b) => [b.items, b.emblem, b.talent, b.spell]),
    );
  });

  it("falls back to French for an analysis the translation has not reached", () => {
    const fresh: HeroAnalysis = { ...source, slug: "not-translated-yet" };
    expect(analysisFor(fresh, "en")).toBe(fresh);
  });

  it("keeps the French list when its length changed since the translation", () => {
    const longer: HeroAnalysis = { ...source, strengths: [...source.strengths, "Nouvelle force"] };
    const en = analysisFor(longer, "en")!;
    expect(en.strengths).toEqual(longer.strengths);
    expect(en.summary).not.toBe(source.summary);
  });

  // A new analysis stays French until the next `npm run translate` (nightly):
  // only the analyses already translated are held to the target language.
  it("shows the translated analyses in their own language, paragraphs kept", () => {
    for (const locale of LOCALES.filter((l) => l !== "fr")) {
      const translated = heroAnalyses.filter((h) => analysisFor(h.analysis, locale) !== h.analysis);
      expect(translated.length, locale).toBeGreaterThan(heroAnalyses.length / 2);
      for (const h of translated) {
        const a = analysisFor(h.analysis, locale)!;
        expect(a.analysis.split("\n\n")).toHaveLength(h.analysis!.analysis.split("\n\n").length);
        if (["en", "it", "es", "id", "fil", "pt"].includes(locale)) expect(a.analysis, `${h.slug} in ${locale}`).not.toMatch(FRENCH);
      }
    }
  });
});
