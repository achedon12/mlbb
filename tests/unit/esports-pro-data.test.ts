import { describe, expect, it } from "vitest";
import { tournamentBySlug } from "@/lib/esports";
import {
  gameLineups,
  playedSlugs,
  playerBySlug,
  playerLines,
  playerProfile,
  proMatches,
  proPlayers,
  proTeams,
  teamBySlug,
  teamProfile,
  tournamentPlayers,
  type ProMatch,
} from "@/lib/esports-players";

const ROLES = new Set(["exp", "jungle", "mid", "gold", "roam", "flex", null]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("esports-players.json: shape", () => {
  it("names players and teams with unique slugs", () => {
    for (const list of [proPlayers, proTeams]) {
      expect(new Set(list.map((x) => x.slug)).size).toBe(list.length);
      for (const x of list) expect(x.slug).toMatch(SLUG);
    }
  });

  it("refers only to known tournaments, teams and players", () => {
    for (const p of proPlayers) {
      for (const t of p.tournaments) {
        expect(tournamentBySlug.has(t.tournament)).toBe(true);
        expect(teamBySlug.has(t.team)).toBe(true);
        expect(ROLES.has(t.role)).toBe(true);
      }
    }
    for (const team of proTeams) for (const t of team.tournaments) for (const p of t.players) expect(playerBySlug.has(p)).toBe(true);
    for (const m of proMatches) {
      expect(tournamentBySlug.has(m.tournament)).toBe(true);
      for (const t of m.teams) expect(teamBySlug.has(t)).toBe(true);
      if (m.mvp) expect(playerBySlug.has(m.mvp)).toBe(true);
    }
  });

  it("gives every played game a winner, at most five picks a side and five players per lineup", () => {
    expect(proMatches.length).toBeGreaterThan(0);
    for (const m of proMatches) {
      expect([1, 2]).toContain(m.winner);
      // Only a forfeit has no game, and no score.
      if (m.games.length === 0) expect(m.score).toBeNull();
      for (const g of m.games) {
        expect([1, 2]).toContain(g.winner);
        for (const side of [0, 1] as const) {
          expect(g.picks[side].length).toBeLessThanOrEqual(5);
          const line = gameLineups(m, g)[side];
          if (line) {
            expect(line).toHaveLength(5);
            for (const p of line) expect(playerBySlug.has(p)).toBe(true);
          }
        }
      }
    }
  });

  it("stays a reasonable size: one line per match, no unused field", () => {
    const size = JSON.stringify({ proPlayers, proTeams, proMatches }).length;
    expect(size).toBeLessThan(1_500_000);
  });
});

describe("player statistics", () => {
  const m = (over: Partial<ProMatch>): ProMatch => ({
    tournament: "t",
    stage: null,
    date: "2026-09-20",
    teams: ["alpha", "beta"],
    score: [2, 1],
    winner: 1,
    mvp: null,
    lineups: [
      ["a1", "a2", "a3", "a4", "a5"],
      ["b1", "b2", "b3", "b4", "b5"],
    ],
    games: [],
    ...over,
  });
  const g = (winner: 1 | 2, picks: [string[], string[]] = [["h1", "h2", "h3", "h4", "h5"], ["k1", "k2", "k3", "k4", "k5"]]) => ({
    winner,
    duration: null,
    team1Side: null,
    picks,
    bans: [[], []] as [string[], string[]],
  });

  it("credits each hero to the player of its slot, and counts games, wins and MVPs", () => {
    const lines = playerLines([
      m({ mvp: "a3", games: [g(1), g(2), { ...g(1), lineups: [["a1", "a2", "a6", "a4", "a5"], ["b1", "b2", "b3", "b4", "b5"]] }] }),
    ]);
    const of = (p: string) => lines.find((l) => l.player === p)!;
    expect(of("a3")).toMatchObject({ team: "alpha", games: 2, wins: 1, mvps: 1, heroes: [{ slug: "h3", games: 2, wins: 1 }] });
    expect(of("a6")).toMatchObject({ games: 1, wins: 1, heroes: [{ slug: "h3", games: 1, wins: 1 }] });
    expect(of("b2")).toMatchObject({ team: "beta", games: 3, wins: 1, heroes: [{ slug: "k2", games: 3, wins: 1 }] });
  });

  it("counts a game without a full draft, but credits no hero from it", () => {
    const [line] = playerLines([m({ games: [g(1, [["h1"], []])] })]).filter((l) => l.player === "a1");
    expect(line).toMatchObject({ games: 1, wins: 1, heroes: [] });
  });
});

describe("profiles from the synced data", () => {
  it("adds up a player's tournaments and lists their matches", () => {
    const slug = [...playedSlugs][0]!;
    const p = playerProfile(slug)!;
    expect(p.games).toBe(p.tournaments.reduce((n, l) => n + l.games, 0));
    expect(p.heroes.reduce((n, h) => n + h.games, 0)).toBeLessThanOrEqual(p.games);
    expect(p.matches.length).toBeGreaterThan(0);
    expect(playerProfile("nobody-at-all")).toBeNull();
  });

  it("gives a team the record of its matches and a roster per tournament", () => {
    const slug = proMatches[0]!.teams[0];
    const p = teamProfile(slug)!;
    expect(p.series[0] + p.series[1]).toBe(p.matches.length);
    expect(p.games[0] + p.games[1]).toBe(p.matches.reduce((n, x) => n + x.games.length, 0));
    expect(teamProfile("nobody-at-all")).toBeNull();
  });

  it("lists in a tournament only players who played", () => {
    for (const l of tournamentPlayers(proMatches[0]!.tournament)) expect(l.games).toBeGreaterThan(0);
  });
});
