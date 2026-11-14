import { describe, expect, it } from "vitest";
import {
  analyzePage,
  assembleProData,
  buildLineups,
  pageTitle,
  playerPage,
  readMatch,
  readParticipants,
  readRole,
  slugify,
} from "../../scripts/esports-analysis.mjs";

/** Excerpts modeled on Liquipedia's wikitext: rosters, substitutions, drafts. */
const roster = (team, players) => `|{{Opponent|${team}
  |players={{Persons
${players.map((p) => `    |{{Person|${p}}}`).join("\n")}
    |{{Person|Coach A|role=head coach|type=staff}}
    |{{Person|Analyst B|role=Analyst}}
  }}
}}`;

const PARTICIPANTS = `{{TeamParticipants|showplayerinfo=true
${roster("Alpha", ["A1|role=exp, captain", "A2|link=Atwo|role=jgl", "A3|role=mid", "A4|role=gold", "A5|role=roam", "A6|role=mid|status=sub|played=false"])}
${roster("Beta", ["B1|role=exp", "B2|role=jgl", "B3|role=mid", "B4|role=gold", "B5|role=roam", "B0|role=gold|status=former"])}
}}`;

const map = (winner, p1, p2) =>
  `{{Map|team1side=blue|team2side=red|length=15:00|winner=${winner}
    ${p1.map((h, i) => `|t1h${i + 1}=${h}`).join(" ")}
    ${p2.map((h, i) => `|t2h${i + 1}=${h}`).join(" ")}
    |t1b1=fanny|t2b1=lancelot
  }}`;

const H1 = ["yu zhong", "fredrinn", "pharsa", "brody", "kalea"];
const H2 = ["cici", "joy", "yve", "harith", "atlas"];

const opponent = (team, subs = "") =>
  subs ? `{{TeamOpponent|${team}\n |substitutes={{PlayerSubstitutions\n ${subs}\n }}}}` : `{{TeamOpponent|${team}}}`;

const match = (o1, o2, games, extra = "") => `{{Match|bestof=3${extra}
    |opponent1=${o1}
    |opponent2=${o2}
    |date=September 20, 2026 - 17:00 {{abbr/ICT}}
    ${games.map((g, i) => `|map${i + 1}=${g}`).join("\n")}
    |map${games.length + 1}={{Map|finished=skip}}
  }}`;

const page = (matches) => `${PARTICIPANTS}
{{Matchlist|id=X|title=Week 1
${matches.map((m, i) => `|M${i + 1}=${m}`).join("\n")}
}}`;

const ids = (ref) => pageTitle(ref.link ?? ref.name);
const lookup = (h) => h.replace(/ /g, "-");

function lineupsOf(text) {
  const analysis = analyzePage(text);
  return buildLineups([{ title: "Regular Season", analysis }], analysis.participants, { teamName: (n) => n, lookup, playerId: ids });
}

describe("rosters", () => {
  it("reads every player in page order and leaves the staff out", () => {
    const [alpha, beta] = readParticipants(PARTICIPANTS);
    expect(alpha.team).toBe("Alpha");
    expect(alpha.players.map((p) => [p.name, p.link, p.role, p.status])).toEqual([
      ["A1", null, "exp", null],
      ["A2", "Atwo", "jungle", null],
      ["A3", null, "mid", null],
      ["A4", null, "gold", null],
      ["A5", null, "roam", null],
      ["A6", null, "mid", "sub"],
    ]);
    expect(beta.players.at(-1)).toMatchObject({ name: "B0", status: "former" });
  });

  it("skips the empty slots of a roster not announced yet", () => {
    expect(readParticipants(`{{TeamParticipants\n${roster("Gamma", ["|role=exp", "|role=jgl"])}\n}}`)).toEqual([]);
  });

  it("maps lane names and leaves anything else out", () => {
    expect(readRole("exp, Vice Captain")).toBe("exp");
    expect(readRole("Jungler")).toBe("jungle");
    expect(readRole("head coach")).toBeNull();
  });
});

describe("matches", () => {
  it("keeps map numbers, substitutions and the MVP", () => {
    const m = readMatch(
      match(
        opponent("Alpha", "|{{Substitution|in={{Opponent|A6|flag=id}}|out=A3|games=2}}"),
        opponent("Beta"),
        [map(1, H1, H2), map(2, H1, H2), map(1, H1, H2)],
        "|mvp=A1",
      ).slice(2, -2),
    );
    expect(m.games.map((g) => g.number)).toEqual([1, 2, 3]);
    expect(m.substitutions[0]).toEqual([{ in: { name: "A6", link: null }, out: { name: "A3", link: null }, games: [2] }]);
    expect(m.substitutions[1]).toEqual([]);
    expect(m.mvp).toBe("A1");
  });
});

describe("lineups", () => {
  it("credits the five starters in lane order, the link naming the player", () => {
    const { matches } = lineupsOf(page([match(opponent("Alpha"), opponent("Beta"), [map(1, H1, H2), map(1, H1, H2)], "|mvp=a2")]));
    expect(matches).toHaveLength(1);
    const [m] = matches;
    expect(m.lineups).toEqual([
      ["A1", "Atwo", "A3", "A4", "A5"],
      ["B1", "B2", "B3", "B4", "B5"],
    ]);
    expect(m.games[0].picks[0]).toEqual(["yu-zhong", "fredrinn", "pharsa", "brody", "kalea"]);
    expect(m.games[0]).not.toHaveProperty("lineups");
    // The MVP is matched on the shown name, whatever its case.
    expect(m.mvp).toBe("Atwo");
  });

  it("applies a substitution to every game, or only to the games it names", () => {
    const all = lineupsOf(
      page([match(opponent("Alpha", "|{{Substitution|in=A6|out=A3}}"), opponent("Beta"), [map(1, H1, H2), map(1, H1, H2)])]),
    ).matches[0];
    expect(all.lineups[0]).toEqual(["A1", "Atwo", "A6", "A4", "A5"]);

    const one = lineupsOf(
      page([
        match(opponent("Alpha", "|{{Substitution|in=A6|out=A3|games=2}}"), opponent("Beta"), [map(1, H1, H2), map(2, H1, H2), map(1, H1, H2)]),
      ]),
    ).matches[0];
    expect(one.lineups[0]).toEqual(["A1", "Atwo", "A3", "A4", "A5"]);
    expect(one.games[0]).not.toHaveProperty("lineups");
    expect(one.games[1].lineups[0]).toEqual(["A1", "Atwo", "A6", "A4", "A5"]);
    expect(one.games[2]).not.toHaveProperty("lineups");
  });

  it("puts a player who is not a starter in the slot of their lane, and adds an unknown one to the roster", () => {
    const text = page([
      match(
        opponent("Alpha", "|{{Substitution|in=A6|out=Somebody}}"),
        opponent("Beta", "|{{Substitution|in={{OpponentPlayer|New Guy|link=NG}}|out=B2}}"),
        [map(1, H1, H2), map(1, H1, H2)],
      ),
    ]);
    const { matches, rosters } = lineupsOf(text);
    expect(matches[0].lineups[0]).toEqual(["A1", "Atwo", "A6", "A4", "A5"]);
    expect(matches[0].lineups[1]).toEqual(["B1", "NG", "B3", "B4", "B5"]);
    expect(rosters.find((r) => r.team === "Beta").players.at(-1)).toEqual({ id: "NG", name: "New Guy", role: "jungle", status: "sub" });
  });

  it("leaves a team without a full roster without lineup, and skips unplayed matches", () => {
    const text = `{{Matchlist|id=X
|M1=${match(opponent("Alpha"), opponent("Gamma"), [map(2, H1, H2), map(2, H1, H2)])}
|M2={{Match|bestof=3|opponent1={{TeamOpponent|Alpha}}|opponent2={{TeamOpponent|Beta}}}}
}}${PARTICIPANTS}`;
    const { matches } = lineupsOf(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].lineups[1]).toBeNull();
    expect(matches[0].winner).toBe(2);
  });
});

describe("assembly", () => {
  it("turns ids into unique slugs and keeps a player's latest name and team", () => {
    const first = {
      tournament: "t1",
      rosters: [{ team: "Alpha", players: [{ id: "Sanz", name: "S A N Z", role: "mid", status: null }] }],
      matches: [],
    };
    const second = {
      tournament: "t2",
      rosters: [
        { team: "Beta", players: [{ id: "Sanz", name: "Sanz", role: "mid", status: null }] },
        { team: "Gamma", players: [{ id: "SANZ (Filipino player)", name: "Sanz", role: "roam", status: null }] },
      ],
      matches: [
        {
          stage: null,
          date: "2026-09-20T10:00:00Z",
          teams: ["Beta", "Gamma"],
          score: [1, 0],
          winner: 1,
          mvp: "Sanz",
          lineups: [["Sanz"], null],
          games: [{ winner: 1, duration: null, team1Side: null, picks: [[], []], bans: [[], []], lineups: [["Sanz"], ["SANZ (Filipino player)"]] }],
        },
      ],
    };
    const out = assembleProData([first, second], new Set(["Sanz"]));
    expect(out.players.map((p) => [p.slug, p.name, p.page])).toEqual([
      ["sanz", "Sanz", "Sanz"],
      ["sanz-filipino-player", "Sanz", null],
    ]);
    expect(out.players[0].tournaments).toEqual([
      { tournament: "t1", team: "alpha", role: "mid", status: null },
      { tournament: "t2", team: "beta", role: "mid", status: null },
    ]);
    expect(out.teams.map((t) => t.slug)).toEqual(["alpha", "beta", "gamma"]);
    expect(out.matches[0]).toMatchObject({ tournament: "t2", teams: ["beta", "gamma"], mvp: "sanz" });
    expect(out.matches[0].games[0].lineups).toEqual([["sanz"], ["sanz-filipino-player"]]);
  });

  it("builds addresses and titles the way the wiki writes them", () => {
    expect(slugify("A B O Y")).toBe("a-b-o-y");
    expect(slugify("Kélra")).toBe("kelra");
    expect(slugify("Deku (Malaysian player)")).toBe("deku-malaysian-player");
    expect(pageTitle("alekk")).toBe("Alekk");
    expect(playerPage({ name: "Affan", link: "Yazukee" })).toBe("Yazukee");
  });
});
