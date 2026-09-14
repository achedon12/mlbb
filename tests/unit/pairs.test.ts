import { describe, expect, it } from "vitest";
import { normalize, valuesRadar } from "@/components/hero-radar";
import type { CountersByRank } from "@/lib/data";
import type { DuosByRank } from "@/lib/duos";
import {
  measuredOpponents,
  pathPair,
  duelOfReference,
  duelByRank,
  duosAsCounters,
  readPhases,
  linksTeam,
  readPair,
  bestByPhase,
  pairsMeasured,
  phaseOf,
  phasesDuel,
  phasesDuo,
  ranksWon,
  segmentPair,
  rateByPhase,
} from "@/lib/pairs";

const rank = (strong: [string, number][], weak: [string, number][] = []) => ({
  strong: strong.map(([slug, advantage]) => ({ slug, advantage })),
  weak: weak.map(([slug, advantage]) => ({ slug, advantage })),
  winRate: 50,
});

const counters: Record<string, CountersByRank> = {
  aamon: { all: rank([["fanny", 2]], [["gusion", -3]]), mythic: rank([["fanny", 1.5]]) },
  fanny: { mythic: rank([], [["aamon", -1.1]]), epic: rank([["x-borg", 0.4]]) },
  "x-borg": { all: rank([["aamon", 0.2], ["ghost", 5]]) },
};
const exists = (s: string) => s !== "ghost";

describe("pair path", () => {
  it("puts slugs in alphabetical order", () => {
    expect(segmentPair("fanny", "aamon")).toBe("aamon-vs-fanny");
    expect(pathPair("yi-sun-shin", "x-borg")).toBe("/compare/x-borg-vs-yi-sun-shin");
  });

  it("reads a segment back, including hyphens in slugs", () => {
    expect(readPair("x-borg-vs-yi-sun-shin")).toEqual({ a: "x-borg", b: "yi-sun-shin", canonical: true });
    expect(readPair("fanny-vs-aamon")).toEqual({ a: "fanny", b: "aamon", canonical: false });
  });

  it("rejects a malformed segment or a hero against itself", () => {
    for (const s of ["aamon", "-vs-aamon", "aamon-vs-", "aamon-vs-aamon", "a-vs-b-vs-c"]) expect(readPair(s)).toBeNull();
  });
});

describe("pairsMeasured", () => {
  it("keeps each pair once, in either direction, without unknown heroes", () => {
    expect(pairsMeasured(counters, exists)).toEqual(["aamon-vs-fanny", "aamon-vs-gusion", "aamon-vs-x-borg", "fanny-vs-x-borg"]);
  });
});

describe("measuredOpponents", () => {
  it("keeps the most marked gap, in both directions, from widest to narrowest", () => {
    expect(measuredOpponents(counters, "aamon")).toEqual([
      { slug: "gusion", gap: 3 },
      { slug: "fanny", gap: 2 },
      { slug: "x-borg", gap: 0.2 },
    ]);
  });
});

describe("duelByRank", () => {
  it("averages both points of view when they exist", () => {
    const duels = duelByRank(counters, "aamon", "fanny");
    expect(duels).toEqual([
      { rank: "all", aAgainstB: 2, bAgainstA: null, advantage: 2 },
      { rank: "mythic", aAgainstB: 1.5, bAgainstA: -1.1, advantage: 1.3 },
    ]);
    expect(duelOfReference(duels)?.rank).toBe("mythic");
  });

  it("gives the advantage from the first hero's point of view", () => {
    const duels = duelByRank(counters, "fanny", "aamon");
    expect(duels.find((d) => d.rank === "mythic")?.advantage).toBe(-1.3);
    expect(duelOfReference([])).toBeNull();
  });

  it("counts bucket ranks won, excluding all ranks and ties", () => {
    const duels = [
      { rank: "all" as const, aAgainstB: 1, bAgainstA: null, advantage: 1 },
      { rank: "epic" as const, aAgainstB: 1, bAgainstA: null, advantage: 1 },
      { rank: "legend" as const, aAgainstB: -2, bAgainstA: null, advantage: -2 },
      { rank: "glory" as const, aAgainstB: 0.1, bAgainstA: null, advantage: 0.1 },
    ];
    expect(ranksWon(duels)).toEqual({ a: 1, b: 1, total: 3 });
  });
});

describe("game phases", () => {
  const alone = [
    { from: 10, to: 12, winRate: 50 },
    { from: 12, to: 14, winRate: 51 },
    { from: 14, to: 16, winRate: 50 },
    { from: 16, to: 18, winRate: 50 },
    { from: 18, to: 20, winRate: 49 },
    { from: 20, to: null, winRate: 48 },
  ];

  it("sorts minutes into early, mid and late game", () => {
    expect([10, 13, 14, 17, 18, 20].map(phaseOf)).toEqual(["early", "early", "mid", "mid", "late", "late"]);
    expect(rateByPhase(alone)).toEqual({ early: 50.5, mid: 50, late: 48.5 });
    expect(rateByPhase(undefined)).toEqual({ early: null, mid: null, late: null });
  });

  it("measures the duo's gain over the hero alone, bucket by bucket", () => {
    const p = phasesDuo([52, 53, null, 51, 50, 52], alone);
    expect(p).toEqual([
      { phase: "early", win: 52.5, gain: 2 },
      { phase: "mid", win: 51, gain: 1 },
      { phase: "late", win: 51, gain: 2.5 },
    ]);
    // Without the solo hero's curve, the duo's rate remains, with no gain.
    expect(phasesDuo([52, null, null, null, null, null], undefined)).toEqual([{ phase: "early", win: 52, gain: null }]);
  });

  it("picks the best partner for each phase", () => {
    const duos = [
      { slug: "marcel", advantage: 1, phases: [60, 58, 52, 51, 49, 48] },
      { slug: "grock", advantage: 1, phases: [47, 48, 53, 53, 52, 53] },
    ];
    expect(bestByPhase(duos, alone).map((p) => [p.phase, p.slug])).toEqual([
      ["early", "marcel"],
      ["mid", "grock"],
      ["late", "grock"],
    ]);
    expect(bestByPhase([{ slug: "akai", advantage: 1 }], alone)).toEqual([]);
  });

  it("reads who leads by game length between two heroes", () => {
    const other = alone.map((x) => ({ ...x, winRate: x.from < 14 ? 49 : 51 }));
    const duel = phasesDuel(alone, other);
    expect(duel.map((x) => x.gap)).toEqual([1.5, -1, -2.5]);
    expect(readPhases(duel)).toEqual({ a: "early", b: "late" });
    expect(readPhases(phasesDuel(undefined, other))).toEqual({ a: null, b: null });
  });
});

describe("same team", () => {
  const duos: Record<string, DuosByRank> = {
    aamon: { mythic: { winRate: 51, best: [{ slug: "fanny", advantage: 1.2 }], worst: [] } },
    fanny: { all: { winRate: 50, best: [], worst: [{ slug: "aamon", advantage: -6.1 }] } },
  };

  it("reads duos in the counters format", () => {
    expect(duosAsCounters(duos.aamon).mythic?.strong[0]).toEqual({ slug: "fanny", advantage: 1.2 });
  });

  it("takes duos first, academy teammates as a fallback", () => {
    const teammates = { aamon: { all: [{ slug: "fanny", advantage: 0.8 }], mythic: [{ slug: "fanny", advantage: 9 }] } };
    expect(linksTeam(duos, teammates, "aamon", "fanny")).toEqual([
      { rank: "all", from: "aamon", partner: "fanny", advantage: 0.8, source: "teammates" },
      { rank: "all", from: "fanny", partner: "aamon", advantage: -6.1, source: "duos" },
      { rank: "mythic", from: "aamon", partner: "fanny", advantage: 1.2, source: "duos" },
    ]);
  });
});

describe("radar", () => {
  it("scales a rate to the rank's range, the lowest staying visible", () => {
    expect(normalize(45, [45, 55])).toBe(0.1);
    expect(normalize(55, [45, 55])).toBe(1);
    expect(normalize(60, [45, 55])).toBe(1);
    expect(normalize(50, [50, 50])).toBe(0.55);
    expect(normalize(null, [45, 55])).toBeNull();
  });

  it("gives six values: four ratings out of 10, then win and ban", () => {
    const notes = { offense: 7, durability: 3, abilityEffects: null, difficulty: 12 };
    expect(valuesRadar(notes, { win: 55, ban: 0 }, { win: [45, 55], ban: [0, 50] })).toEqual([
      0.7, 0.3, null, 1, 1, 0.1,
    ]);
    expect(valuesRadar(notes, null, null).slice(4)).toEqual([null, null]);
  });
});
