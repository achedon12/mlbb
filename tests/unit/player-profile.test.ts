import { describe, expect, it } from "vitest";
import {
  cursorNext,
  readDetailMatch,
  readFrequentHeroes,
  readJson,
  readMatches,
  readSeasons,
  readStats,
  seasonsOf,
} from "@/lib/player-api";
import { GAME_LANE, formatDateMatch, formatGap, formatPercent, plural, ratioKda } from "@/lib/player-format";
import {
  showMatch,
  summarySeason,
  nemeses,
  compareHeroes,
  shownHero,
  belowAverageHeroes,
  bestHero,
  averageOfRank,
  bucketOfRank,
  type HeroRow,
} from "@/lib/player-profile";
import { statsByRank } from "@/lib/tier-list";
import {
  DETAIL_SCHEMA,
  FREQUENT_HEROES,
  ME,
  MATCHES_END,
  MATCHES_TEXT,
  SEASONS,
  STATS,
  detailMatch,
} from "./player-samples";

const data = (text: string) => (readJson(text) as { data: unknown }).data;

describe("readJson — big integers", () => {
  it("keeps cursors and match identifiers intact, as strings", () => {
    const lu = readJson('{"pageInfo":{"nextCursor":4143043017340290910},"bid":4132717739868068601,"k":14}') as {
      pageInfo: { nextCursor: unknown };
      bid: unknown;
      k: unknown;
    };
    expect(lu.pageInfo.nextCursor).toBe("4143043017340290910");
    expect(lu.bid).toBe("4132717739868068601");
    expect(lu.k).toBe(14);
  });
});

describe("readMatches", () => {
  const page = readMatches(data(MATCHES_TEXT));

  it("drops entries without a hero or without a readable identifier", () => {
    expect(page.entries.map((p) => p.hero.hid)).toEqual([17, 84, 20, 36, 999]);
    expect(page.next).toBe("4143043017340290910");
  });

  it("reads a complete match", () => {
    const fanny = page.entries[0];
    expect(fanny).toMatchObject({
      id: "4132717739868068534",
      season: 40,
      eliminations: 14,
      deaths: 1,
      assists: 11,
      lane: 4,
      mvp: true,
      win: true,
      date: 1774857999,
    });
    expect(fanny.note).toBeCloseTo(11.8);
    expect(fanny.hero.image).toMatch(/^https:\/\/akmweb\.youngjoygame\.com\//);
  });

  it("recovers the exact identifier from the numeric `bid` alone", () => {
    expect(page.entries[1].id).toBe("4132717739868068601");
    expect(page.entries[1].win).toBe(false);
  });

  it("rejects an image outside the allowed hosts", () => {
    expect(page.entries[3].hero.image).toBeNull();
  });

  it("tolerates strings, null values, milliseconds and unknown outcome", () => {
    expect(page.entries[4]).toMatchObject({
      eliminations: 4,
      deaths: 0,
      lane: null,
      note: null,
      mvp: false,
      win: null,
      date: 1774820000,
    });
  });

  it("returns an empty page on an unexpected response", () => {
    expect(readMatches(null)).toEqual({ entries: [], next: null });
    expect(readMatches({ result: "x", pageInfo: 3 })).toEqual({ entries: [], next: null });
    expect(readMatches(MATCHES_END.data)).toEqual({ entries: [], next: null });
  });
});

describe("cursorNext", () => {
  it("stops on false hasNext or an empty cursor", () => {
    expect(cursorNext({ nextCursor: "123", hasNext: false })).toBeNull();
    expect(cursorNext({ nextCursor: "", hasNext: true })).toBeNull();
    expect(cursorNext(null)).toBeNull();
  });

  it("accepts a safe numeric cursor and rejects anything that is not a number", () => {
    expect(cursorNext({ nextCursor: 11, hasNext: true })).toBe("11");
    expect(cursorNext({ nextCursor: "11; drop", hasNext: true })).toBeNull();
    expect(cursorNext({ nextCursor: "../info" })).toBeNull();
  });
});

describe("readFrequentHeroes", () => {
  const page = readFrequentHeroes(FREQUENT_HEROES.data);

  it("keeps readable heroes played at least once", () => {
    expect(page.entries.map((h) => h.hero.name)).toEqual(["Ling", "Lolita", "Fanny", "Aurora", "Claude", "Miya"]);
  });

  it("converts strings and caps wins at matches", () => {
    const miya = page.entries.at(-1)!;
    expect(miya).toMatchObject({ matches: 4, wins: 4 });
    expect(miya.hero.hid).toBe(1);
  });

  it("does not follow an empty cursor, even when hasNext is set", () => {
    expect(page.next).toBeNull();
  });
});

describe("readStats and seasons", () => {
  it("reads the schema example", () => {
    const s = readStats(STATS.data);
    expect(s).toMatchObject({ matches: 308, wins: 188, mvp: 73, bestStreak: 11, seasons: [40, 39, 38, 37] });
    expect(s.noteAverage).toBeCloseTo(7.62, 2);
    expect(s.hoursGame).toBeCloseTo(77.95);
  });

  it("returns zeros and missing values, never an exception", () => {
    expect(readStats(null)).toEqual({
      matches: 0,
      wins: 0,
      noteAverage: null,
      hoursGame: null,
      mvp: null,
      bestStreak: null,
      seasons: [],
    });
    expect(readStats({ tc: "12", wc: 20, mvpc: -3 })).toMatchObject({ matches: 12, wins: 12, mvp: null });
  });

  it("deduplicates and sorts seasons, without invalid values", () => {
    expect(seasonsOf(SEASONS.data)).toEqual([40, 39, 38, 37]);
    expect(readSeasons([38, "40", 40, -1, 1.5, "x", null])).toEqual([40, 38]);
    expect(readSeasons(undefined)).toEqual([]);
  });
});

describe("readDetailMatch", () => {
  it("reads the schema example", () => {
    const [moskov] = readDetailMatch(DETAIL_SCHEMA.data);
    expect(moskov).toMatchObject({ team: 2, roleId: 1880233572, zoneId: 57027, win: false });
    expect(moskov.hero.name).toBe("Moskov");
  });

  it("reads a ten-player match", () => {
    expect(readDetailMatch(detailMatch(17, [109, 30, 31, 65, 1], false).data)).toHaveLength(10);
    expect(readDetailMatch({ result: [null, 1, "x"] })).toEqual([]);
  });
});

describe("shownHero", () => {
  it("finds the site's hero page by name", () => {
    expect(shownHero({ hid: 555, name: "Yi Sun-shin", image: null }).slug).toBe("yi-sun-shin");
  });

  it("finds the hero page by game identifier when the name is missing", () => {
    expect(shownHero({ hid: 17, name: "#17", image: null }).slug).toBe("fanny");
    expect(shownHero({ hid: 1, name: "#1", image: null }).slug).toBe("miya");
    expect(shownHero({ hid: 109, name: "#109", image: null }).slug).toBe("aamon");
  });

  it("keeps the service's name and image for a hero unknown to the site", () => {
    const image = "https://akmweb.youngjoygame.com/x.png";
    expect(shownHero({ hid: 999, name: "Nouveau Heros", image })).toEqual({ slug: null, name: "Nouveau Heros", portrait: image });
  });
});

describe("bucketOfRank", () => {
  it("compares below Epic against all ranks combined", () => {
    expect(bucketOfRank(0)).toBe("all");
    expect(bucketOfRank(50)).toBe("all");
  });

  it("follows the buckets measured by the site", () => {
    expect(bucketOfRank(90)).toBe("epic");
    expect(bucketOfRank(140)).toBe("mythic");
    expect(bucketOfRank(166)).toBe("honor");
    expect(bucketOfRank(190)).toBe("glory");
    // Immortel : au-dela de la derniere tranche, compare a Gloire.
    expect(bucketOfRank(240)).toBe("glory");
  });
});

describe("comparison with site averages", () => {
  const frequents = readFrequentHeroes(FREQUENT_HEROES.data).entries;

  it("takes the bucket average, or all ranks as a fallback", () => {
    const m = averageOfRank("ling", "mythic")!;
    const stats = statsByRank("ling");
    expect(m.win).toBe(stats[m.bucket]!.winRate);
    expect(m.bucket).toBe(stats.mythic ? "mythic" : "all");
    expect(averageOfRank("heros-inexistant", "mythic")).toBeNull();
  });

  it("sorts heroes by matches and computes the gap", () => {
    const rows = compareHeroes(frequents, "mythic");
    expect(rows.map((l) => l.hero.slug)).toEqual(["ling", "lolita", "fanny", "aurora", "miya", "claude"]);
    const ling = rows[0];
    expect(ling.rate).toBeCloseTo(68);
    expect(ling.gap).toBeCloseTo(68 - ling.average!);
  });

  it("builds the season summary", () => {
    const b = summarySeason(frequents);
    expect(b).toMatchObject({ matches: 58, wins: 35, heroes: 6 });
    expect(b.rate).toBeCloseTo((35 / 58) * 100);
    expect(summarySeason([])).toEqual({ matches: 0, wins: 0, rate: null, heroes: 0 });
  });
});

describe("advice", () => {
  it("prefers a solid rate over a flattering rate on few matches", () => {
    const best = bestHero(compareHeroes(readFrequentHeroes(FREQUENT_HEROES.data).entries, "mythic"));
    // Fanny 7/8 et Ling 17/25 ; Miya 4/4 n'a pas assez de parties.
    expect(best.map((l) => l.hero.slug)).toEqual(["fanny", "ling"]);
  });

  it("flags heroes clearly below average, most costly first", () => {
    const row = (slug: string, matches: number, gap: number): HeroRow => ({
      hero: { slug, name: slug, portrait: null },
      matches,
      wins: 0,
      rate: 50 + gap,
      average: 50,
      bucketAverage: "mythic",
      gap,
      note: null,
    });
    const sub = belowAverageHeroes([row("a", 20, -5), row("b", 6, -12), row("c", 4, -20), row("d", 30, -2)]);
    expect(sub.map((l) => l.hero.slug)).toEqual(["a", "b"]);
  });
});

describe("nemeses", () => {
  const match = (enemies: number[], win: boolean | null, withTeams = true) => ({
    win,
    participants: readDetailMatch(detailMatch(17, enemies, win ?? false, withTeams).data),
  });

  it("counts opponents from losses, from two onwards", () => {
    const analysis = nemeses(
      [
        match([109, 30, 31, 65, 1], false),
        match([109, 30, 50, 51, 52], false),
        match([109, 60, 61, 62, 63], true),
        // Issue absente de la liste : celle du detail prend le relais.
        match([109, 70, 71, 72, 73], null),
        // Sans le joueur, ou sans equipes : ignorees.
        { win: false, participants: readDetailMatch(DETAIL_SCHEMA.data) },
        match([109, 30, 80, 81, 82], false, false),
      ],
      ME,
    );
    expect(analysis.analyzed).toBe(4);
    expect(analysis.list.map((b) => [b.hero.slug, b.defeats, b.encounters])).toEqual([
      ["aamon", 3, 4],
      ["yi-sun-shin", 2, 2],
    ]);
  });

  it("analyzes nothing when the details do not include the player", () => {
    expect(nemeses([{ win: false, participants: readDetailMatch(DETAIL_SCHEMA.data) }], ME)).toEqual({
      list: [],
      analyzed: 0,
    });
  });
});

describe("formatting", () => {
  it("formats according to the locale", () => {
    expect(formatPercent(62.5, "en")).toBe("62.5%");
    expect(formatPercent(62.5, "fr")).toMatch(/^62,5\s%$/u);
    expect(formatGap(4.25, "en")).toBe("+4.3");
    expect(formatGap(-3, "en")).toBe("-3");
    expect(plural(1, "fr")).toBe("one");
    expect(plural(0, "fr")).toBe("one");
    expect(plural(0, "en")).toBe("other");
    expect(ratioKda(14, 0, 11)).toBe(25);
    expect(GAME_LANE[4]).toBe("Jungle");
  });

  it("dates a match in UTC on the server side", () => {
    expect(formatDateMatch(1774857999, "en", false)).toMatch(/^Mar 30/);
  });

  it("prepares a match for the browser, with nothing beyond what is displayed", () => {
    const [fanny] = readMatches(data(MATCHES_TEXT)).entries;
    const shown = showMatch(fanny);
    expect(shown.hero.slug).toBe("fanny");
    expect(Object.keys(shown).sort()).toEqual(
      ["assists", "date", "deaths", "eliminations", "hero", "id", "lane", "mvp", "note", "win"].sort(),
    );
  });
});
