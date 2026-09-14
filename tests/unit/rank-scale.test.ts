import { describe, expect, it } from "vitest";
import { SCALE, RULES_FAMILY, tierAppearance } from "@/lib/rank-scale";
import { readableRank } from "@/lib/ranks";

/**
 * L'echelle de la page des rangs et la traduction des profils (`rangs.ts`)
 * reposent sur la meme table officielle : ces tests les empechent de diverger.
 */
describe("rank scale", () => {
  it("covers rank_level values with no gap or overlap", () => {
    expect(SCALE[0].rankLevel.start).toBe(1);
    for (let i = 1; i < SCALE.length; i += 1) {
      expect(SCALE[i].rankLevel.start).toBe(SCALE[i - 1].rankLevel.end! + 1);
    }
    expect(SCALE.at(-1)!.rankLevel.end).toBeNull();
  });

  it("aligns divisions and stars with ranks.ts, from Warrior to Epic", () => {
    for (const p of SCALE.filter((x) => x.divisions.length)) {
      // Plage de chaque division, lue dans rangs.ts.
      const ranges = new Map<string, number>();
      for (let n = p.rankLevel.start; n <= p.rankLevel.end!; n += 1) {
        const r = readableRank(n);
        expect(r.key).toBe(p.key);
        ranges.set(r.division, (ranges.get(r.division) ?? 0) + 1);
      }
      expect([...ranges.keys()]).toEqual(p.divisions);
      const expected = p.key === "warrior" ? [4, 3, 3] : p.divisions.map(() => p.starsMax! + 1);
      expect([...ranges.values()]).toEqual(expected);
    }
  });

  it("aligns Mythic tiers with the point thresholds of ranks.ts", () => {
    for (const p of SCALE.filter((x) => x.points)) {
      const r = readableRank(p.rankLevel.start);
      expect(r.key).toBe(p.key);
      expect(r.stars).toBe(p.points!.min);
      if (p.rankLevel.end !== null) expect(readableRank(p.rankLevel.end).key).toBe(p.key);
    }
  });

  it("gives a rule to every family and an emblem to every tier", () => {
    for (const p of SCALE) {
      expect(RULES_FAMILY[p.family]).toBeDefined();
      expect(tierAppearance(p).image).not.toBeNull();
    }
  });
});
