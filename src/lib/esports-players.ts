import rawData from "@/data/game/esports-players.json";
import { tournamentBySlug, type Tournament } from "@/lib/esports";

/**
 * Pro players and teams: rosters, lineups and drafts of every played match of
 * the covered tournaments (`node scripts/esports.mjs`, from Liquipedia, under
 * CC BY-SA 3.0).
 *
 * The source enters a draft as five heroes per team, in the lane order of the
 * team's roster; the sync gives each game the five players who played it
 * (starters, adjusted by the substitutions the match lists). A hero is thus
 * credited to the player of its slot. Liquipedia records no kills, deaths or
 * assists for Mobile Legends: there is no KDA here, only games, wins, MVP
 * awards and heroes.
 */

export type ProRole = "exp" | "jungle" | "mid" | "gold" | "roam" | "flex";
export const ROLE_ORDER: ProRole[] = ["exp", "jungle", "mid", "gold", "roam", "flex"];

export interface ProPlayer {
  slug: string;
  /** Name shown in the latest covered tournament. */
  name: string;
  /** Liquipedia page title, when the page exists. */
  page: string | null;
  tournaments: { tournament: string; team: string; role: ProRole | null; status: "sub" | "former" | null }[];
}

export interface ProTeam {
  slug: string;
  name: string;
  /** Roster per tournament, player slugs in the source's order (starters first). */
  tournaments: { tournament: string; players: string[] }[];
}

type Lineups = [string[] | null, string[] | null];

export interface ProGame {
  winner: 1 | 2;
  duration: string | null;
  team1Side: "blue" | "red" | null;
  /** In lane order; site slugs, or the source name when the hero is not recognized. */
  picks: [string[], string[]];
  bans: [string[], string[]];
  /** Only when a substitution makes them differ from the match's. */
  lineups?: Lineups;
}

export interface ProMatch {
  tournament: string;
  stage: string | null;
  date: string | null;
  /** Team slugs. */
  teams: [string, string];
  score: [number, number] | null;
  winner: 1 | 2;
  mvp: string | null;
  lineups: Lineups;
  games: ProGame[];
}

interface ProData {
  updatedAt: string | null;
  players: ProPlayer[];
  teams: ProTeam[];
  matches: ProMatch[];
}

const data = rawData as unknown as ProData;

export const proPlayers = data.players;
export const proTeams = data.teams;
export const proMatches = data.matches;
export const proUpdatedAt = data.updatedAt;
export const playerBySlug = new Map(proPlayers.map((p) => [p.slug, p]));
export const teamBySlug = new Map(proTeams.map((t) => [t.slug, t]));
/** Team names as the tournament pages show them → team page. */
export const teamSlugByName = new Map(proTeams.map((t) => [t.name, t.slug]));

/** Players of a game: the game's own lineups, or else the match's. */
export const gameLineups = (m: ProMatch, g: ProGame): Lineups => g.lineups ?? m.lineups;

/** A draft credits heroes to players only when its five picks are entered. */
const fullDraft = (picks: string[]) => picks.length === 5;

export interface HeroLine {
  slug: string;
  games: number;
  wins: number;
}

export interface PlayerLine {
  player: string;
  tournament: string;
  /** Team the player last played for in this tournament. */
  team: string;
  games: number;
  wins: number;
  /** Matches where the source names the player MVP. */
  mvps: number;
  /** Most played first. */
  heroes: HeroLine[];
}

function sortHeroes(heroes: Map<string, HeroLine>): HeroLine[] {
  return [...heroes.values()].sort((a, b) => b.games - a.games || b.wins - a.wins || a.slug.localeCompare(b.slug));
}

/**
 * Games, wins, MVPs and heroes of each player, per tournament. Pure: the
 * pages call it over the whole file once, the tests over a few matches.
 */
export function playerLines(matches: ProMatch[]): PlayerLine[] {
  const lines = new Map<string, Omit<PlayerLine, "heroes"> & { heroes: Map<string, HeroLine> }>();
  const lineOf = (player: string, tournament: string, team: string) => {
    const key = `${player}|${tournament}`;
    let line = lines.get(key);
    if (!line) {
      line = { player, tournament, team, games: 0, wins: 0, mvps: 0, heroes: new Map() };
      lines.set(key, line);
    }
    line.team = team;
    return line;
  };
  for (const m of matches) {
    for (const g of m.games) {
      const lineups = gameLineups(m, g);
      for (const side of [0, 1] as const) {
        const won = g.winner === side + 1;
        const picks = g.picks[side];
        lineups[side]?.forEach((player, slot) => {
          const line = lineOf(player, m.tournament, m.teams[side]);
          line.games += 1;
          if (won) line.wins += 1;
          if (!fullDraft(picks)) return;
          const hero = picks[slot]!;
          const h = line.heroes.get(hero) ?? { slug: hero, games: 0, wins: 0 };
          h.games += 1;
          if (won) h.wins += 1;
          line.heroes.set(hero, h);
        });
      }
    }
    if (m.mvp) {
      const side = m.lineups.findIndex((l) => l?.includes(m.mvp!));
      const team = m.teams[side === -1 ? m.winner - 1 : side];
      lineOf(m.mvp, m.tournament, team).mvps += 1;
    }
  }
  return [...lines.values()].map((l) => ({ ...l, heroes: sortHeroes(l.heroes) }));
}

const allLines = playerLines(proMatches);

/** A player gets a page once they have played a covered game. */
export const playedSlugs = new Set(allLines.filter((l) => l.games > 0).map((l) => l.player));
export const hasPlayerPage = (slug: string) => playedSlugs.has(slug);

/** A team gets a page once it has played a covered match. */
const teamsPlayed = new Set(proMatches.flatMap((m) => m.teams));
export const hasTeamPage = (slug: string) => teamsPlayed.has(slug);

export const rate = (wins: number, games: number) => (games ? (wins / games) * 100 : null);

/** Role of a player in a tournament, as the roster gives it. */
export function roleIn(player: ProPlayer, tournament: string): ProRole | null {
  return player.tournaments.findLast((t) => t.tournament === tournament)?.role ?? null;
}

// ─────────────────────────────────────────────────────────────
// Tournament
// ─────────────────────────────────────────────────────────────

/** Players of a tournament with at least one game. */
export function tournamentPlayers(tournament: string): PlayerLine[] {
  return allLines.filter((l) => l.tournament === tournament && l.games > 0);
}

/** Whether the tournament has player statistics to show. */
export const hasPlayerStats = (tournament: string) => allLines.some((l) => l.tournament === tournament && l.games > 0);

// ─────────────────────────────────────────────────────────────
// Player
// ─────────────────────────────────────────────────────────────

export interface PlayerProfile {
  player: ProPlayer;
  /** Latest team and role. */
  team: ProTeam | null;
  role: ProRole | null;
  games: number;
  wins: number;
  mvps: number;
  heroes: HeroLine[];
  /** Latest tournament first. */
  tournaments: (PlayerLine & { turn: Tournament; role: ProRole | null })[];
  /** Latest first, with the heroes the player played. */
  matches: { match: ProMatch; side: 0 | 1; heroes: { hero: string | null; won: boolean }[] }[];
}

const byDateDesc = (a: ProMatch, b: ProMatch) => (b.date ?? "").localeCompare(a.date ?? "");

export function playerProfile(slug: string): PlayerProfile | null {
  const player = playerBySlug.get(slug);
  if (!player || !hasPlayerPage(slug)) return null;
  const lines = allLines
    .filter((l) => l.player === slug && l.games > 0)
    .flatMap((l) => {
      const turn = tournamentBySlug.get(l.tournament);
      return turn ? [{ ...l, turn, role: roleIn(player, l.tournament) }] : [];
    })
    .sort((a, b) => (b.turn.startDate ?? "").localeCompare(a.turn.startDate ?? ""));
  const heroes = new Map<string, HeroLine>();
  for (const l of lines) {
    for (const h of l.heroes) {
      const sum = heroes.get(h.slug) ?? { slug: h.slug, games: 0, wins: 0 };
      sum.games += h.games;
      sum.wins += h.wins;
      heroes.set(h.slug, sum);
    }
  }
  const matches = proMatches
    .flatMap((m) => {
      const side = ([0, 1] as const).find((s) => m.games.some((g) => gameLineups(m, g)[s]?.includes(slug)));
      if (side === undefined) return [];
      const played = m.games.map((g) => {
        const slot = gameLineups(m, g)[side]?.indexOf(slug) ?? -1;
        return slot < 0 ? null : { hero: fullDraft(g.picks[side]) ? g.picks[side][slot]! : null, won: g.winner === side + 1 };
      });
      return [{ match: m, side, heroes: played.filter((x) => x !== null) }];
    })
    .sort((a, b) => byDateDesc(a.match, b.match));
  const latest = lines[0];
  return {
    player,
    team: latest ? (teamBySlug.get(latest.team) ?? null) : null,
    role: latest?.role ?? null,
    games: lines.reduce((n, l) => n + l.games, 0),
    wins: lines.reduce((n, l) => n + l.wins, 0),
    mvps: lines.reduce((n, l) => n + l.mvps, 0),
    heroes: sortHeroes(heroes),
    tournaments: lines,
    matches,
  };
}

// ─────────────────────────────────────────────────────────────
// Team
// ─────────────────────────────────────────────────────────────

export interface TeamRecord {
  turn: Tournament;
  /** Series won, lost; games won, lost. */
  series: [number, number];
  games: [number, number];
  /** Players listed for this tournament, starters first, with their games. */
  roster: { player: ProPlayer; role: ProRole | null; status: "sub" | "former" | null; games: number }[];
  champion: boolean;
}

export interface TeamProfile {
  team: ProTeam;
  /** Latest tournament first. */
  records: TeamRecord[];
  series: [number, number];
  games: [number, number];
  /** Latest first. */
  matches: ProMatch[];
}

export function teamProfile(slug: string): TeamProfile | null {
  const team = teamBySlug.get(slug);
  if (!team || !hasTeamPage(slug)) return null;
  const matches = proMatches.filter((m) => m.teams.includes(slug)).sort(byDateDesc);
  const records = team.tournaments
    .flatMap((entry) => {
      const turn = tournamentBySlug.get(entry.tournament);
      if (!turn) return [];
      const series: [number, number] = [0, 0];
      const games: [number, number] = [0, 0];
      for (const m of matches.filter((x) => x.tournament === entry.tournament)) {
        const side = m.teams.indexOf(slug);
        series[m.winner === side + 1 ? 0 : 1] += 1;
        for (const g of m.games) games[g.winner === side + 1 ? 0 : 1] += 1;
      }
      const roster = entry.players.flatMap((p) => {
        const player = playerBySlug.get(p);
        if (!player) return [];
        const status = player.tournaments.findLast((t) => t.tournament === entry.tournament && t.team === slug)?.status ?? null;
        const line = allLines.find((l) => l.player === p && l.tournament === entry.tournament);
        return [{ player, role: roleIn(player, entry.tournament), status, games: line?.games ?? 0 }];
      });
      return [{ turn, series, games, roster, champion: turn.champion === team.name }];
    })
    .filter((r) => r.series[0] + r.series[1] > 0 || r.roster.length > 0)
    .sort((a, b) => (b.turn.startDate ?? "").localeCompare(a.turn.startDate ?? ""));
  const sum = (pick: (r: TeamRecord) => [number, number]): [number, number] => [
    records.reduce((n, r) => n + pick(r)[0], 0),
    records.reduce((n, r) => n + pick(r)[1], 0),
  ];
  return { team, records, series: sum((r) => r.series), games: sum((r) => r.games), matches };
}
