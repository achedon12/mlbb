import { describe, expect, it } from "vitest";
import {
  WINDOW_SHAPE,
  evolution,
  heroRankSheets,
  positionOf,
  statsByPosition,
  statsByRole,
} from "@/lib/player-analysis";
import { buildsPlayed, counters } from "@/lib/data";
import { readFrequentHeroes, readJson, readMatches, type MatchSummary } from "@/lib/player-api";
import { compareHeroes } from "@/lib/player-profile";
import { FREQUENT_HEROES, historyRaw, pageHistory } from "./player-samples";

const frequents = readFrequentHeroes(FREQUENT_HEROES.data).entries;

/** Match already read; the name "#hid" finds the site's hero page from the game id. */
let number = 0;
const match = (hid: number, lane: number | null, win: boolean | null, date: number | null = null): MatchSummary => ({
  id: String(++number),
  season: 40,
  hero: { hid, name: hid === 999 ? "Nouveau Heros" : `#${hid}`, image: null },
  eliminations: 0,
  deaths: 0,
  assists: 0,
  lane,
  note: null,
  mvp: false,
  win,
  date,
});
const repeat = (n: number, factory: (i: number) => MatchSummary) => Array.from({ length: n }, (_, i) => factory(i));

/** The sample history, read back the way the page does: raw text, big integers included. */
const history = readMatches((readJson(pageHistory(historyRaw(), null)) as { data: unknown }).data).entries;

describe("statsByRole", () => {
  const summary = statsByRole(frequents);

  it("counts each hero in its roles, over the whole season", () => {
    expect(summary.total).toBe(58);
    expect(summary.excluded).toBe(0);
    expect(summary.rows.map((l) => [l.key, l.matches, l.wins])).toEqual([
      ["Assassin", 33, 24],
      // Lolita is Support and Tank: her matches count in both.
      ["Support", 12, 4],
      ["Tank", 12, 4],
      ["Marksman", 7, 5],
      ["Mage", 6, 2],
    ]);
    expect(summary.rows[0].rate).toBeCloseTo((24 / 33) * 100);
    expect(summary.rows[0].part).toBeCloseTo((33 / 58) * 100);
  });

  it("only names a strength and a weakness from the minimum match count", () => {
    // Marksman (5 out of 7) has a better rate than Tank, but too few matches.
    expect(summary.strong).toBe("Assassin");
    expect(summary.weak).toBe("Support");
  });

  it("drops a hero unknown to the site and names nothing without contrast", () => {
    const b = statsByRole([
      { hero: { hid: 999, name: "Nouveau Heros", image: null }, matches: 4, wins: 2, note: null },
      { hero: { hid: 84, name: "Ling", image: null }, matches: 20, wins: 10, note: null },
    ]);
    expect(b).toMatchObject({ total: 24, excluded: 4, strong: null, weak: null });
    expect(statsByRole([])).toEqual({ rows: [], total: 0, excluded: 0, strong: null, weak: null });
  });
});

describe("statsByPosition", () => {
  const matches = [
    ...repeat(12, (i) => match(84, 4, i < 9)),
    ...repeat(10, (i) => match(20, 3, i < 3)),
    ...repeat(3, () => match(36, 2, true)),
    // Without `lid`: Miya has a single position in the catalog, Chou has two, the new hero none.
    ...repeat(2, () => match(1, null, false)),
    match(26, null, true),
    match(999, null, true),
    // Unknown outcome: counts nowhere.
    match(84, 4, null),
  ];
  const summary = statsByPosition(matches);

  it("follows the announced position, and the catalog one when it is unique", () => {
    expect(summary.rows.map((l) => [l.key, l.matches, l.wins])).toEqual([
      ["Jungle", 12, 9],
      ["Roam", 10, 3],
      ["Mid", 3, 3],
      ["Gold", 2, 0],
    ]);
    expect(summary).toMatchObject({ total: 27, excluded: 2, strong: "Jungle", weak: "Roam" });
    expect(summary.rows.reduce((s, l) => s + l.part, 0)).toBeCloseTo(100);
  });

  it("reads an out-of-range position as missing", () => {
    expect(positionOf(match(84, 9, true))).toBe("Jungle");
    expect(positionOf(match(26, 9, true))).toBeNull();
  });
});

describe("evolution", () => {
  const evo = evolution(history);

  it("counts streaks and form without matches of unknown outcome", () => {
    expect(history).toHaveLength(31);
    expect(evo).toMatchObject({
      matches: 30,
      wins: 18,
      ongoingSeries: { win: true, length: 4 },
      bestStreak: 7,
      worstStreak: 4,
      shape: 70,
    });
  });

  it("plots the rolling and cumulative rates from the first full window", () => {
    const curve = evo.curve!;
    expect(curve.rolling).toHaveLength(30 - WINDOW_SHAPE + 1);
    expect(curve.cumulative).toHaveLength(curve.rolling.length);
    expect(curve.dates).toHaveLength(curve.rolling.length);
    expect(curve.rolling[0]).toBe(60);
    expect(curve.rolling.at(-1)).toBe(70);
    expect(curve.cumulative.at(-1)).toBe(60);
    expect(curve.dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
    expect(curve.dates[0]).toBe("2026-03-03");
    expect(curve.dates.at(-1)).toBe("2026-03-08");
  });

  it("dates a match without a timestamp from its neighbor", () => {
    const withoutDate = [match(84, 4, true, null), ...repeat(11, (i) => match(84, 4, i % 2 === 0, 1774857999 - i * 60))];
    const curve = evolution(withoutDate).curve!;
    expect(curve.dates.at(-1)).toBe(curve.dates.at(-2));
  });

  it("gives up the chart without enough matches or without any date", () => {
    const short = evolution(repeat(WINDOW_SHAPE, (i) => match(84, 4, i < 5, 1774857999)));
    expect(short).toMatchObject({ matches: WINDOW_SHAPE, shape: 50, curve: null });
    expect(evolution(repeat(15, (i) => match(84, 4, i < 5))).curve).toBeNull();
    expect(evolution([])).toMatchObject({ matches: 0, ongoingSeries: null, shape: null, curve: null, bestStreak: 0 });
  });
});

describe("heroRankSheets", () => {
  const rows = compareHeroes(frequents, "mythic");

  it("gives the most played heroes the rank's most played build and worst counters", () => {
    const sheets = heroRankSheets(rows, "mythic", history);
    expect(sheets.map((f) => f.row.hero.slug)).toEqual(["ling", "lolita", "fanny"]);

    const ling = sheets[0];
    const expected = [...buildsPlayed.ling.Jungle.mythic!].sort((a, b) => (b.pickRate ?? 0) - (a.pickRate ?? 0))[0];
    expect(ling).toMatchObject({ lane: "Jungle", rankBuild: "mythic", rankCounters: "mythic" });
    expect(ling.build!.items.map((o) => o.name)).toEqual(expected.items);
    expect(ling.build!.items[0].slug).not.toBeNull();

    const worst = [...counters.ling.mythic!.weak].sort((a, b) => a.advantage - b.advantage).slice(0, 3);
    expect(ling.weak.map((c) => c.hero.slug)).toEqual(worst.map((c) => c.slug));
    const gaps = ling.weak.map((c) => c.advantage);
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(gaps.every((e) => e < 0)).toBe(true);
  });

  const row = (hid: number, name: string, matches: number, wins: number) =>
    compareHeroes([{ hero: { hid, name, image: null }, matches, wins, note: null }], "mythic");

  it("keeps the position where the player plays the hero, otherwise the catalog one", () => {
    const chou = row(26, "Chou", 10, 5);
    const inRoam = heroRankSheets(chou, "mythic", [match(26, 3, true), match(26, 3, false), match(26, 1, true)]);
    expect(inRoam[0].lane).toBe("Roam");
    expect(inRoam[0].build!.items[0].name).toBe("Dominance Ice");
    expect(heroRankSheets(chou, "mythic", [])[0].lane).toBe("Exp");
  });

  it("skips heroes unknown to the site and stops at the requested count", () => {
    expect(heroRankSheets(row(999, "Nouveau Heros", 30, 3), "mythic", [])).toEqual([]);
    expect(heroRankSheets(rows, "mythic", [], 1)).toHaveLength(1);
  });
});
