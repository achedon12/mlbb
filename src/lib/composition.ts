import { LANES, ROLES, suggest, type DraftHero, type Suggestion } from "./draft";
import type { MeasuredRank } from "./measured-ranks";
import type { Lane, HeroRatings, Tier, Role } from "./types";

/**
 * Team composition analysis.
 *
 * Up to five heroes picked with no set position: the module assigns their
 * lanes, counts roles and damage types, averages their ratings and their
 * rates by match duration, then looks in the game's measurements for what
 * binds them (teammates who win together) and what threatens them (opponents
 * who hinder several of them). No imported data: the module runs in the
 * browser on what the page passes it, and is tested without the catalogue.
 */

export const SIZE_TEAM = 5;

/** Damage type, under the catalogue key (`heroData.damage.*`). */
export type TypeDamage = "physical" | "magic" | "mixed";

/** What the analysis reads from a hero, for the whole roster. */
export interface TeamHero {
  slug: string;
  name: string;
  lanes: Lane[];
  roles: Role[];
  icon: string | null;
  /** Known synergies: wiki relations and best teammates across all ranks. */
  synergies: string[];
  damage: TypeDamage | null;
  notes: HeroRatings;
}

/** Hero named by a measurement, with the win-rate gap in points. */
export type Gap = [slug: string, points: number];

/** Match duration bucket, in minutes; `to` null for the last, open-ended one. */
export interface Bucket {
  from: number;
  to: number | null;
}

/**
 * Version of the `MeasuresRank` shape, part of the file URL. The file is cached
 * for an hour by the browser and kept offline by the service worker: bumping
 * the version whenever a field is renamed keeps new code from reading an old
 * copy.
 */
const MEASURES_FORMAT = 2;

/** Address of the measurements file of a rank. */
export function measuresUrl(rank: MeasuredRank): string {
  return `/composition/${rank}.json?v=${MEASURES_FORMAT}`;
}

/**
 * Measurements of one rank for the whole roster. One static file per rank
 * (`/composition/<rank>.json`): the page embeds nothing that depends on the
 * rank, and the browser only loads the ranks viewed.
 */
export interface MeasuresRank {
  rank: MeasuredRank;
  /** Win rate and tier of each hero ranked at this rank. */
  stats: Record<string, [win: number, tier: Tier]>;
  /** Buckets shared by all heroes. */
  buckets: Bucket[];
  /** Win rate of each hero per bucket, in the order of `buckets`. */
  duration: Record<string, number[]>;
  /** Teammates who raise each hero's win rate the most. */
  teammates: Record<string, Gap[]>;
  /** Opponents against whom each hero loses the most (negative gap). */
  weak: Record<string, Gap[]>;
}

const average = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ── Lanes ──────────────────────────────────────────────────────────

export interface Assignment {
  /** Hero placed on each filled lane. */
  lanes: Partial<Record<Lane, string>>;
  /** Heroes with no free lane: all their positions are taken by others. */
  extra: string[];
  /** Lanes nobody holds. */
  missing: Lane[];
}

/**
 * Places each hero on one of their lanes, one lane per hero. It first tries
 * to fill as many lanes as possible, then to keep each hero as close as
 * possible to their main position (the first in their list). Five heroes,
 * five lanes: the exhaustive search stays instant.
 */
export function assignLanes(team: Pick<TeamHero, "slug" | "lanes">[]): Assignment {
  const best = { choice: [] as (Lane | null)[], filled: -1, cost: Infinity };
  const choice: (Lane | null)[] = [];
  const taken = new Set<Lane>();

  const explore = (i: number, filled: number, cost: number) => {
    if (i === team.length) {
      if (filled > best.filled || (filled === best.filled && cost < best.cost)) {
        Object.assign(best, { choice: [...choice], filled, cost });
      }
      return;
    }
    team[i].lanes.forEach((lane, rank) => {
      if (taken.has(lane)) return;
      taken.add(lane);
      choice.push(lane);
      explore(i + 1, filled + 1, cost + rank);
      taken.delete(lane);
      choice.pop();
    });
    choice.push(null);
    explore(i + 1, filled, cost);
    choice.pop();
  };
  explore(0, 0, 0);

  const lanes: Partial<Record<Lane, string>> = {};
  const extra: string[] = [];
  team.forEach((h, i) => {
    const lane = best.choice[i];
    if (lane) lanes[lane] = h.slug;
    else extra.push(h.slug);
  });
  return { lanes, extra, missing: LANES.filter((l) => !lanes[l]) };
}

// ── Roles, damage, ratings ─────────────────────────────────────────

/** Number of heroes per role; a hero with two roles counts in both. */
export function countRoles(team: Pick<TeamHero, "roles">[]): Record<Role, number> {
  const count = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const h of team) for (const r of h.roles) count[r] += 1;
  return count;
}

export interface Damage extends Record<TypeDamage, number> {
  /** Share of physical damage, a mixed hero counting as half; null when no hero has the data. */
  physicalShare: number | null;
}

export function breakdownDamage(team: Pick<TeamHero, "damage">[]): Damage {
  const d = { physical: 0, magic: 0, mixed: 0 };
  for (const h of team) if (h.damage) d[h.damage] += 1;
  const total = d.physical + d.magic + d.mixed;
  return { ...d, physicalShare: total ? (d.physical + d.mixed / 2) / total : null };
}

export type Note = keyof HeroRatings;
export const NOTES: Note[] = ["offense", "durability", "abilityEffects", "difficulty"];

/** Average of each in-game rating (out of 10), over the heroes that have it. */
export function profileNotes(team: Pick<TeamHero, "notes">[]): Record<Note, number | null> {
  return Object.fromEntries(
    NOTES.map((n) => {
      const values = team.flatMap((h) => (h.notes[n] === null ? [] : [h.notes[n]]));
      return [n, values.length ? round(average(values), 1) : null];
    }),
  ) as Record<Note, number | null>;
}

// ── Match duration ─────────────────────────────────────────────────

export type ProfileDuration = "early" | "late" | "stable";

/**
 * Gap, in points, between the last two buckets and the first two beyond
 * which a team (or a hero) counts as early-game or late-game. The same rule
 * is used on the hero page.
 */
export const THRESHOLD_PROFILE = 1;

export function profileDuration(rate: number[]): ProfileDuration {
  if (rate.length < 2) return "stable";
  const gap = average(rate.slice(-2)) - average(rate.slice(0, 2));
  return gap > THRESHOLD_PROFILE ? "late" : gap < -THRESHOLD_PROFILE ? "early" : "stable";
}

export interface CurveTeam {
  buckets: Bucket[];
  /** Average of the measured heroes, bucket by bucket. */
  win: number[];
  profile: ProfileDuration;
  /** Index of the best bucket. */
  pic: number;
  /** Profile of each measured hero, to tell who carries which phase. */
  byHero: { slug: string; profile: ProfileDuration }[];
}

/** Team strength by match duration: the average of its heroes' curves. */
export function curveTeam(slugs: string[], measures: MeasuresRank): CurveTeam | null {
  const n = measures.buckets.length;
  const measures_ = slugs.flatMap((s) => (measures.duration[s]?.length === n ? [[s, measures.duration[s]] as const] : []));
  if (n < 2 || measures_.length === 0) return null;
  const win = measures.buckets.map((_, i) => round(average(measures_.map(([, d]) => d[i]))));
  return {
    buckets: measures.buckets,
    win,
    profile: profileDuration(win),
    pic: win.indexOf(Math.max(...win)),
    byHero: measures_.map(([slug, d]) => ({ slug, profile: profileDuration(d) })),
  };
}

// ── Synergies and threats ──────────────────────────────────────────

export interface Pair {
  a: string;
  b: string;
  /** Gain measured at the rank, in points; null for a known synergy with no measurement at this rank. */
  points: number | null;
}

/**
 * Team pairs that work well. A measurement is directed ("A wins more with
 * B") and only appears in the top list of one of the two: both directions
 * are read and the best gain is kept. Without a measurement, a known synergy
 * (wiki relation, all-ranks teammate) counts, without a figure.
 */
export function synergiesInternal(
  team: Pick<TeamHero, "slug" | "synergies">[],
  measures: MeasuresRank,
): Pair[] {
  const gain = (hero: string, partner: string) =>
    (measures.teammates[hero] ?? []).find(([s, p]) => s === partner && p > 0)?.[1] ?? null;
  const pairs: Pair[] = [];
  team.forEach((a, i) => {
    for (const b of team.slice(i + 1)) {
      const gains = [gain(a.slug, b.slug), gain(b.slug, a.slug)].filter((g): g is number => g !== null);
      if (gains.length) pairs.push({ a: a.slug, b: b.slug, points: Math.max(...gains) });
      else if (a.synergies.includes(b.slug) || b.synergies.includes(a.slug)) {
        pairs.push({ a: a.slug, b: b.slug, points: null });
      }
    }
  });
  return pairs.sort((x, y) => (y.points ?? -Infinity) - (x.points ?? -Infinity));
}

export interface Threat {
  slug: string;
  /** Team heroes hindered, with the gap they suffer (negative). */
  targets: Gap[];
  /** Sum of the gaps: the lower it is, the heavier the threat. */
  total: number;
}

/** Number of team heroes an opponent must hinder to count as a threat. */
export const MIN_TARGETS = 2;

/**
 * Opponents against whom several team heroes lose the most: the ban
 * candidates. Sorted by number of victims, then by cumulative gap.
 */
export function threats(slugs: string[], measures: MeasuresRank, limit = 6): Threat[] {
  const byOpponent = new Map<string, Gap[]>();
  for (const s of slugs) {
    for (const [opponent, points] of measures.weak[s] ?? []) {
      if (points >= 0 || slugs.includes(opponent)) continue;
      byOpponent.set(opponent, [...(byOpponent.get(opponent) ?? []), [s, points]]);
    }
  }
  return [...byOpponent]
    .filter(([, targets]) => targets.length >= MIN_TARGETS)
    .map(([slug, targets]) => ({
      slug,
      targets: targets.sort((x, y) => x[1] - y[1]),
      total: round(targets.reduce((t, [, p]) => t + p, 0), 1),
    }))
    .sort((x, y) => y.targets.length - x.targets.length || x.total - y.total)
    .slice(0, limit);
}

// ── Warnings ───────────────────────────────────────────────────────

export type Alert =
  | { type: "lanes"; lanes: Lane[]; extra: string[] }
  | { type: "tank" }
  | { type: "damage"; dominant: "physical" | "magic" }
  | { type: "control" | "fragile" | "hard"; value: number };

/**
 * Alert thresholds, on the average ratings (out of 10). They sit around the
 * most extreme tenth of randomly drawn teams: an alert flags a real
 * imbalance, not a merely average composition.
 */
export const THRESHOLDS = {
  /** Below this, the team lacks crowd control. */
  control: 3.5,
  /** Below this, it cannot take much damage. */
  resistance: 4,
  /** From this point, it demands mastery. */
  difficulty: 6,
  /** Share of a single damage type from which the opponent can cheaply protect against it. */
  damage: 0.8,
};

/** Number of heroes from which the team's balance is judged. */
export const MIN_ALERTS = 3;

export function alerts(team: TeamHero[], assignment: Assignment): Alert[] {
  const output: Alert[] = [];
  if (team.length === SIZE_TEAM && assignment.missing.length) {
    output.push({ type: "lanes", lanes: assignment.missing, extra: assignment.extra });
  }
  if (team.length < MIN_ALERTS) return output;

  if (!team.some((h) => h.roles.includes("Tank"))) output.push({ type: "tank" });
  const damage = breakdownDamage(team);
  const filled = damage.physical + damage.magic + damage.mixed;
  if (filled >= MIN_ALERTS && damage.physicalShare !== null) {
    if (damage.physicalShare >= THRESHOLDS.damage) output.push({ type: "damage", dominant: "physical" });
    else if (damage.physicalShare <= 1 - THRESHOLDS.damage) output.push({ type: "damage", dominant: "magic" });
  }
  const notes = profileNotes(team);
  if (notes.abilityEffects !== null && notes.abilityEffects < THRESHOLDS.control) {
    output.push({ type: "control", value: notes.abilityEffects });
  }
  if (notes.durability !== null && notes.durability < THRESHOLDS.resistance) {
    output.push({ type: "fragile", value: notes.durability });
  }
  if (notes.difficulty !== null && notes.difficulty >= THRESHOLDS.difficulty) {
    output.push({ type: "hard", value: notes.difficulty });
  }
  return output;
}

// ── Suggestions ────────────────────────────────────────────────────

/**
 * Picks suggested for the free lanes: the draft suggestion, with no
 * opponent, based on synergies with the team and the win rate at the rank.
 * Teammates measured at the rank are added to the known synergies.
 */
export function suggestionsTeam({
  catalog,
  slugs,
  lanes,
  measures,
  limit = 3,
}: {
  catalog: TeamHero[];
  slugs: string[];
  lanes: Lane[];
  measures: MeasuresRank | null;
  limit?: number;
}): { lane: Lane; picks: Suggestion[] }[] {
  if (lanes.length === 0) return [];
  // With no opponent, counter relations do not enter the calculation.
  const candidates: DraftHero[] = catalog.map((h) => ({
    ...h,
    win: measures?.stats[h.slug]?.[0] ?? null,
    strongAgainst: [],
    weakAgainst: [],
    synergies: [...new Set([...h.synergies, ...(measures?.teammates[h.slug] ?? []).map(([s]) => s)])],
  }));
  return lanes.map((lane) => ({ lane, picks: suggest({ candidates, lane, enemies: [], allies: slugs, limit }) }));
}

// ── Overall ────────────────────────────────────────────────────────

export interface Analysis {
  team: TeamHero[];
  assignment: Assignment;
  roles: Record<Role, number>;
  damage: Damage;
  notes: Record<Note, number | null>;
  alerts: Alert[];
  /** Everything below depends on the rank: null or empty while its measurements are missing. */
  win: number | null;
  curve: CurveTeam | null;
  synergies: Pair[];
  threats: Threat[];
  suggestions: { lane: Lane; picks: Suggestion[] }[];
}

export function analyzeTeam({
  catalog,
  slugs,
  measures,
}: {
  catalog: TeamHero[];
  slugs: string[];
  measures: MeasuresRank | null;
}): Analysis {
  const bySlug = new Map(catalog.map((h) => [h.slug, h]));
  const team = slugs.flatMap((s) => (bySlug.has(s) ? [bySlug.get(s)!] : []));
  const presents = team.map((h) => h.slug);
  const assignment = assignLanes(team);
  const rate = measures ? presents.flatMap((s) => (measures.stats[s] ? [measures.stats[s][0]] : [])) : [];

  return {
    team,
    assignment,
    roles: countRoles(team),
    damage: breakdownDamage(team),
    notes: profileNotes(team),
    alerts: alerts(team, assignment),
    win: rate.length ? round(average(rate), 1) : null,
    curve: measures ? curveTeam(presents, measures) : null,
    synergies: measures ? synergiesInternal(team, measures) : [],
    threats: measures ? threats(presents, measures) : [],
    suggestions:
      team.length < SIZE_TEAM
        ? suggestionsTeam({ catalog, slugs: presents, lanes: assignment.missing, measures })
        : [],
  };
}

// ── Shareable URL ──────────────────────────────────────────────────

/** Reads `?h=slug1,slug2&rang=mythic`, discarding what the page does not know. */
export function readSettings(
  search: string,
  known: Set<string>,
  ranks: readonly MeasuredRank[],
): { slugs: string[]; rank: MeasuredRank | null } {
  const params = new URLSearchParams(search);
  const slugs = [
    ...new Set(
      (params.get("h") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => known.has(s)),
    ),
  ].slice(0, SIZE_TEAM);
  return { slugs, rank: ranks.find((r) => r === params.get("rang")) ?? null };
}

/**
 * URL parameters for a team and a rank, others kept.
 * Slugs have no spaces or reserved characters: the comma stays readable
 * instead of being encoded as %2C. All ranks, the default, is omitted.
 */
export function writeSettings(search: string, slugs: string[], rank: MeasuredRank): string {
  const params = new URLSearchParams(search);
  params.delete("h");
  params.delete("rang");
  if (rank !== "all") params.set("rang", rank);
  return [slugs.length ? `h=${slugs.join(",")}` : "", params.toString()].filter(Boolean).join("&");
}
