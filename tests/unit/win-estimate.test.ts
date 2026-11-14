import { describe, expect, it } from "vitest";
import type { MeasuresRank } from "@/lib/composition";
import type { Lane, Role } from "@/lib/types";
import {
  BOUNDS,
  confidenceOf,
  duelEdge,
  estimate,
  estimateContext,
  pairEdge,
  PENALTIES,
  percentages,
  suggestPicks,
  WEIGHTS,
  WIKI_COUNTER,
  type EstimateHero,
} from "@/lib/win-estimate";

const hero = (slug: string, lanes: Lane[], o: Partial<EstimateHero> = {}): EstimateHero => ({
  slug,
  lanes,
  roles: ["Fighter"] as Role[],
  win: 50,
  strongAgainst: [],
  weakAgainst: [],
  synergies: [],
  damage: null,
  ...o,
});

const LANES_: Lane[] = ["Gold", "Jungle", "Mid", "Exp", "Roam"];
/** Five heroes per lane, all at 50 %, no relation: every team is worth every other. */
const roster = LANES_.flatMap((lane) => Array.from({ length: 5 }, (_, i) => hero(`${lane.toLowerCase()}-${i}`, [lane])));
const blue5 = ["gold-0", "jungle-0", "mid-0", "exp-0", "roam-0"];
const red5 = ["gold-1", "jungle-1", "mid-1", "exp-1", "roam-1"];

const measures = (o: Partial<MeasuresRank> = {}): MeasuresRank => ({
  rank: "mythic",
  stats: {},
  buckets: [],
  duration: {},
  teammates: {},
  weak: {},
  ...o,
});

const withHero = (slug: string, o: Partial<EstimateHero>) => roster.map((h) => (h.slug === slug ? { ...h, ...o } : h));

describe("win estimate", () => {
  it("an empty draft and two equal teams are a coin toss", () => {
    const ctx = estimateContext(roster, measures());
    expect(estimate(ctx, [], []).blue).toBe(0.5);
    const e = estimate(ctx, blue5, red5);
    expect(e.blue).toBe(0.5);
    expect(e.red).toBe(0.5);
    expect(e.edge).toBe(0);
    expect(Object.values(e.factors).every((v) => v === 0)).toBe(true);
  });

  it("is symmetric: swapping the teams swaps the probabilities", () => {
    const ctx = estimateContext(
      withHero("gold-0", { win: 54, strongAgainst: ["mid-1"], damage: "physical" }),
      measures({
        stats: { "jungle-1": [48.5, "B"] },
        weak: { "exp-1": [["exp-0", -3.2]] },
        teammates: { "gold-0": [["roam-0", 2.1]] },
      }),
    );
    const a = estimate(ctx, blue5, red5);
    const b = estimate(ctx, red5, blue5);
    expect(a.blue).toBeGreaterThan(0.5);
    expect(b.blue).toBeCloseTo(a.red, 10);
    expect(b.edge).toBeCloseTo(-a.edge, 10);
    for (const k of Object.keys(a.factors) as (keyof typeof a.factors)[]) expect(b.factors[k]).toBeCloseTo(-a.factors[k], 10);
  });

  it("is monotonic: a stronger blue hero never lowers blue's chances", () => {
    let last = 0;
    for (const win of [44, 48, 50, 52, 56, 60]) {
      const p = estimate(estimateContext(withHero("gold-0", { win }), null), blue5, red5).blue;
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    // And a counter blue holds raises it, one the red side holds lowers it.
    const base = estimate(estimateContext(roster, measures()), blue5, red5).blue;
    const blueCounters = estimate(estimateContext(roster, measures({ weak: { "mid-1": [["mid-0", -4]] } })), blue5, red5).blue;
    const redCounters = estimate(estimateContext(roster, measures({ weak: { "mid-0": [["mid-1", -4]] } })), blue5, red5).blue;
    expect(blueCounters).toBeGreaterThan(base);
    expect(redCounters).toBeLessThan(base);
  });

  it("stays within its bounds, however lopsided the draft", () => {
    const strong = roster.map((h) => ({ ...h, win: blue5.includes(h.slug) ? 80 : 20 }));
    const e = estimate(estimateContext(strong, null), blue5, red5);
    expect(e.blue).toBe(BOUNDS.max);
    expect(e.red).toBeCloseTo(1 - BOUNDS.max, 10);
    expect(e.clamped).toBe(true);
    expect(estimate(estimateContext(strong, null), red5, blue5).blue).toBe(BOUNDS.min);
  });

  it("is a logistic of the weighted factors", () => {
    const ctx = estimateContext(withHero("gold-0", { win: 54 }), null);
    const e = estimate(ctx, blue5, red5);
    expect(e.factors.strength).toBe(4 * WEIGHTS.strength);
    expect(e.blue).toBeCloseTo(1 / (1 + Math.exp(-0.04 * 2)), 10);
    expect(percentages(e)).toEqual({ blue: 52, red: 48 });
  });

  it("missing data: unknown heroes, missing win rates and no measurements count for nothing", () => {
    const ctx = estimateContext(withHero("gold-0", { win: null }), null);
    const e = estimate(ctx, ["gold-0", "ghost", "ghost"], ["gold-1"]);
    expect(e.blue).toBe(0.5);
    expect(e.teams.blue.slugs).toEqual(["gold-0"]);
    expect(e.teams.blue.rates).toEqual([{ slug: "gold-0", rate: null }]);
    expect(Number.isFinite(e.edge)).toBe(true);
    // A hero on both sides, impossible in a legal draft, is left out.
    expect(estimate(ctx, ["gold-1"], ["gold-1"]).picks).toBe(0);
  });

  it("rank measurements win over the all-ranks rate and the wiki", () => {
    const heroes = withHero("gold-0", { win: 40, strongAgainst: ["gold-1"] });
    const ctx = estimateContext(heroes, measures({ stats: { "gold-0": [55, "A"] }, weak: { "gold-0": [["gold-1", -2]] } }));
    expect(ctx.rate("gold-0")).toBe(55);
    expect(duelEdge(ctx, "gold-0", "gold-1")).toEqual({ points: -2, measured: true });
    // Without measurement the wiki relation gives its flat value, both ways.
    const wiki = estimateContext(heroes, null);
    expect(duelEdge(wiki, "gold-0", "gold-1")).toEqual({ points: WIKI_COUNTER, measured: false });
    expect(duelEdge(wiki, "gold-1", "gold-0")).toEqual({ points: -WIKI_COUNTER, measured: false });
    expect(duelEdge(wiki, "gold-1", "mid-0")).toBeNull();
  });

  it("reads both measured directions of a duel and the best one of a duo", () => {
    const ctx = estimateContext(
      roster,
      measures({
        weak: { "mid-0": [["mid-1", -2]], "mid-1": [["mid-0", -4]] },
        teammates: { "gold-0": [["roam-0", 1]], "roam-0": [["gold-0", 3]] },
      }),
    );
    expect(duelEdge(ctx, "mid-0", "mid-1")?.points).toBe(1);
    expect(pairEdge(ctx, "gold-0", "roam-0")).toEqual({ points: 3, measured: true });
  });

  it("penalises two heroes for one lane, a team without a tank and single-type damage", () => {
    const heroes = roster.map((h) => ({ ...h, damage: "physical" as const, roles: ["Tank"] as Role[] }));
    const ctx = estimateContext(heroes, null);
    const clash = estimate(ctx, ["gold-0", "gold-2"], ["gold-1", "mid-1"]);
    expect(clash.teams.blue.laneConflicts).toEqual(["gold-2"]);
    expect(clash.factors.composition).toBe(-PENALTIES.lane);
    expect(clash.blue).toBeLessThan(0.5);
    // Both teams deal physical damage only: the penalty cancels out.
    expect(estimate(ctx, blue5, red5).factors.damage).toBe(0);
    const mixed = heroes.map((h) => (red5.includes(h.slug) && h.slug !== "gold-1" ? { ...h, damage: "magic" as const } : h));
    expect(estimate(estimateContext(mixed, null), blue5, red5).factors.damage).toBe(-PENALTIES.damage);
    const tankless = heroes.map((h) => (blue5.includes(h.slug) ? { ...h, roles: ["Mage"] as Role[] } : h));
    expect(estimate(estimateContext(tankless, null), blue5, red5).teams.blue.noTank).toBe(true);
  });

  it("confidence grows with the picks and drops without the rank's measurements", () => {
    expect(confidenceOf(0, true)).toBe("low");
    expect(confidenceOf(3, true)).toBe("low");
    expect(confidenceOf(5, true)).toBe("medium");
    expect(confidenceOf(10, true)).toBe("high");
    expect(confidenceOf(10, false)).toBe("medium");
    expect(confidenceOf(5, false)).toBe("low");
  });
});

describe("next pick", () => {
  it("suggests the counter, then the duo, and says why", () => {
    const heroes = withHero("mid-3", { win: 52 });
    const ctx = estimateContext(
      heroes,
      measures({ weak: { "gold-1": [["mid-2", -5]] }, teammates: { "mid-4": [["gold-0", 3]] } }),
    );
    const list = suggestPicks(ctx, { side: "blue", picks: { blue: ["gold-0"], red: ["gold-1"] }, excluded: new Set() });
    expect(list.map((s) => s.slug)).toEqual(["mid-2", "mid-4", "mid-3"]);
    expect(list[0].reasons[0]).toEqual({ type: "counter", targets: ["gold-1"], points: 5, measured: true });
    expect(list[1].reasons[0]).toEqual({ type: "duo", partners: ["gold-0"], points: 3, measured: true });
    expect(list[2].reasons[0]).toEqual({ type: "strength", rate: 52 });
    expect(list[0].delta).toBeGreaterThan(0);
    expect(list[0].lane).toBe("Mid");
  });

  it("never suggests a banned or picked hero, and keeps to the free lanes", () => {
    const ctx = estimateContext(withHero("gold-2", { win: 70 }), null);
    const list = suggestPicks(ctx, {
      side: "red",
      picks: { blue: ["jungle-0"], red: ["gold-1"] },
      excluded: new Set(["mid-0", "mid-1"]),
      limit: 30,
    });
    const slugs = list.map((s) => s.slug);
    expect(slugs).not.toContain("jungle-0");
    expect(slugs).not.toContain("gold-1");
    expect(slugs).not.toContain("mid-0");
    // The 70 % Gold hero would leave Red with two Gold laners.
    expect(slugs).not.toContain("gold-2");
    expect(list.every((s) => s.lane !== null)).toBe(true);
  });

  it("an even field still gets an argued suggestion: the lane it fills", () => {
    const ctx = estimateContext(roster, null);
    const [first] = suggestPicks(ctx, { side: "blue", picks: { blue: [], red: [] }, excluded: new Set() });
    expect(first.reasons).toEqual([{ type: "lane", lane: first.lane }]);
    expect(first.delta).toBe(0);
  });
});
