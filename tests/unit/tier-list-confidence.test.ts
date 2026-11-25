import { describe, expect, it } from "vitest";
import {
  GAP_FRAGILE,
  isFragile,
  leaderOf,
  leadersOf,
  ORDER_TIERS,
  rankingFull,
  rankingOfRank,
  RANKS_CLASSES,
  THRESHOLD_RELIABILITY,
  winRateAdjusted,
} from "@/lib/tier-list";

describe("the sample-adjusted win rate", () => {
  it("keeps half the gap to 50 % at the reliability threshold", () => {
    expect(winRateAdjusted(56, THRESHOLD_RELIABILITY)).toBeCloseTo(53, 6);
  });

  it("barely moves a hero played a lot", () => {
    expect(winRateAdjusted(54, 2.5)).toBeGreaterThan(53.5);
  });

  it("pulls a losing rate up toward 50 % the same way", () => {
    expect(winRateAdjusted(44, THRESHOLD_RELIABILITY)).toBeCloseTo(47, 6);
  });

  it("brings a hero without picks back to 50 %", () => {
    expect(winRateAdjusted(70, 0)).toBe(50);
  });
});

describe("a fragile measure", () => {
  it("is any hero under the pick threshold", () => {
    expect(isFragile({ winRate: 50, pickRate: THRESHOLD_RELIABILITY - 0.01 })).toBe(true);
  });

  it("is a striking win rate over a handful of games, even above the threshold", () => {
    // 58.5 % at 0.46 % pick: the correction removes more than GAP_FRAGILE points.
    expect(58.5 - winRateAdjusted(58.5, 0.46)).toBeGreaterThan(GAP_FRAGILE);
    expect(isFragile({ winRate: 58.5, pickRate: 0.46 })).toBe(true);
  });

  it("is not an ordinary rate at the same pick rate", () => {
    expect(isFragile({ winRate: 51, pickRate: 0.46 })).toBe(false);
  });

  it("is not a high rate backed by many games", () => {
    expect(isFragile({ winRate: 54, pickRate: 1.7 })).toBe(false);
  });
});

describe("the ranking order", () => {
  for (const rank of RANKS_CLASSES) {
    const ranking = rankingOfRank(rank);

    it(`${rank}: goes by tier, reliable heroes first, then by adjusted score`, () => {
      for (let i = 1; i < ranking.length; i++) {
        const [a, b] = [ranking[i - 1]!, ranking[i]!];
        const tierGap = ORDER_TIERS.indexOf(b.tier) - ORDER_TIERS.indexOf(a.tier);
        expect(tierGap).toBeGreaterThanOrEqual(0);
        if (tierGap > 0) continue;
        expect(Number(b.lowSample)).toBeGreaterThanOrEqual(Number(a.lowSample));
        if (a.lowSample === b.lowSample) expect(a.scoreAdjusted).toBeGreaterThanOrEqual(b.scoreAdjusted);
      }
    });
  }

  it("keeps the displayed figures and the tier of the raw score", () => {
    for (const e of rankingFull) {
      expect(e.score).toBeCloseTo(e.winRate + e.banRate * 0.25, 1);
      // Only the win rate is corrected: the ban rate weighs the same in both scores.
      expect(e.scoreAdjusted - e.score).toBeCloseTo(winRateAdjusted(e.winRate, e.pickRate) - e.winRate, 1);
    }
  });

  it("flags every hero the ranking calls fragile by the same rule", () => {
    for (const e of rankingFull) expect(e.lowSample).toBe(isFragile(e));
  });

  it("never crowns a fragile measure when a reliable one exists", () => {
    const first = leaderOf(rankingFull);
    expect(first).toBeDefined();
    expect(first!.lowSample).toBe(false);
    expect(first).toBe(rankingFull.find((e) => !e.lowSample));
  });
});

describe("the heroes put forward", () => {
  const entry = (slug: string, lowSample: boolean) => ({ slug, lowSample });

  it("skips fragile heads of the list", () => {
    expect(leaderOf([entry("masha", true), entry("sun", false)])?.slug).toBe("sun");
  });

  it("falls back on the first one when none is reliable", () => {
    expect(leaderOf([entry("masha", true), entry("marcel", true)])?.slug).toBe("masha");
  });

  it("is empty for an empty list", () => {
    expect(leaderOf([])).toBeUndefined();
    expect(leadersOf([], 3)).toEqual([]);
  });

  it("takes the reliable ones in order, completed by the others", () => {
    const list = [entry("masha", true), entry("sun", false), entry("marcel", true), entry("obsidia", false)];
    expect(leadersOf(list, 3).map((e) => e.slug)).toEqual(["sun", "obsidia", "masha"]);
    expect(leadersOf(list, 2).map((e) => e.slug)).toEqual(["sun", "obsidia"]);
  });
});
