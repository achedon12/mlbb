import { describe, expect, it } from "vitest";
import { hasRecap, patchRecap, RECAP_MIN_SAMPLE } from "@/lib/patch-recap";
import { verdictImpact, type ImpactAdjustment } from "@/lib/trends";
import type { AdjustmentType } from "@/lib/types";

const impact = (type: AdjustmentType | null, gap: number, daysAfter = 7): ImpactAdjustment => ({
  version: "2.2.23",
  date: "2026-11-11",
  type,
  before: 50,
  after: 50 + gap,
  gap,
  daysBefore: 7,
  daysAfter,
  verdict: verdictImpact(type, gap),
});

const adjustments = (list: [string, AdjustmentType | null][]) => list.map(([slug, type]) => ({ slug, type }));

describe("patch recap", () => {
  const adj = adjustments([
    ["aldous", "buff"],
    ["atlas", "nerf"],
    ["freya", "buff"],
    ["gloo", "nerf"],
    ["kaja", "buff"],
    ["lukas", "buff"],
    ["odette", "adjust"],
    ["ghost", "nerf"],
  ]);
  const impacts = {
    aldous: impact("buff", 0.77),
    atlas: impact("nerf", -0.46),
    freya: impact("buff", 0.36),
    gloo: impact("nerf", -0.74),
    kaja: impact("buff", -0.11),
    lukas: impact("buff", -0.53),
    odette: impact("adjust", 1.2),
  };
  const recap = patchRecap(adj, impacts);

  it("ranks winners and losers past the noise", () => {
    expect(recap.winners.map((e) => e.slug)).toEqual(["odette", "aldous", "freya"]);
    expect(recap.losers.map((e) => e.slug)).toEqual(["gloo", "lukas", "atlas"]);
  });

  it("calls a buff that fell a surprise, and a change within the noise flat", () => {
    expect(recap.surprises.map((e) => e.slug)).toEqual(["lukas"]);
    expect(recap.flat.map((e) => e.slug)).toEqual(["kaja"]);
  });

  it("counts what is measured and averages buffs and nerfs", () => {
    expect(recap.adjusted).toBe(8);
    expect(recap.measured).toBe(7);
    expect(recap.sample).toBe("ok");
    expect(recap.meanBuff).toBe(0.12);
    expect(recap.meanNerf).toBe(-0.6);
    expect(recap.young).toBe(false);
  });

  it("keeps a chapter to its size", () => {
    expect(patchRecap(adj, impacts, 1).winners.map((e) => e.slug)).toEqual(["odette"]);
  });

  it("says when the sample is small, missing or the patch still young", () => {
    const small = patchRecap(adj, { aldous: impact("buff", 0.77, 5) });
    expect(small.measured).toBeLessThan(RECAP_MIN_SAMPLE);
    expect(small.sample).toBe("small");
    expect(small.young).toBe(true);
    const none = patchRecap(adj, {});
    expect(none).toMatchObject({ sample: "none", measured: 0, winners: [], losers: [], surprises: [], meanBuff: null });
    expect(hasRecap(none)).toBe(false);
    expect(hasRecap(small)).toBe(true);
  });

  it("reads a hero adjusted twice once, and ignores inherited keys", () => {
    const twice = patchRecap(adjustments([["aldous", "buff"], ["aldous", "buff"], ["constructor", null]]), { aldous: impact("buff", 0.5) });
    expect(twice.adjusted).toBe(2);
    expect(twice.measured).toBe(1);
  });
});
