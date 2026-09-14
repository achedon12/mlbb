import { describe, expect, it } from "vitest";
import { spreadHistory } from "@/lib/evolution";
import {
  chooseGuide,
  heroCombos,
  compactHistory,
  dateOfDay,
  mergeHistory,
  numberDay,
  pointsOf,
  dailyStreak,
} from "../../scripts/measures.mjs";

const point = (date, winRate) => ({ date, winRate, banRate: winRate / 10, pickRate: winRate / 100 });
/** `n` consecutive days from `start`, the rate rising by 0.1 point per day. */
const days = (start, n, base = 50) =>
  Array.from({ length: n }, (_, k) => point(dateOfDay(numberDay(start) + k), Math.round((base + k / 10) * 10) / 10));

describe("dailyStreak", () => {
  it("aligns days and leaves a gap for a missing day", () => {
    const s = dailyStreak([point("2026-09-03", 52), point("2026-09-01", 50)]);
    expect(s.start).toBe("2026-09-01");
    expect(s.winRate).toEqual([50, null, 52]);
    expect(s.banRate).toEqual([5, null, 5.2]);
  });

  it("returns null without any point", () => {
    expect(dailyStreak([])).toBeNull();
  });

  it("reads back as dated points", () => {
    const s = dailyStreak([point("2026-08-31", 49), point("2026-09-01", 50)]);
    expect(pointsOf(s).map((p) => p.date)).toEqual(["2026-08-31", "2026-09-01"]);
    expect(pointsOf(null)).toEqual([]);
  });
});

describe("mergeHistory", () => {
  it("accumulates days from successive syncs", () => {
    const first = mergeHistory({}, { aamon: { all: dailyStreak([point("2026-09-01", 50)]) } });
    const second = mergeHistory(first, { aamon: { all: dailyStreak([point("2026-09-03", 53)]) } });
    expect(second.aamon.start).toBe("2026-09-01");
    expect(second.aamon.winRate).toEqual([50, null, 53]);
  });

  it("replaces an already known day with the most recent measure", () => {
    const old = mergeHistory({}, { aamon: { all: dailyStreak([point("2026-09-01", 50)]) } });
    const merged = mergeHistory(old, { aamon: { all: dailyStreak([point("2026-09-01", 51)]) } });
    expect(merged.aamon.winRate).toEqual([51]);
  });

  it("keeps a hero missing from the latest sync", () => {
    const old = mergeHistory({}, { aamon: { all: dailyStreak([point("2026-09-01", 50)]) } });
    expect(mergeHistory(old, {}).aamon.winRate).toEqual([50]);
  });

  it("reads a pre-compaction file and compacts it along the way", () => {
    // Exactly 120 days, legacy format: nothing under `weeks`.
    const old = { aamon: dailyStreak(days("2026-05-01", 120)) };
    const trends = { aamon: { all: dailyStreak(days("2026-08-29", 1, 60)) } };
    const s = mergeHistory(old, trends).aamon;
    expect(s.weeks.start).toBe("2026-04-27");
    expect(s.winRate.at(-1)).toBe(60);
    expect(pointsOf(s).length + 7 * s.weeks.winRate.length).toBeGreaterThanOrEqual(121);
  });

  it("never re-averages an already compacted week", () => {
    const one = mergeHistory({}, { aamon: { all: dailyStreak(days("2026-01-05", 120)) } });
    const two = mergeHistory(one, { aamon: { all: dailyStreak(days("2026-05-05", 20, 55)) } });
    expect(two.aamon.weeks.winRate.slice(0, one.aamon.weeks.winRate.length)).toEqual(
      one.aamon.weeks.winRate,
    );
  });
});

describe("compactHistory", () => {
  it("keeps 90 days day by day, starting on a Monday, and averages the weeks before", () => {
    // 2026-06-01 is a Monday; 150 days lead to 2026-10-28.
    const s = compactHistory(days("2026-06-01", 150));
    expect(new Date(`${s.start}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(s.winRate.length).toBeGreaterThanOrEqual(90);
    expect(s.winRate.length).toBeLessThan(97);
    expect(s.winRate.at(-1)).toBe(64.9);
    expect(s.weeks.start).toBe("2026-06-01");
    // First week: 50.0 … 50.6, average 50.3.
    expect(s.weeks.winRate[0]).toBe(50.3);
    expect(s.weeks.pickRate[0]).toBe(0.5);
    expect(numberDay(s.weeks.start) + 7 * s.weeks.winRate.length).toBe(numberDay(s.start));
  });

  it("creates no weeks while the history fits in the window", () => {
    const s = compactHistory(days("2026-06-01", 60));
    expect(s.weeks).toBeUndefined();
    expect(s.winRate).toHaveLength(60);
  });

  it("leaves a gap for a week without measures and averages what exists", () => {
    const points = [point("2026-01-05", 50), point("2026-01-07", 52), point("2026-01-20", 49), ...days("2026-03-01", 100)];
    const s = compactHistory(points);
    expect(s.weeks.winRate.slice(0, 3)).toEqual([51, null, 49]);
    expect(s.weeks.banRate[1]).toBeNull();
  });

  it("returns null without any point", () => {
    expect(compactHistory([])).toBeNull();
  });
});

describe("spreadHistory", () => {
  it("returns a continuous daily series, weeks interpolated down to days", () => {
    const stored = compactHistory(days("2026-06-01", 150));
    const s = spreadHistory(stored);
    // First point: the Thursday of the first week, at its average.
    expect(s.start).toBe("2026-06-04");
    expect(s.winRate[0]).toBe(50.3);
    expect(s.winRate.every((v) => v !== null)).toBe(true);
    expect(s.pickRate.every((v) => v !== null)).toBe(true);
    // The recent part is returned as is, at its date.
    expect(s.winRate.slice(-stored.winRate.length)).toEqual(stored.winRate);
    expect(numberDay(s.start) + s.winRate.length - 1).toBe(numberDay("2026-10-28"));
    // A linear series stays linear: no step between two weeks.
    expect(s.winRate[3]).toBeCloseTo(50.6, 1);
  });

  it("crosses a week without measures without leaving a gap", () => {
    const points = [point("2026-01-05", 50), point("2026-01-19", 52), ...days("2026-03-01", 100)];
    const s = spreadHistory(compactHistory(points));
    expect(s.winRate.slice(0, 15)).not.toContain(null);
    expect(s.winRate[7]).toBe(51);
  });

  it("leaves a history without weeks untouched", () => {
    const series = dailyStreak([point("2026-09-01", 50), point("2026-09-03", 52)]);
    expect(spreadHistory(series)).toEqual(series);
  });
});

describe("heroCombos", () => {
  const skill = (id, name) => ({ id, name, icon: `https://cdn/${id}.png` });
  const sheet = [skill(10940, "Invisible Armor"), skill(10910, "Soul Shards"), skill(10920, "Slayer Shards")];
  const site = [{ name: "Invisible Armor" }, { name: "Soul Shards" }, { name: "Slayer Shards" }];
  const icons = { "Soul Shards": "/visuels/competences/soul-shards.webp" };
  const record = (title, desc, ids) => ({
    data: { title, desc, skill_id: ids.map((skillid) => ({ data: { skillid, skillicon: `https://cdn/${skillid}.png` } })) },
  });

  it("finds the site name and local icon, otherwise keeps the remote icon", () => {
    const [combo] = heroCombos([record("LANING COMBOS", "Use  skills\nthen attack.", [10910, 10920])], sheet, site, icons);
    expect(combo).toEqual({
      type: "laning",
      description: "Use skills then attack.",
      skills: [
        { name: "Soul Shards", icon: "/visuels/competences/soul-shards.webp" },
        { name: "Slayer Shards", icon: "https://cdn/10920.png" },
      ],
    });
  });

  it("recognizes the basic attack by its round identifier", () => {
    const [combo] = heroCombos([record("TEAMFIGHT COMBOS", "Go.", [10900])], sheet, site, icons);
    expect(combo.skills[0]).toEqual({ name: null, icon: "https://cdn/10900.png", basicAttack: true });
  });

  it("gives a transformed form its own icon, not the base form's", () => {
    const transformed = [...sheet, skill(2010910, "Soul Shards")];
    const [combo] = heroCombos([record("LANING COMBOS", "Go.", [2010910])], transformed, site, icons);
    expect(combo.skills[0]).toEqual({ name: "Soul Shards", icon: "https://cdn/2010910.png" });
  });

  it("puts the laning phase before team fights and drops empty combos", () => {
    const combos = heroCombos(
      [record("TEAMFIGHT COMBOS", "B.", [10910]), record("LANING COMBOS", "A.", [10920]), record("X", "", [10910])],
      sheet,
      site,
      icons,
    );
    expect(combos.map((c) => c.type)).toEqual(["laning", "teamfight"]);
  });
});

describe("chooseGuide", () => {
  const guide = (authorRank, votes, views = 0) => ({ authorRank, votes, views });

  it("takes the most upvoted among authors of the rank", () => {
    const candidates = [guide(140, 3), guide(150, 9), guide(190, 50)];
    expect(chooseGuide(candidates, "mythic")).toEqual(guide(150, 9));
  });

  it("falls back to an author of a higher rank", () => {
    expect(chooseGuide([guide(170, 2), guide(90, 40)], "legend")).toEqual(guide(170, 2));
  });

  it("never accepts an author of a lower rank", () => {
    expect(chooseGuide([guide(90, 40)], "glory")).toBeNull();
  });

  it("breaks vote ties by views", () => {
    expect(chooseGuide([guide(100, 5, 10), guide(100, 5, 99)], "all")).toEqual(guide(100, 5, 99));
  });
});
