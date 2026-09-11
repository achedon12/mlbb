import { affecterLanes, synergiesInternes, type Ecart, type MesuresRang, type TypeDegats } from "./composition";
import { LANES, type HerosDraft } from "./draft";
import type { RangMesure } from "./rangs-mesure";
import type { Lane, NotesHeros, Palier } from "./types";

/**
 * Draft simulation: bans then picks, in the ranked format or the tournament
 * one.
 *
 * Everything starts from a table of steps (side, ban or pick, count) taken
 * from the sources cited below. The table unfolds into turns of one hero
 * each, and the draft state is nothing but the list of choices made, turn
 * after turn. Nothing else is stored: undo drops choices, sharing writes the
 * list into the address, and the state is recomputed. Pure module, no data
 * import: it runs in the browser and is tested without the game catalog.
 */

// -- Sources ------------------------------------------------------------

export interface RuleSource {
  site: "Fandom" | "Liquipedia";
  /** Page title, as the wiki writes it. */
  page: string;
  url: string;
}

/**
 * Pages behind each rule of the simulator. The rules section cites every one
 * of them; a rule without a source does not enter the table.
 */
export const SOURCES = {
  /** Draft from Epic; 3, 4 or 5 bans per team in Epic, Legend, Mythic. */
  ranked: { site: "Fandom", page: "Ranked", url: "https://mobilelegends.fandom.com/wiki/Ranked" },
  /** 6, 8, 10 bans by highest rank; two rounds of simultaneous bans, duplicates allowed. */
  patch1866: { site: "Liquipedia", page: "Patch 1.8.66", url: "https://liquipedia.net/mobilelegends/Patch_1.8.66" },
  /** Pick order 1-2-2-2-2-1, empty ban or random pick on timeout, 10 bans in MPL. */
  draftPick: { site: "Fandom", page: "Draft Pick", url: "https://mobilelegends.fandom.com/wiki/Draft_Pick" },
  /** 25 s to ban, 30 s to pick, per player. */
  timers: { site: "Fandom", page: "Patch Notes 1.5.52", url: "https://mobilelegends.fandom.com/wiki/Patch_Notes_1.5.52" },
  /** Custom draft: the left team bans first. */
  firstBan: { site: "Fandom", page: "Patch Notes 1.2.02", url: "https://mobilelegends.fandom.com/wiki/Patch_Notes_1.2.02" },
  /** Custom draft: bans are taken in turns. */
  alternatingBans: {
    site: "Fandom",
    page: "Patch Notes 1.2.26",
    url: "https://mobilelegends.fandom.com/wiki/Patch_Notes_1.2.26",
  },
  /** Tournament draft input form: 5 bans per team by default. */
  draftGenerator: {
    site: "Liquipedia",
    page: "Form:Draft Generator",
    url: "https://liquipedia.net/mobilelegends/Form:Draft_Generator",
  },
} as const satisfies Record<string, RuleSource>;

export type SourceKey = keyof typeof SOURCES;

// -- Formats ------------------------------------------------------------

export type Side = "blue" | "red";
export const SIDES: readonly Side[] = ["blue", "red"];
export const opponentOf = (side: Side): Side => (side === "blue" ? "red" : "blue");

export type DraftAction = "ban" | "pick";
export type DraftFormat = "ranked" | "tournament";
export const DRAFT_FORMATS: readonly DraftFormat[] = ["ranked", "tournament"];

/** Side held by the player; "both": the player runs the whole draft. */
export type Control = Side | "both";
export const CONTROLS: readonly Control[] = ["blue", "red", "both"];

export type TimerSetting = "off" | "30" | "game";
export const TIMER_SETTINGS: readonly TimerSetting[] = ["off", "30", "game"];

/** Ranks where Draft Pick exists: it opens at Epic. */
export const DRAFT_RANKS = ["epic", "legend", "mythic", "honor", "glory"] as const;
export type DraftRank = (typeof DRAFT_RANKS)[number];
export const isDraftRank = (rank: string): rank is DraftRank => (DRAFT_RANKS as readonly string[]).includes(rank);

/**
 * Bans per team in ranked, set by the highest rank in the match: 3 in Epic,
 * 4 in Legend, 5 in Mythic and above (Ranked; Patch 1.8.66 counts 6, 8 and
 * 10 bans for both teams together). Mythical Honor and Glory are Mythic tiers.
 */
export const RANKED_BANS: Record<DraftRank, number> = { epic: 3, legend: 4, mythic: 5, honor: 5, glory: 5 };

/** Bans per team in tournaments: ten in all (Draft Pick, Form:Draft Generator). */
export const TOURNAMENT_BANS = 5;

/** Time per player, in seconds (Patch Notes 1.5.52). */
export const GAME_TIMERS: Record<DraftAction, number> = { ban: 25, pick: 30 };
export const FIXED_TIMER = 30;

export function turnTimer(setting: TimerSetting, action: DraftAction): number | null {
  if (setting === "off") return null;
  return setting === "30" ? FIXED_TIMER : GAME_TIMERS[action];
}

/** One row of the table: a side (or both at once) bans or picks that many heroes. */
export interface Step {
  side: Side | "both";
  action: DraftAction;
  count: number;
}

/** Pick order, the same in both formats (Draft Pick): blue 1, red 2, blue 2, red 2, blue 2, red 1. */
const PICK_ORDER: Step[] = [
  { side: "blue", action: "pick", count: 1 },
  { side: "red", action: "pick", count: 2 },
  { side: "blue", action: "pick", count: 2 },
  { side: "red", action: "pick", count: 2 },
  { side: "blue", action: "pick", count: 2 },
  { side: "red", action: "pick", count: 1 },
];

/** Rank kept for a format: ranked only has a draft from Epic up. */
export function rankForFormat(format: DraftFormat, rank: RangMesure): RangMesure {
  return format === "ranked" && !isDraftRank(rank) ? "mythic" : rank;
}

export function bansPerSide(format: DraftFormat, rank: RangMesure): number {
  if (format === "tournament") return TOURNAMENT_BANS;
  return RANKED_BANS[isDraftRank(rank) ? rank : "mythic"];
}

/**
 * Table of a format.
 *
 * Ranked: both teams ban at the same time (Patch 1.8.66). The game runs this
 * phase in two rounds, but the sources do not say how many bans fall in each:
 * the table groups them into one simultaneous step rather than invent a split.
 *
 * Tournament: ten bans taken in turns, blue (left) first, as the notes on the
 * custom draft, the mode tournaments are played in, describe.
 */
export function sequence(format: DraftFormat, rank: RangMesure): Step[] {
  const n = bansPerSide(format, rank);
  const bans: Step[] =
    format === "ranked"
      ? [{ side: "both", action: "ban", count: n }]
      : Array.from({ length: 2 * n }, (_, i) => ({ side: i % 2 === 0 ? "blue" : "red", action: "ban", count: 1 }));
  return [...bans, ...PICK_ORDER];
}

// -- Turns --------------------------------------------------------------

/** One hero to ban or to pick. */
export interface Turn {
  index: number;
  /** Table step the turn comes from. */
  step: number;
  side: Side;
  action: DraftAction;
  /** Ban of a step where both sides ban without seeing each other. */
  simultaneous: boolean;
  /** Position of the turn among its side's bans (or picks), from 1. */
  number: number;
}

/** Unfolds the table. A simultaneous step gives the blue bans then the red ones: each ignores the other. */
export function expandTurns(steps: Step[]): Turn[] {
  const out: Turn[] = [];
  const count: Record<Side, Record<DraftAction, number>> = { blue: { ban: 0, pick: 0 }, red: { ban: 0, pick: 0 } };
  steps.forEach((s, step) => {
    const sides: Side[] = s.side === "both" ? ["blue", "red"] : [s.side];
    for (const side of sides) {
      for (let k = 0; k < s.count; k++) {
        count[side][s.action] += 1;
        out.push({
          index: out.length,
          step,
          side,
          action: s.action,
          simultaneous: s.side === "both",
          number: count[side][s.action],
        });
      }
    }
  });
  return out;
}

/** Hero chosen at a turn; null for a ban left empty when time ran out. */
export type Choice = string | null;

export interface DraftState {
  /** Turn to play; null once the draft is over. */
  current: Turn | null;
  bans: Record<Side, Choice[]>;
  picks: Record<Side, string[]>;
}

export function draftState(turns: Turn[], choices: Choice[]): DraftState {
  const bans: Record<Side, Choice[]> = { blue: [], red: [] };
  const picks: Record<Side, string[]> = { blue: [], red: [] };
  choices.forEach((c, i) => {
    const turn = turns[i];
    if (!turn) return;
    if (turn.action === "ban") bans[turn.side].push(c);
    else if (c) picks[turn.side].push(c);
  });
  return { current: turns[choices.length] ?? null, bans, picks };
}

/**
 * Heroes a turn cannot take: everything already picked or banned. During
 * simultaneous bans a side does not see the other's: it may ban the same hero
 * (Patch 1.8.66).
 */
export function unavailableHeroes(turns: Turn[], choices: Choice[], turn: Turn): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < Math.min(turn.index, choices.length); i++) {
    const c = choices[i];
    const t = turns[i];
    if (!c || !t) continue;
    const blind = t.action === "ban" && turn.simultaneous && t.simultaneous && t.step === turn.step && t.side !== turn.side;
    if (!blind) out.add(c);
  }
  return out;
}

/**
 * Plays the current turn. Null when the move is not allowed: draft over,
 * unknown or unavailable hero, empty pick (only a ban may stay empty).
 */
export function play(turns: Turn[], choices: Choice[], slug: Choice, known: Set<string>): Choice[] | null {
  const turn = turns[choices.length];
  if (!turn) return null;
  if (slug === null) return turn.action === "ban" ? [...choices, null] : null;
  if (!known.has(slug) || unavailableHeroes(turns, choices, turn).has(slug)) return null;
  return [...choices, slug];
}

/** Replays a list read from the address, up to the first illegal move. */
export function replay(turns: Turn[], entries: Choice[], known: Set<string>): Choice[] {
  let choices: Choice[] = [];
  for (const e of entries) {
    const next = play(turns, choices, e, known);
    if (!next) break;
    choices = next;
  }
  return choices;
}

/** Who plays a turn: the player, or the bot when it is on and the side is not the player's. */
export function playedBy(settings: Pick<Settings, "bot" | "control">, turn: Turn): "player" | "bot" {
  if (!settings.bot || settings.control === "both") return "player";
  return turn.side === settings.control ? "player" : "bot";
}

/**
 * Drops the player's last move and the bot moves that followed it: undo goes
 * back to the player's decision, not to the bot's, which would replay at once.
 */
export function undo(turns: Turn[], choices: Choice[], isHuman: (turn: Turn) => boolean): Choice[] {
  for (let i = choices.length - 1; i >= 0; i--) if (isHuman(turns[i])) return choices.slice(0, i);
  return choices;
}

// -- Shareable address --------------------------------------------------

export interface Settings {
  format: DraftFormat;
  /** Rank of the measurements; in ranked it also sets the number of bans. */
  rank: RangMesure;
  control: Control;
  bot: boolean;
  timer: TimerSetting;
  /** Bot seed: same seed, same choices. */
  seed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  format: "ranked",
  rank: "mythic",
  control: "blue",
  bot: true,
  timer: "off",
  seed: 1,
};

/** Value of `?mode=` that opens the simulator; without it the page opens on the draft assistant. */
export const SIMULATOR_MODE = "simulator";

/** Address parameters owned by the simulator. */
export const SIMULATOR_PARAMS = ["mode", "format", "rank", "side", "bot", "timer", "seed", "draft"] as const;

/** Empty ban in `?draft=`; slugs only hold letters, digits and hyphens. */
const EMPTY_BAN = "_";
const MAX_SEED = 2 ** 31;

const oneOf = <T extends string>(values: readonly T[], read: string | null, fallback: T): T =>
  values.find((v) => v === read) ?? fallback;

export function readSimulation(
  search: string,
  known: Set<string>,
  ranks: readonly RangMesure[],
): { settings: Settings; choices: Choice[] } | null {
  const p = new URLSearchParams(search);
  if (p.get("mode") !== SIMULATOR_MODE) return null;
  const format = oneOf(DRAFT_FORMATS, p.get("format"), DEFAULT_SETTINGS.format);
  const rank = rankForFormat(format, oneOf(ranks, p.get("rank"), DEFAULT_SETTINGS.rank));
  const seed = Number(p.get("seed"));
  const settings: Settings = {
    format,
    rank,
    control: oneOf(CONTROLS, p.get("side"), DEFAULT_SETTINGS.control),
    bot: p.get("bot") !== "0",
    timer: oneOf(TIMER_SETTINGS, p.get("timer"), DEFAULT_SETTINGS.timer),
    seed: Number.isInteger(seed) && seed > 0 && seed < MAX_SEED ? seed : DEFAULT_SETTINGS.seed,
  };
  const entries = (p.get("draft") ?? "")
    .split(",")
    .filter(Boolean)
    .map((s) => (s === EMPTY_BAN ? null : s));
  return { settings, choices: replay(expandTurns(sequence(format, rank)), entries, known) };
}

/**
 * Address parameters for a draft, other parameters kept. Defaults are left
 * out; the choice list keeps its commas readable instead of %2C.
 */
export function writeSimulation(search: string, settings: Settings, choices: Choice[]): string {
  const p = new URLSearchParams(search);
  for (const key of SIMULATOR_PARAMS) p.delete(key);
  p.set("mode", SIMULATOR_MODE);
  p.set("format", settings.format);
  p.set("rank", settings.rank);
  p.set("side", settings.control);
  if (!settings.bot) p.set("bot", "0");
  if (settings.timer !== "off") p.set("timer", settings.timer);
  p.set("seed", String(settings.seed));
  const draft = choices.map((c) => (c === null ? EMPTY_BAN : encodeURIComponent(c))).join(",");
  return [p.toString(), draft ? `draft=${draft}` : ""].filter(Boolean).join("&");
}

/** Parameters of the draft assistant: the simulator's removed, the others kept. */
export function writeAssistant(search: string): string {
  const p = new URLSearchParams(search);
  for (const key of SIMULATOR_PARAMS) p.delete(key);
  return p.toString();
}

// -- Reproducible randomness --------------------------------------------

/** Pseudo-random generator (mulberry32): a seed always gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sequence of one turn: replaying the same turn after an undo gives the same choice. */
const turnRandom = (seed: number, index: number) => seededRandom(seed ^ Math.imul(index + 1, 0x9e3779b1));

// -- Bot ----------------------------------------------------------------

/** Simulator hero: the draft record plus what the team analyzer reads. */
export interface SimulationHero extends HerosDraft {
  degats: TypeDegats | null;
  notes: NotesHeros;
}

/** Hero near the top of a rank's tier list: tier, ban rate and win rate (in %). */
export interface MetaEntry {
  slug: string;
  tier: Palier;
  banRate: number;
  winRate: number;
}

export interface BotContext {
  catalog: HerosDraft[];
  /** Measurements of the chosen rank; null while they load. */
  measures: MesuresRang | null;
  /** Tier list of the rank, strongest first. */
  meta: MetaEntry[];
  seed: number;
}

/** Why a hero is chosen; the sentence is built in the page language. */
export type BotReason =
  | { type: "meta"; tier: Palier; banRate: number }
  | { type: "strength"; winRate: number }
  /** Enemy picks the hero troubles; points measured at the rank, null for a wiki relation alone. */
  | { type: "counter"; targets: string[]; points: number | null }
  /** Own picks it wins more with; same conventions. */
  | { type: "duo"; partners: string[]; points: number | null }
  | { type: "lane" }
  | { type: "fallback" }
  /** Ban left empty, or random pick, when time ran out. */
  | { type: "skipped" }
  | { type: "random" };

export interface Candidate {
  slug: string;
  score: number;
  reason: BotReason;
  /** Lane the hero would take in its team; null for a ban. */
  lane: Lane | null;
}

/**
 * Weights of a pick. Counters and duos come in measured win-rate points
 * (often 1 to 4) and count as they are; the hero's win rate at the rank counts
 * for half its gap to 50%: it breaks ties more than it decides. A wiki
 * relation without measurement is worth one point, a known synergy half a
 * point. The noise, capped at 0.3 point, varies drafts without overturning a
 * clear choice.
 */
const BOT_WEIGHTS = { strength: 0.5, relation: 1, synergy: 0.5, noise: 0.3 };

const round1 = (v: number) => Math.round(v * 10) / 10;
const gapFor = (list: Ecart[] | undefined, slug: string) => list?.find(([s]) => s === slug)?.[1] ?? null;

/** Suggested bans: top of the rank's tier list, else the best win rates. */
export function rankBans(turns: Turn[], choices: Choice[], turn: Turn, ctx: BotContext, limit = 3): Candidate[] {
  const excluded = unavailableHeroes(turns, choices, turn);
  const known = new Set(ctx.catalog.map((h) => h.slug));
  const meta = ctx.meta.filter((e) => known.has(e.slug) && !excluded.has(e.slug));
  if (meta.length > 0) {
    return meta
      .slice(0, limit)
      .map((e, i) => ({ slug: e.slug, score: -i, reason: { type: "meta", tier: e.tier, banRate: e.banRate }, lane: null }));
  }
  const rate = (h: HerosDraft) => ctx.measures?.stats[h.slug]?.[0] ?? h.victoire;
  return ctx.catalog
    .filter((h) => !excluded.has(h.slug) && rate(h) !== null)
    .sort((a, b) => rate(b)! - rate(a)!)
    .slice(0, limit)
    .map((h) => ({ slug: h.slug, score: rate(h)!, reason: { type: "strength", winRate: rate(h)! }, lane: null }));
}

/**
 * Suggested picks for a side. Only heroes that add a lane to the team are
 * kept (as long as some do); they are ranked on counters to the enemy picks,
 * duos with the side's own picks and win rate at the rank. The rank's
 * measurements come first; wiki relations fill in where nothing is measured.
 */
export function rankPicks(
  turns: Turn[],
  choices: Choice[],
  turn: Turn,
  ctx: BotContext,
  { limit = 3, noise }: { limit?: number; noise?: () => number } = {},
): Candidate[] {
  const state = draftState(turns, choices);
  const allies = state.picks[turn.side];
  const enemies = state.picks[opponentOf(turn.side)];
  const excluded = unavailableHeroes(turns, choices, turn);
  const bySlug = new Map(ctx.catalog.map((h) => [h.slug, h]));
  const team = allies.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : []));
  const filledBefore = LANES.length - affecterLanes(team).manquantes.length;
  const m = ctx.measures;

  const scored = ctx.catalog
    .filter((h) => !excluded.has(h.slug))
    .map((h) => {
      const assignment = affecterLanes([...team, h]);
      const fillsLane = LANES.length - assignment.manquantes.length > filledBefore;
      const lane = LANES.find((l) => assignment.lanes[l] === h.slug) ?? null;

      let counter = 0;
      let suffered = 0;
      let counterMeasured: number | null = null;
      const targets: string[] = [];
      for (const e of enemies) {
        const enemy = bySlug.get(e);
        // Two readings of one matchup: e loses to h (negative gap of e), h
        // loses to e (negative gap of h). Whatever is measured is averaged.
        const enemyLoses = m ? gapFor(m.faible[e], h.slug) : null;
        const heroLoses = m ? gapFor(m.faible[h.slug], e) : null;
        const reads = [enemyLoses === null ? null : -enemyLoses, heroLoses].filter((v): v is number => v !== null);
        if (reads.length > 0) {
          const v = reads.reduce((a, b) => a + b, 0) / reads.length;
          if (v > 0) {
            counter += v;
            counterMeasured = (counterMeasured ?? 0) + v;
            targets.push(e);
          } else suffered += v;
        } else if (h.fortContre.includes(e) || enemy?.faibleContre.includes(h.slug)) {
          counter += BOT_WEIGHTS.relation;
          targets.push(e);
        } else if (h.faibleContre.includes(e) || enemy?.fortContre.includes(h.slug)) {
          suffered -= BOT_WEIGHTS.relation;
        }
      }

      let duo = 0;
      let duoMeasured: number | null = null;
      const partners: string[] = [];
      for (const a of allies) {
        const gains = [m ? gapFor(m.coequipiers[h.slug], a) : null, m ? gapFor(m.coequipiers[a], h.slug) : null].filter(
          (v): v is number => v !== null && v > 0,
        );
        if (gains.length > 0) {
          duo += Math.max(...gains);
          duoMeasured = (duoMeasured ?? 0) + Math.max(...gains);
          partners.push(a);
        } else if (h.synergies.includes(a) || bySlug.get(a)?.synergies.includes(h.slug)) {
          duo += BOT_WEIGHTS.synergy;
          partners.push(a);
        }
      }

      const winRate = m?.stats[h.slug]?.[0] ?? h.victoire;
      const strength = winRate === null ? 0 : (winRate - 50) * BOT_WEIGHTS.strength;
      const score = counter + suffered + duo + strength + (noise ? noise() * BOT_WEIGHTS.noise : 0);

      let reason: BotReason;
      if (counter > 0 && counter >= duo) {
        reason = { type: "counter", targets, points: counterMeasured === null ? null : round1(counterMeasured) };
      } else if (duo > 0) reason = { type: "duo", partners, points: duoMeasured === null ? null : round1(duoMeasured) };
      else if (winRate !== null && winRate >= 50) reason = { type: "strength", winRate };
      else reason = lane ? { type: "lane" } : { type: "fallback" };

      return { fillsLane, candidate: { slug: h.slug, score, reason, lane } satisfies Candidate };
    });

  const useful = scored.some((e) => e.fillsLane) ? scored.filter((e) => e.fillsLane) : scored;
  return useful
    .map((e) => e.candidate)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface BotMove {
  slug: Choice;
  reason: BotReason;
  lane: Lane | null;
}

/**
 * The bot's move at the current turn. A ban is drawn among the top three of
 * the tier list (six times out of ten the first): a bot that always banned
 * the same heroes would teach the player nothing. A pick takes the best
 * ranked hero, give or take a breath of noise. Same seed, same moves.
 */
export function botMove(turns: Turn[], choices: Choice[], ctx: BotContext): BotMove | null {
  const turn = turns[choices.length];
  if (!turn) return null;
  const random = turnRandom(ctx.seed, turn.index);
  if (turn.action === "ban") {
    const candidates = rankBans(turns, choices, turn, ctx);
    if (candidates.length === 0) return { slug: null, reason: { type: "skipped" }, lane: null };
    const r = random();
    const i = Math.min(candidates.length - 1, r < 0.6 ? 0 : r < 0.85 ? 1 : 2);
    return { slug: candidates[i].slug, reason: candidates[i].reason, lane: null };
  }
  const [best] = rankPicks(turns, choices, turn, ctx, { limit: 1, noise: random });
  return best ? { slug: best.slug, reason: best.reason, lane: best.lane } : null;
}

/**
 * What happens when time runs out (Draft Pick): a ban stays empty, a pick is
 * drawn at random. The game favours the player's most played heroes; the
 * simulator, which does not know them, draws among heroes that add a lane to
 * the team.
 */
export function timeoutMove(turns: Turn[], choices: Choice[], catalog: HerosDraft[], seed: number): BotMove | null {
  const turn = turns[choices.length];
  if (!turn) return null;
  if (turn.action === "ban") return { slug: null, reason: { type: "skipped" }, lane: null };
  const excluded = unavailableHeroes(turns, choices, turn);
  const bySlug = new Map(catalog.map((h) => [h.slug, h]));
  const team = draftState(turns, choices).picks[turn.side].flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : []));
  const missingBefore = affecterLanes(team).manquantes.length;
  const free = catalog.filter((h) => !excluded.has(h.slug));
  const useful = free.filter((h) => affecterLanes([...team, h]).manquantes.length < missingBefore);
  const pool = useful.length > 0 ? useful : free;
  if (pool.length === 0) return null;
  const h = pool[Math.floor(turnRandom(seed, turn.index)() * pool.length)];
  const lane = LANES.find((l) => affecterLanes([...team, h]).lanes[l] === h.slug) ?? null;
  return { slug: h.slug, reason: { type: "random" }, lane };
}

// -- Summary ------------------------------------------------------------

/** Lane of each pick of a team, as the team analyzer assigns them. */
export function pickLanes(slugs: string[], catalog: Pick<HerosDraft, "slug" | "lanes">[]): Map<string, Lane> {
  const bySlug = new Map(catalog.map((h) => [h.slug, h]));
  const { lanes } = affecterLanes(slugs.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : [])));
  return new Map(LANES.flatMap((l) => (lanes[l] ? [[lanes[l]!, l] as const] : [])));
}

/** Measured matchup between a blue hero and a red hero. */
export interface Matchup {
  blue: string;
  red: string;
  /** Edge of the blue hero, in points: mean of both measured directions. Negative, red has the edge. */
  points: number;
}

/** Matchups measured at the rank between the two teams, most lopsided first. */
export function matchupsBetween(blue: string[], red: string[], measures: MesuresRang): Matchup[] {
  const out: Matchup[] = [];
  for (const b of blue) {
    for (const r of red) {
      const blueLoses = gapFor(measures.faible[b], r);
      const redLoses = gapFor(measures.faible[r], b);
      const reads = [blueLoses, redLoses === null ? null : -redLoses].filter((v): v is number => v !== null);
      if (reads.length > 0) out.push({ blue: b, red: r, points: round1(reads.reduce((x, y) => x + y, 0) / reads.length) });
    }
  }
  return out.sort((x, y) => Math.abs(y.points) - Math.abs(x.points));
}

export interface Advantage {
  /** Sum of measured matchups, from the blue side's point of view. */
  counters: number;
  /** Sum of the measured duo gains inside each team. */
  duos: Record<Side, number>;
  /** Counters plus the duo gap: an index in points, not a probability. */
  total: number;
  /** Share of the bar given to blue, between 0.05 and 0.95. */
  blueShare: number;
  /** Number of measurements behind the index: without any, the bar has nothing to say. */
  measures: number;
}

/**
 * A cumulative index of 10 points pushes the bar almost to the end. Adding
 * win-rate gaps does not make a win probability: the bar stops at 5 and 95%
 * so it never shows a certainty.
 */
export const ADVANTAGE_SCALE = 10;

export function measuredAdvantage(blue: string[], red: string[], measures: MesuresRang): Advantage {
  const matchups = matchupsBetween(blue, red, measures);
  const duosOf = (slugs: string[]) =>
    synergiesInternes(
      slugs.map((slug) => ({ slug, synergies: [] })),
      measures,
    ).filter((p): p is typeof p & { points: number } => p.points !== null);
  const bluePairs = duosOf(blue);
  const redPairs = duosOf(red);
  const sum = (l: number[]) => round1(l.reduce((a, b) => a + b, 0));
  const counters = sum(matchups.map((d) => d.points));
  const duos = { blue: sum(bluePairs.map((p) => p.points)), red: sum(redPairs.map((p) => p.points)) };
  const total = round1(counters + duos.blue - duos.red);
  const blueShare = 0.5 + Math.max(-0.45, Math.min(0.45, total / (2 * ADVANTAGE_SCALE)));
  return {
    counters,
    duos,
    total,
    blueShare: Math.round(blueShare * 1000) / 1000,
    measures: matchups.length + bluePairs.length + redPairs.length,
  };
}
