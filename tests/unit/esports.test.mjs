import { describe, expect, it } from "vitest";
import {
  analyzePage,
  buildTournament,
  createHeroResolver,
  heroCounts,
  params,
  partialDate,
  prepare,
  rankStandings,
  readAliasTable,
  readDate,
  readInfobox,
  readMatch,
  sourceLabel,
  stageKey,
} from "../../scripts/esports-analysis.mjs";

/** Small excerpts modeled on Liquipedia's wikitext. */
const game = (winner, p1, p2, b1 = [], b2 = []) =>
  `{{Map|team1side=blue |team2side=red |length=16:51 |winner=${winner}
    ${p1.map((h, i) => `|t1h${i + 1}=${h}`).join(" ")}
    ${p2.map((h, i) => `|t2h${i + 1}=${h}`).join(" ")}
    <!-- Hero bans -->
    ${b1.map((h, i) => `|t1b${i + 1}=${h}`).join(" ")}
    ${b2.map((h, i) => `|t2b${i + 1}=${h}`).join(" ")}
  }}`;

const match = (t1, t2, games, date = "August 14, 2026 - 15:00 {{abbr/ICT}}", bestOf = 3) =>
  `{{Match|bestof=${bestOf}
    |opponent1={{TeamOpponent|${t1}}}
    |opponent2={{TeamOpponent|${t2}}}
    |date=${date}
    ${games.map((g, i) => `|map${i + 1}=${g}`).join("\n")}
  }}`;

const SITE_HEROES = [
  { slug: "guinevere", name: "Guinevere" },
  { slug: "yi-sun-shin", name: "Yi Sun-shin" },
  { slug: "x-borg", name: "X.Borg" },
  { slug: "atlas", name: "Atlas" },
  { slug: "claude", name: "Claude" },
  { slug: "fanny", name: "Fanny" },
];
const ALIASES = readAliasTable(`return {
  ['guin'] = 'Guinevere',
  ['yss'] = 'Yi Sun-shin',
  ['chang\\'e'] = 'Chang\\'e',
}`);

describe("wikitext", () => {
  it("splits parameters at the top level only", () => {
    const p = params("Template|a={{X|b=1|c}}|[[Page|label]]|d = 2 ");
    expect(p.named.get("a")).toBe("{{X|b=1|c}}");
    expect(p.named.get("d")).toBe("2");
    expect(p.positional).toEqual(["[[Page|label]]"]);
  });

  it("keeps the comment naming a round and drops the others", () => {
    const text = prepare("{{Bracket|id=X\n<!-- Grand Final -->\n|R1M1={{Match}}\n<!-- note -->|a=1}}");
    expect(text).toContain("|§header=Grand Final");
    expect(text).not.toContain("note");
  });

  it("reads an infobox: partial dates, prize pool, commented value ignored", () => {
    const info = readInfobox(
      prepare(`{{Infobox league
        |name=MPL Malaysia Season 18
        |prizepoolusd=<!--100000-->
        |localcurrency=idr
        |sdate=2026-08-14 |edate=2026-11-??
        |team_number=8
        |next=MPL/Malaysia/Season_19{{!}}Season 19
      }}`),
    );
    expect(info).toMatchObject({
      name: "MPL Malaysia Season 18",
      startDate: "2026-08-14",
      endDate: "2026-11",
      prizePool: null,
      teamCount: 8,
      next: "MPL/Malaysia/Season 19",
    });
    expect(readInfobox("{{Infobox league|prizepoolusd=1,000,000}}").prizePool).toEqual({ amount: 1_000_000, currency: "USD" });
    expect(readInfobox("{{Infobox league|prizepool=4860000000|localcurrency=idr}}").prizePool).toEqual({
      amount: 4_860_000_000,
      currency: "IDR",
    });
    expect(partialDate("2026-??-??")).toBe("2026");
  });

  it("converts match dates to UTC, and keeps the day only without a known zone", () => {
    expect(readDate("August 14, 2026 - 15:00 {{abbr/ICT}}")).toBe("2026-08-14T08:00:00Z");
    expect(readDate("July 30, 2026 - 12:00 {{Abbr/CEST}}")).toBe("2026-07-30T10:00:00Z");
    expect(readDate("January 10, 2026 - 14:00{{abbr/CST}}")).toBe("2026-01-10");
    expect(readDate("")).toBeNull();
  });
});

describe("matches", () => {
  it("counts the games won and names the winner, skipped game ignored", () => {
    const m = readMatch(
      match("EVOS", "RRQ Hoshi", [game(1, ["atlas"], ["claude"]), game(1, ["fanny"], ["claude"]), "{{Map|finished=skip}}"]).slice(2, -2),
    );
    expect(m.teams).toEqual(["EVOS", "RRQ Hoshi"]);
    expect(m.score).toEqual([2, 0]);
    expect(m.winner).toBe(1);
    expect(m.games).toHaveLength(2);
    expect(m.date).toBe("2026-08-14T08:00:00Z");
  });

  it("leaves an unfinished match without a winner, and reads a forfeit", () => {
    const live = readMatch(match("A", "B", [game(2, ["atlas"], ["claude"]), game("", [], [])]).slice(2, -2));
    expect(live.winner).toBeNull();
    expect(live.score).toEqual([0, 1]);
    const forfeit = readMatch("Match|bestof=3|opponent1={{TeamOpponent|A|score=FF}}|opponent2={{TeamOpponent|B|score=W}}");
    expect(forfeit.winner).toBe(2);
    expect(forfeit.score).toBeNull();
  });

  it("maps source labels to keys, abbreviations included", () => {
    expect(sourceLabel("Upper Bracket Semifinals")).toEqual({ kind: "semifinal", side: "upper" });
    expect(sourceLabel("Upper Bracket QFs ()")).toEqual({ kind: "quarterfinal", side: "upper" });
    expect(sourceLabel("Lower Bracket SF")).toEqual({ kind: "semifinal", side: "lower" });
    expect(sourceLabel("Lower Bracket Round 2")).toEqual({ kind: "round", n: 2, side: "lower" });
    expect(sourceLabel("Round 1 Matches ()")).toEqual({ kind: "round", n: 1 });
    expect(sourceLabel("Grand Final")).toEqual({ kind: "grandFinal" });
    expect(sourceLabel("Group B")).toEqual({ kind: "group", letter: "B" });
    expect(sourceLabel("Wildcard Group A")).toEqual({ kind: "group", letter: "A" });
    expect(sourceLabel("Showmatch")).toBeNull();
    expect(stageKey("Regular Season")).toBe("regularSeason");
    expect(stageKey("Statistics")).toBeNull();
  });
});

describe("heroes", () => {
  it("resolves aliases and punctuation, and reports the rest without guessing", () => {
    const { resolve, lookup, unknown } = createHeroResolver(ALIASES, SITE_HEROES);
    expect(resolve("guin")).toBe("guinevere");
    expect(resolve("yss")).toBe("yi-sun-shin");
    expect(resolve("yi sun shin")).toBe("yi-sun-shin");
    expect(resolve("x.borg")).toBe("x-borg");
    expect(resolve("zzz")).toBeNull();
    expect(lookup("zzz")).toBeNull();
    expect([...unknown]).toEqual([["zzz", 1]]);
  });

  it("counts picks, bans, wins and losses over games with a draft", () => {
    const { resolve } = createHeroResolver(ALIASES, SITE_HEROES);
    const m = readMatch(
      match("A", "B", [game(1, ["atlas", "guin"], ["claude"], ["fanny"], ["yss"]), game(2, ["atlas"], ["fanny"], ["claude"])]).slice(2, -2),
    );
    const { games, heroes } = heroCounts([m], resolve);
    expect(games).toBe(2);
    const bySlug = Object.fromEntries(heroes.map((h) => [h.slug, h]));
    expect(bySlug.atlas).toEqual({ slug: "atlas", picks: 2, bans: 0, wins: 1, losses: 1 });
    expect(bySlug.fanny).toEqual({ slug: "fanny", picks: 1, bans: 1, wins: 1, losses: 0 });
    expect(bySlug.claude).toEqual({ slug: "claude", picks: 1, bans: 1, wins: 0, losses: 1 });
    expect(heroes[0].slug).toBe("atlas");
  });
});

describe("standings and tournament", () => {
  const table = {
    kind: "league",
    title: null,
    gameDiff: true,
    zones: ["up", "stayup", "down"],
    teams: [{ name: "a", zone: null }, { name: "B", zone: null }, { name: "C", zone: null }],
  };
  const m = (t1, t2, s1, s2) => ({ teams: [t1, t2], score: [s1, s2], winner: s1 > s2 ? 1 : 2 });
  const upper = (n) => n.toUpperCase();

  it("ranks by series then game differential, zones by position", () => {
    const rows = rankStandings(table, [m("A", "B", 2, 0), m("b", "C", 2, 1), m("C", "A", 2, 1)], upper);
    expect(rows.map((r) => [r.rank, r.team, r.series, r.games, r.zone])).toEqual([
      [1, "A", [1, 1], [3, 2], "up"],
      [2, "C", [1, 1], [3, 3], "stayup"],
      [3, "B", [1, 1], [2, 3], "down"],
    ]);
  });

  it("shares the rank on a full tie, the team's own zone first", () => {
    const noDiff = { ...table, gameDiff: false, teams: [...table.teams.slice(0, 2), { name: "C", zone: "up" }] };
    const rows = rankStandings(noDiff, [m("A", "B", 1, 0), m("B", "C", 1, 0), m("C", "A", 1, 0)], upper);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
    expect(rows.find((r) => r.team === "C").zone).toBe("up");
  });

  it("names bracket rounds per match: an explicit header opens the lower bracket inside a round", () => {
    const page = `{{Bracket|Bracket/X|id=K
|R1M1header=Upper Bracket QFs ({{Abbr/Bo3}})
|R1M5header=Lower Bracket Round 1
|R2M1header=Upper Bracket SFs
|R1M1=${match("A", "B", [game(1, ["atlas"], ["claude"])], undefined, 1)}
|R1M2=${match("C", "D", [game(2, ["atlas"], ["claude"])], undefined, 1)}
|R2M1=${match("A", "D", [game(1, ["atlas"], ["claude"])], undefined, 1)}
|R1M5=${match("B", "C", [game(1, ["atlas"], ["claude"])], undefined, 1)}
}}`;
    const t = buildTournament([{ title: "Knockout Stage", key: "knockoutStage", page: "P", analysis: analyzePage(page) }], {
      resolve: () => "atlas",
      teamName: (n) => n,
    });
    expect(t.stages[0].brackets[0].rounds.map((r) => [r.title, r.label, r.matches.length])).toEqual([
      ["Upper Bracket QFs", { kind: "quarterfinal", side: "upper" }, 2],
      ["Upper Bracket SFs", { kind: "semifinal", side: "upper" }, 1],
      ["Lower Bracket Round 1", { kind: "round", n: 1, side: "lower" }, 1],
    ]);
    expect(t.champion).toBeNull();
  });

  it("builds a page: standings, named rounds, champion and drafts", () => {
    const page = `
{{GroupTableLeague|title={{Flag|id}} Regular Season|pbg1=up|pbg2=down|team1=Alpha|team2=Beta}}
{{Matchlist|id=X|title=Week 1
|M1=${match("Alpha", "Beta", [game(1, ["guin"], ["atlas"]), game(1, ["guin"], ["claude"])])}
}}
{{Bracket|Bracket/2|id=Y
<!-- Grand Final -->
|R1M1=${match("Beta", "Alpha", [game(1, ["atlas"], ["zzz"])], "October 18, 2026 - 20:00 {{abbr/ICT}}", 1)}
}}`;
    const { resolve, lookup } = createHeroResolver(ALIASES, SITE_HEROES);
    const t = buildTournament([{ title: "Regular Season", key: "regularSeason", page: "P", analysis: analyzePage(page) }], {
      resolve,
      lookup,
      teamName: (n) => n,
      drafts: 5,
    });
    const [stage] = t.stages;
    expect(stage.standings[0].title).toBe("Regular Season");
    // The final bracket match does not count in the season standings.
    expect(stage.standings[0].rows.map((r) => [r.team, r.series])).toEqual([
      ["Alpha", [1, 0]],
      ["Beta", [0, 1]],
    ]);
    // The list summed up by the standings is not shown again; the bracket is.
    expect(stage.brackets).toHaveLength(1);
    expect(stage.brackets[0].rounds[0]).toMatchObject({ title: "Grand Final", label: { kind: "grandFinal" } });
    expect(t.champion).toBe("Beta");
    expect(t.matches).toBe(2);
    expect(t.games).toBe(3);
    expect(t.heroes.find((h) => h.slug === "guinevere")).toMatchObject({ picks: 2, wins: 2 });
    expect(t.drafts[0].teams).toEqual(["Beta", "Alpha"]);
    // Unknown hero: keeps its source name in the draft.
    expect(t.drafts[0].games[0].picks[1]).toEqual(["zzz"]);
  });
});
