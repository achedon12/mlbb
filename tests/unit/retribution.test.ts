import { describe, expect, it } from "vitest";
import {
  OBJECTIVE_KEYS,
  DIFFICULTY_ORDER,
  RECORDS_EMPTY,
  afterRound,
  afterRun,
  runSummary,
  hitNext,
  createRandom,
  damageRetribution,
  evaluateHit,
  readRecords,
  pointsHit,
  prepareRound,
  resultStolen,
} from "@/lib/retribution";

describe("Retribution damage", () => {
  it("follows 520 + 80 x level, from 600 to 1720", () => {
    expect(damageRetribution(1)).toBe(600);
    expect(damageRetribution(9)).toBe(1240);
    expect(damageRetribution(15)).toBe(1720);
  });

  it("clamps the level between 1 and 15", () => {
    expect(damageRetribution(0)).toBe(600);
    expect(damageRetribution(30)).toBe(1720);
  });
});

describe("strike verdict", () => {
  it("judges a strike above the threshold too early, with the remaining HP", () => {
    const r = evaluateHit({ hp: 2000, threshold: 1240, hpCrossing: null, reaction: null });
    expect(r.issue).toBe("tooEarly");
    expect(r.points).toBe(0);
    expect(r.rest).toBe(760);
  });

  it("gives 1000 points to an immediate strike, before any new hit", () => {
    const r = evaluateHit({ hp: 1100, threshold: 1240, hpCrossing: 1100, reaction: 120 });
    expect(r.issue).toBe("secured");
    expect(r.accuracy).toBe(1);
    expect(r.points).toBe(1000);
  });

  it("takes points from those who wait: less HP kept, slower reaction", () => {
    expect(pointsHit(0.5, 150)).toBeLessThan(pointsHit(1, 150));
    expect(pointsHit(1, 600)).toBeLessThan(pointsHit(1, 200));
    expect(pointsHit(1, 5000)).toBe(700);
    expect(pointsHit(0, 5000)).toBe(0);
  });
});

describe("hit generation", () => {
  it("replays a round identically with the same seed", () => {
    const play = (seed: number) => {
      const random = createRandom(seed);
      const round = prepareRound("lord", "hard", 9, random);
      const hp = [round.hpStart];
      for (let i = 0; i < 20; i += 1) hp.push(hitNext(hp.at(-1)!, round, "hard", random).hpAfter);
      return hp;
    };
    expect(play(42)).toEqual(play(42));
    expect(play(42)).not.toEqual(play(43));
  });

  it("starts above the threshold, without exceeding the monster's HP", () => {
    for (const objective of OBJECTIVE_KEYS) {
      for (const difficulty of DIFFICULTY_ORDER) {
        const m = prepareRound(objective, difficulty, 15, createRandom(7));
        expect(m.hpStart).toBeGreaterThan(m.threshold);
        expect(m.hpStart).toBeLessThanOrEqual(m.hpMax);
      }
    }
  });

  it("always leaves a strike window when the threshold is crossed", () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const random = createRandom(1234);
      for (let attempt = 0; attempt < 500; attempt += 1) {
        const round = prepareRound("turtle", difficulty, 4, random);
        let hp = round.hpStart;
        while (hp > round.threshold) {
          const hit = hitNext(hp, round, difficulty, random);
          if (hit.hpAfter <= round.threshold) {
            expect(hit.hpAfter).toBeGreaterThanOrEqual(Math.floor(round.threshold * 0.3));
            expect(hit.damage).toBe(hp - hit.hpAfter);
          }
          hp = hit.hpAfter;
        }
      }
    }
  });
});

describe("streak and records", () => {
  const passed = (points: number, reaction: number, accuracy: number) => ({
    issue: "secured" as const,
    points,
    accuracy,
    reaction,
    rest: null,
    reactionEnemy: null,
  });

  it("sums up a streak", () => {
    const b = runSummary([passed(900, 210, 1), resultStolen(400), passed(700, 350, 0.5)]);
    expect(b).toEqual({ total: 1600, secured: 2, rounds: 3, bestReaction: 210, accuracyAverage: 0.75 });
  });

  it("counts consecutive successful strikes and keeps the best run", () => {
    let r = RECORDS_EMPTY;
    for (const issue of ["secured", "secured", "stolen", "secured"] as const) r = afterRound(r, issue);
    expect(r.enCours).toBe(1);
    expect(r.meilleureSuite).toBe(2);
  });

  it("only overwrites a record when it is beaten", () => {
    const summary = runSummary([passed(900, 210, 1)]);
    const first = afterRun(RECORDS_EMPTY, "seigneur:pro", summary, "2026-09-11");
    expect(first.isNewRecord).toBe(true);
    const second = afterRun(first.records, "seigneur:pro", runSummary([passed(500, 400, 1)]), "2026-09-12");
    expect(second.isNewRecord).toBe(false);
    expect(second.records.series["seigneur:pro"].total).toBe(900);
  });

  it("ignores unreadable or malformed stored records", () => {
    expect(readRecords("{pas du json")).toEqual(RECORDS_EMPTY);
    expect(readRecords(JSON.stringify({ enCours: -3, meilleureSuite: "x", series: { a: { total: "1" } } }))).toEqual(
      RECORDS_EMPTY,
    );
    expect(readRecords(JSON.stringify({ enCours: 2, meilleureSuite: 5, series: {} })).meilleureSuite).toBe(5);
  });
});
