import { describe, expect, it } from "vitest";
import {
  PRESETS,
  analyze,
  chanceWithin,
  curve,
  diamondsFor,
  drawsForBudget,
  drawsForChance,
  expectedDraws,
  expectedTenDraws,
  parseInteger,
  parsePercent,
  validateEvent,
  type DrawEvent,
} from "@/lib/draw-odds";

const aurora: DrawEvent = { cost: 50, tenCost: 450, chance: 1, pity: 10 };
const simple = (chance: number, pity: number | null = null): DrawEvent => ({ cost: 10, tenCost: null, chance, pity });

/** Distribution of T computed term by term, without a closed form: the reference for the tests. */
function distribution(e: DrawEvent, max = 200_000): number[] {
  const p = e.chance / 100;
  const probabilities: number[] = [];
  let survival = 1;
  for (let k = 1; k <= max && survival > 1e-15; k++) {
    const pk = e.pity !== null && k >= e.pity ? survival : survival * p;
    probabilities[k] = pk;
    survival -= pk;
  }
  return probabilities;
}

describe("input parsing", () => {
  it("reads integers with the thousands separators of every language", () => {
    expect(parseInteger("3000")).toBe(3000);
    expect(parseInteger("3,000")).toBe(3000);
    expect(parseInteger("3.000")).toBe(3000);
    expect(parseInteger("3 000")).toBe(3000);
    expect(parseInteger("3\u202f000")).toBe(3000);
    for (const s of ["", "abc", "-5", "1e3", "12a"]) expect(parseInteger(s), s).toBeNull();
  });

  it("reads percentages with a comma or a dot", () => {
    expect(parsePercent("1,38")).toBe(1.38);
    expect(parsePercent("1.38 %")).toBe(1.38);
    expect(parsePercent(".5")).toBe(0.5);
    for (const s of ["", "abc", "1,2,3", "-1", "NaN", "Infinity"]) expect(parsePercent(s), s).toBeNull();
  });
});

describe("probabilities", () => {
  it("follows 1 - (1 - p)^n then reaches 1 at the pity", () => {
    expect(chanceWithin(1, simple(50))).toBeCloseTo(0.5, 15);
    expect(chanceWithin(2, simple(50))).toBeCloseTo(0.75, 15);
    expect(chanceWithin(9, aurora)).toBeCloseTo(1 - 0.99 ** 9, 15);
    expect(chanceWithin(10, aurora)).toBe(1);
    expect(chanceWithin(0, aurora)).toBe(0);
    expect(chanceWithin(1, simple(100))).toBe(1);
  });

  it("stays accurate for a tiny chance", () => {
    // 1 - (1 - 1e-6)^1 must give 1e-6, not a rounding residue.
    expect(chanceWithin(1, simple(0.0001))).toBeCloseTo(1e-6, 18);
  });

  it("gives the expected number of draws, pity included", () => {
    expect(expectedDraws(simple(1))).toBeCloseTo(100, 10);
    expect(expectedDraws(simple(100))).toBe(1);
    for (const e of [aurora, simple(1.38, 160), simple(7, 25), simple(0.5, 3)]) {
      const reference = distribution(e).reduce((s, pk, k) => s + k * pk, 0);
      expect(expectedDraws(e)).toBeCloseTo(reference, 9);
    }
  });

  it("gives the expected number of 10-draws", () => {
    for (const e of [aurora, simple(1.38, 160), simple(2), simple(1, 15)]) {
      const reference = distribution(e).reduce((s, pk, k) => s + Math.ceil(k / 10) * pk, 0);
      expect(expectedTenDraws(e)).toBeCloseTo(reference, 8);
    }
  });

  it("finds the smallest number of draws for each milestone", () => {
    expect(drawsForChance(0.5, simple(50))).toBe(1);
    expect(drawsForChance(0.75, simple(50))).toBe(2);
    expect(drawsForChance(0.9, simple(50))).toBe(4);
    expect(drawsForChance(0.99, aurora)).toBe(10);
    expect(drawsForChance(0.5, simple(0.0001))).toBe(693_147);
    for (const e of [simple(1), simple(1.38, 160), simple(0.3), simple(33.3), simple(12, 8)]) {
      for (const target of [0.5, 0.9, 0.99]) {
        let n = 1;
        while (chanceWithin(n, e) < target - 1e-12) n++;
        expect(drawsForChance(target, e), `${e.chance} % at ${target}`).toBe(n);
      }
    }
  });
});

describe("diamonds", () => {
  it("mixes 10-draws and singles at the best price", () => {
    expect(diamondsFor(8, aurora)).toBe(400);
    // Nine singles cost as much as one 10-draw: the cheaper of the two is kept.
    expect(diamondsFor(9, aurora)).toBe(450);
    expect(diamondsFor(10, aurora)).toBe(450);
    expect(diamondsFor(11, aurora)).toBe(500);
    expect(diamondsFor(19, aurora)).toBe(900);
    expect(diamondsFor(0, aurora)).toBe(0);
  });

  it("ignores a 10-draw that saves nothing", () => {
    const noDiscount: DrawEvent = { ...aurora, tenCost: 500 };
    expect(diamondsFor(10, noDiscount)).toBe(500);
    expect(drawsForBudget(1000, noDiscount)).toBe(20);
  });

  it("maximises the draws a budget pays for", () => {
    expect(drawsForBudget(1000, aurora)).toBe(22);
    expect(drawsForBudget(449, aurora)).toBe(8);
    expect(drawsForBudget(0, aurora)).toBe(0);
    // Exhaustive check: no other mix yields more draws.
    for (let budget = 0; budget <= 3000; budget += 7) {
      let best = 0;
      for (let tens = 0; tens * 450 <= budget; tens++) best = Math.max(best, tens * 10 + Math.floor((budget - tens * 450) / 50));
      expect(drawsForBudget(budget, aurora), String(budget)).toBe(best);
    }
  });
});

describe("analyze", () => {
  it("flags every invalid field", () => {
    const r = analyze({ cost: 0, tenCost: -1, chance: Number.NaN, pity: 1.5 }, { type: "budget", diamonds: -3 });
    expect(r).toEqual({ state: "invalid", errors: ["cost", "tenCost", "chance", "pity", "budget"] });
    expect(analyze(simple(101), { type: "draws", count: 0 })).toEqual({ state: "invalid", errors: ["chance", "draws"] });
  });

  it("builds the report for a budget", () => {
    const r = analyze(aurora, { type: "budget", diamonds: 1000 });
    expect(r).toMatchObject({ state: "ok", draws: 22, diamonds: 1000, chance: 1 });
    if (r.state !== "ok") throw new Error();
    expect(r.milestones.map((m) => m.draws)).toEqual([10, 10, 10]);
    expect(r.milestones[0].diamonds).toBe(450);
    expect(r.expectedDiamondsSingle).toBeCloseTo(expectedDraws(aurora) * 50, 10);
    expect(r.expectedDiamondsTen).toBeCloseTo(450, 10);
  });

  it("builds the report for a number of draws, without a 10-draw", () => {
    const r = analyze(simple(1), { type: "draws", count: 69 });
    expect(r).toMatchObject({ state: "ok", draws: 69, diamonds: 690, expectedDiamondsTen: null });
    if (r.state !== "ok") throw new Error();
    expect(r.chance).toBeCloseTo(1 - 0.99 ** 69, 12);
    expect(r.milestones.map((m) => m.draws)).toEqual([69, 230, 459]);
  });
});

describe("curve", () => {
  it("rises, ends at the end of the axis and keeps the pity step", () => {
    const points = curve(simple(1.38, 160), 200, 40);
    expect(points[0]).toEqual({ n: 0, p: 0 });
    expect(points.at(-1)!.n).toBe(200);
    expect(points.map((x) => x.n)).toEqual(expect.arrayContaining([159, 160]));
    for (let i = 1; i < points.length; i++) {
      expect(points[i].n).toBeGreaterThan(points[i - 1].n);
      expect(points[i].p).toBeGreaterThanOrEqual(points[i - 1].p);
    }
    expect(points.length).toBeLessThanOrEqual(43);
  });
});

describe("presets", () => {
  it("are valid events, with a source and a date", () => {
    for (const p of PRESETS) {
      expect(validateEvent(p.event), p.key).toEqual([]);
      expect(p.source).toMatch(/^https:\/\/mobilelegends\.fandom\.com\/wiki\//);
      expect(p.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
