import { describe, expect, it } from "vitest";
import { compute, readCount, matchesAuPace, currentWins } from "@/lib/win-rate";

/**
 * Expected values were checked against the community API
 * (arena.rone.dev/api/addon/win-rate-calculator), which does the same
 * computation in floats.
 */
describe("compute — consecutive wins", () => {
  it("matches the API on common cases", () => {
    // API: 25 and 37 wins.
    expect(compute({ matches: 100, rate: 50, objective: 60 })).toEqual({
      state: "wins",
      wins: 25,
      currentWins: 50,
    });
    expect(compute({ matches: 250, rate: 48.5, objective: 55 })).toMatchObject({ state: "wins", wins: 37 });
  });

  it("stays exact where floats overflow", () => {
    // The API answers 4991: 5 + 4990 wins out of 5000 matches is exactly 99.9 %.
    expect(compute({ matches: 10, rate: 50, objective: 99.9 })).toMatchObject({ state: "wins", wins: 4990 });
  });

  it("infers whole wins from the game's rounded rate", () => {
    expect(currentWins(7, 57.14)).toBe(4);
    expect(currentWins(1234, 52.35)).toBe(646);
  });

  it("declares 100 % unreachable after a loss", () => {
    expect(compute({ matches: 100, rate: 50, objective: 100 })).toMatchObject({ state: "impossible" });
    // Without a loss, 100 % is already there.
    expect(compute({ matches: 12, rate: 100, objective: 100 })).toMatchObject({ state: "reached", margin: 0 });
  });

  it("counts affordable losses when the goal is below the current rate", () => {
    // 60 wins out of 100: after 20 losses, 60 out of 120 is exactly 50 %.
    expect(compute({ matches: 100, rate: 60, objective: 50 })).toEqual({
      state: "reached",
      margin: 20,
      currentWins: 60,
    });
    expect(compute({ matches: 100, rate: 60, objective: 0 })).toMatchObject({ state: "reached", margin: null });
  });

  it("refuses inconsistent input", () => {
    expect(compute({ matches: 0, rate: 50, objective: 60 }).state).toBe("invalid");
    expect(compute({ matches: 10.5, rate: 50, objective: 60 }).state).toBe("invalid");
    expect(compute({ matches: 10, rate: 120, objective: 60 }).state).toBe("invalid");
    expect(compute({ matches: 10, rate: 50, objective: Number.NaN }).state).toBe("invalid");
  });
});

describe("matchesAuPace", () => {
  const s = { matches: 100, rate: 50, objective: 60 };

  it("gives the matches to play at a sustained rate", () => {
    // 10 wins missing, 10 points gained per match at 70 %: 100 matches.
    expect(matchesAuPace(s, 70)).toBe(100);
    expect(matchesAuPace(s, 100)).toBe(25);
  });

  it("returns null if the pace does not reach the goal", () => {
    expect(matchesAuPace(s, 60)).toBeNull();
    expect(matchesAuPace(s, 55)).toBeNull();
  });

  it("returns 0 when the goal is already reached", () => {
    expect(matchesAuPace({ matches: 100, rate: 65, objective: 60 }, 40)).toBe(0);
  });
});

describe("readCount", () => {
  it("accepts a comma, a dot and a percent sign", () => {
    expect(readCount("48,5")).toBe(48.5);
    expect(readCount(" 48.5 % ")).toBe(48.5);
    expect(readCount("1 250")).toBe(1250);
  });

  it("returns null for empty or unreadable input", () => {
    expect(readCount("")).toBeNull();
    expect(readCount("abc")).toBeNull();
  });
});
