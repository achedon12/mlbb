import { describe, expect, it } from "vitest";
import type { CountersByRank } from "@/lib/data";
import { coverage, gapOf, measuredDuels, measuredGaps, readMatrix, writeMatrix } from "@/lib/matchups";
import { MEASURED_RANKS } from "@/lib/measured-ranks";

const rank = (strong: [string, number][], weak: [string, number][] = []) => ({
  strong: strong.map(([slug, advantage]) => ({ slug, advantage })),
  weak: weak.map(([slug, advantage]) => ({ slug, advantage })),
  winRate: 50,
});

const counters: Record<string, CountersByRank> = {
  aamon: { all: rank([["fanny", 2]], [["gusion", -3]]), mythic: rank([["fanny", 1.5]]) },
  fanny: { all: rank([], [["aamon", -2]]), epic: rank([["x-borg", 0.4]]) },
  gusion: { all: rank([["ghost", 5]]) },
  "x-borg": { all: rank([["aamon", 0.3]]) },
};
const exists = (s: string) => s !== "ghost";

describe("measuredGaps", () => {
  it("keeps one figure per duel, from the first hero's point of view", () => {
    expect(measuredGaps(counters, "all", exists)).toEqual({
      "aamon-vs-fanny": 2,
      "aamon-vs-gusion": -3,
      "aamon-vs-x-borg": -0.3,
    });
  });

  it("reads the chosen rank only, and leaves out unknown heroes", () => {
    expect(measuredGaps(counters, "mythic", exists)).toEqual({ "aamon-vs-fanny": 1.5 });
    expect(measuredGaps(counters, "epic", exists)).toEqual({ "fanny-vs-x-borg": 0.4 });
    expect(measuredGaps(counters, "glory", exists)).toEqual({});
  });

  it("averages two views that a rounding sets apart", () => {
    const close = { a: { all: rank([["b", 2.1]]) }, b: { all: rank([], [["a", -2.2]]) } };
    expect(measuredGaps(close, "all", () => true)).toEqual({ "a-vs-b": 2.2 });
  });
});

describe("gapOf and measuredDuels", () => {
  const gaps = measuredGaps(counters, "all", exists);

  it("turns the gap to the row hero's side, and has no value for an unmeasured duel", () => {
    expect(gapOf(gaps, "aamon", "gusion")).toBe(-3);
    expect(gapOf(gaps, "gusion", "aamon")).toBe(3);
    expect(gapOf(gaps, "fanny", "gusion")).toBeNull();
    expect(gapOf(gaps, "aamon", "aamon")).toBeNull();
  });

  it("lists the measured cells only, from the most one-sided", () => {
    expect(measuredDuels(gaps, ["aamon", "fanny"], ["gusion", "x-borg", "fanny"])).toEqual([
      { hero: "aamon", opponent: "gusion", gap: -3 },
      { hero: "aamon", opponent: "fanny", gap: 2 },
      { hero: "aamon", opponent: "x-borg", gap: -0.3 },
    ]);
  });

  it("counts the possible duels of the roster", () => {
    expect(coverage(gaps, 4)).toEqual({ measured: 3, possible: 6 });
  });
});

describe("matrix URL", () => {
  const known = new Set(["aamon", "fanny", "gusion", "x-borg"]);

  it("reads both lineups and the rank, unknown heroes and duplicates dropped", () => {
    expect(readMatrix("?a=aamon,ghost,aamon&b=fanny,x-borg&rang=mythic", known, MEASURED_RANKS)).toEqual({
      rows: ["aamon"],
      columns: ["fanny", "x-borg"],
      rank: "mythic",
    });
  });

  it("puts a hero on one side only, and ignores an unknown rank", () => {
    expect(readMatrix("?a=aamon&b=aamon,fanny&rang=bronze", known, MEASURED_RANKS)).toEqual({
      rows: ["aamon"],
      columns: ["fanny"],
      rank: null,
    });
  });

  it("writes the lineups and the rank, keeps other parameters, omits all ranks", () => {
    expect(writeMatrix("?utm=x&a=old", { rows: ["aamon"], columns: ["fanny", "x-borg"], rank: "glory" })).toBe(
      "a=aamon&b=fanny,x-borg&utm=x&rang=glory",
    );
    expect(writeMatrix("", { rows: [], columns: [], rank: "all" })).toBe("");
  });

  it("reads back what it writes", () => {
    const settings = { rows: ["gusion", "aamon"], columns: ["fanny"], rank: "legend" as const };
    expect(readMatrix(`?${writeMatrix("", settings)}`, known, MEASURED_RANKS)).toEqual(settings);
  });
});
