import { LANES, ROLES, suggest, type DraftHero, type Suggestion } from "./draft";
import type { MeasuredRank } from "./measured-ranks";
import type { Lane, HeroRatings, Tier, Role } from "./types";

/**
 * Analyse d'une composition d'equipe.
 *
 * Jusqu'a cinq heros choisis sans position imposee : le module leur attribue
 * les lanes, fait le compte des roles et des degats, moyenne leurs notes et
 * leurs taux par duree de partie, puis cherche dans les mesures du jeu ce qui
 * les lie (coequipiers qui se font gagner) et ce qui les menace (adversaires
 * qui en genent plusieurs). Aucune donnee importee : le module tourne dans le
 * navigateur sur ce que la page lui passe, et se teste sans le catalogue.
 */

export const SIZE_TEAM = 5;

/** Type de degats, sous la cle du catalogue (`heroData.damage.*`). */
export type TypeDamage = "physical" | "magic" | "mixed";

/** Ce que l'analyse lit d'un heros, pour tout le roster. */
export interface TeamHero {
  slug: string;
  name: string;
  lanes: Lane[];
  roles: Role[];
  icon: string | null;
  /** Synergies connues : relations du wiki et meilleurs coequipiers tous rangs. */
  synergies: string[];
  damage: TypeDamage | null;
  notes: HeroRatings;
}

/** Heros cite par une mesure, avec l'ecart de victoire en points. */
export type Gap = [slug: string, points: number];

/** Tranche de duree de partie, en minutes ; `a` nul pour la derniere, ouverte. */
export interface Bucket {
  from: number;
  to: number | null;
}

/**
 * Mesures d'un rang pour tout le roster. Un fichier statique par rang
 * (`/composition/<rang>.json`) : la page n'embarque rien de ce qui depend du
 * rang, et le navigateur ne charge que les rangs consultes.
 */
export interface MeasuresRank {
  rang: MeasuredRank;
  /** Taux de victoire et palier de chaque heros classe au rang. */
  stats: Record<string, [win: number, tier: Tier]>;
  /** Tranches communes a tous les heros. */
  tranches: Bucket[];
  /** Taux de victoire de chaque heros par tranche, dans l'ordre de `tranches`. */
  duree: Record<string, number[]>;
  /** Coequipiers qui font le plus gagner chaque heros. */
  coequipiers: Record<string, Gap[]>;
  /** Adversaires contre qui chaque heros perd le plus (ecart negatif). */
  faible: Record<string, Gap[]>;
}

const average = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ── Lanes ──────────────────────────────────────────────────────────

export interface Assignment {
  /** Heros place sur chaque lane pourvue. */
  lanes: Partial<Record<Lane, string>>;
  /** Heros sans lane libre : toutes ses positions sont prises par d'autres. */
  extra: string[];
  /** Lanes que personne ne tient. */
  missing: Lane[];
}

/**
 * Place chaque heros sur une de ses lanes, une lane par heros. On cherche
 * d'abord a en pourvoir le plus possible, puis a garder chacun au plus pres de
 * sa position principale (la premiere de sa liste). Cinq heros, cinq lanes :
 * l'essai exhaustif reste instantane.
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

// ── Roles, degats, notes ───────────────────────────────────────────

/** Nombre de heros par role ; un heros a deux roles compte dans les deux. */
export function countRoles(team: Pick<TeamHero, "roles">[]): Record<Role, number> {
  const count = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const h of team) for (const r of h.roles) count[r] += 1;
  return count;
}

export interface Damage extends Record<TypeDamage, number> {
  /** Part des degats physiques, un heros mixte comptant pour moitie ; null sans heros renseigne. */
  partPhysique: number | null;
}

export function breakdownDamage(team: Pick<TeamHero, "damage">[]): Damage {
  const d = { physical: 0, magic: 0, mixed: 0 };
  for (const h of team) if (h.damage) d[h.damage] += 1;
  const total = d.physical + d.magic + d.mixed;
  return { ...d, partPhysique: total ? (d.physical + d.mixed / 2) / total : null };
}

export type Note = keyof HeroRatings;
export const NOTES: Note[] = ["offense", "durability", "abilityEffects", "difficulty"];

/** Moyenne de chaque note du jeu (sur 10), sur les heros qui l'ont. */
export function profileNotes(team: Pick<TeamHero, "notes">[]): Record<Note, number | null> {
  return Object.fromEntries(
    NOTES.map((n) => {
      const values = team.flatMap((h) => (h.notes[n] === null ? [] : [h.notes[n]]));
      return [n, values.length ? round(average(values), 1) : null];
    }),
  ) as Record<Note, number | null>;
}

// ── Duree de partie ────────────────────────────────────────────────

export type ProfileDuration = "early" | "late" | "stable";

/**
 * Ecart, en points, entre les deux dernieres tranches et les deux premieres
 * au-dela duquel on parle d'une equipe (ou d'un heros) de debut ou de fin de
 * partie. La meme regle sert a la fiche heros.
 */
export const THRESHOLD_PROFILE = 1;

export function profileDuration(rate: number[]): ProfileDuration {
  if (rate.length < 2) return "stable";
  const gap = average(rate.slice(-2)) - average(rate.slice(0, 2));
  return gap > THRESHOLD_PROFILE ? "late" : gap < -THRESHOLD_PROFILE ? "early" : "stable";
}

export interface CurveTeam {
  buckets: Bucket[];
  /** Moyenne des heros mesures, tranche par tranche. */
  win: number[];
  profile: ProfileDuration;
  /** Indice de la meilleure tranche. */
  pic: number;
  /** Profil de chaque heros mesure, pour dire qui porte quelle phase. */
  byHero: { slug: string; profile: ProfileDuration }[];
}

/** Puissance de l'equipe selon la duree de partie : la moyenne des courbes de ses heros. */
export function curveTeam(slugs: string[], measures: MeasuresRank): CurveTeam | null {
  const n = measures.tranches.length;
  const measures_ = slugs.flatMap((s) => (measures.duree[s]?.length === n ? [[s, measures.duree[s]] as const] : []));
  if (n < 2 || measures_.length === 0) return null;
  const win = measures.tranches.map((_, i) => round(average(measures_.map(([, d]) => d[i]))));
  return {
    buckets: measures.tranches,
    win,
    profile: profileDuration(win),
    pic: win.indexOf(Math.max(...win)),
    byHero: measures_.map(([slug, d]) => ({ slug, profile: profileDuration(d) })),
  };
}

// ── Synergies et menaces ───────────────────────────────────────────

export interface Pair {
  a: string;
  b: string;
  /** Gain mesure au rang, en points ; null pour une synergie connue sans mesure a ce rang. */
  points: number | null;
}

/**
 * Paires de l'equipe qui fonctionnent. Une mesure est dirigee (« A gagne plus
 * avec B ») et ne figure que dans le top de l'un des deux : on lit les deux
 * sens et on garde le meilleur gain. A defaut de mesure, une synergie connue
 * (relation du wiki, coequipier tous rangs) compte, sans chiffre.
 */
export function synergiesInternal(
  team: Pick<TeamHero, "slug" | "synergies">[],
  measures: MeasuresRank,
): Pair[] {
  const gain = (de: string, partner: string) =>
    (measures.coequipiers[de] ?? []).find(([s, p]) => s === partner && p > 0)?.[1] ?? null;
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
  /** Heros de l'equipe genes, avec l'ecart qu'ils subissent (negatif). */
  targets: Gap[];
  /** Somme des ecarts : plus elle est basse, plus la menace pese. */
  total: number;
}

/** Nombre de heros de l'equipe qu'un adversaire doit gener pour etre une menace. */
export const MIN_TARGETS = 2;

/**
 * Adversaires contre qui plusieurs heros de l'equipe perdent le plus : les
 * candidats au ban. Classes par nombre de victimes, puis par ecart cumule.
 */
export function threats(slugs: string[], measures: MeasuresRank, limit = 6): Threat[] {
  const byOpponent = new Map<string, Gap[]>();
  for (const s of slugs) {
    for (const [opponent, points] of measures.faible[s] ?? []) {
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

// ── Points d'attention ─────────────────────────────────────────────

export type Alert =
  | { type: "lanes"; lanes: Lane[]; extra: string[] }
  | { type: "tank" }
  | { type: "damage"; dominant: "physical" | "magic" }
  | { type: "control" | "fragile" | "hard"; value: number };

/**
 * Seuils des alertes, sur la moyenne des notes (sur 10). Ils se placent vers
 * le dixieme d'equipes tirees au hasard le plus extreme : une alerte signale
 * un vrai desequilibre, pas une composition simplement moyenne.
 */
export const THRESHOLDS = {
  /** En dessous, l'equipe manque de controle. */
  control: 3.5,
  /** En dessous, elle encaisse mal. */
  resistance: 4,
  /** A partir de la, elle demande de la maitrise. */
  difficulty: 6,
  /** Part d'un seul type de degats a partir de laquelle l'adversaire s'en protege a peu de frais. */
  damage: 0.8,
};

/** Nombre de heros a partir duquel l'equilibre de l'equipe se juge. */
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
  if (filled >= MIN_ALERTS && damage.partPhysique !== null) {
    if (damage.partPhysique >= THRESHOLDS.damage) output.push({ type: "damage", dominant: "physical" });
    else if (damage.partPhysique <= 1 - THRESHOLDS.damage) output.push({ type: "damage", dominant: "magic" });
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
 * Picks proposes pour les lanes libres : la suggestion du draft, sans
 * adversaire, sur les synergies avec l'equipe et le taux de victoire au rang.
 * Les coequipiers mesures au rang s'ajoutent aux synergies connues.
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
  // Sans adversaire, les relations de contre n'entrent pas dans le calcul.
  const candidates: DraftHero[] = catalog.map((h) => ({
    ...h,
    win: measures?.stats[h.slug]?.[0] ?? null,
    strongAgainst: [],
    weakAgainst: [],
    synergies: [...new Set([...h.synergies, ...(measures?.coequipiers[h.slug] ?? []).map(([s]) => s)])],
  }));
  return lanes.map((lane) => ({ lane, picks: suggest({ candidates, lane, enemies: [], allies: slugs, limit }) }));
}

// ── Ensemble ───────────────────────────────────────────────────────

export interface Analysis {
  team: TeamHero[];
  assignment: Assignment;
  roles: Record<Role, number>;
  damage: Damage;
  notes: Record<Note, number | null>;
  alerts: Alert[];
  /** Tout ce qui suit depend du rang : null ou vide tant que ses mesures manquent. */
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

// ── Adresse partageable ────────────────────────────────────────────

/** Lit `?h=slug1,slug2&rang=mythic`, en ecartant ce que la page ne connait pas. */
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
 * Parametres de l'adresse pour une equipe et un rang, les autres conserves.
 * Les slugs n'ont ni espace ni caractere reserve : la virgule reste lisible
 * plutot que d'etre encodee en %2C. Tous rangs, le rang par defaut, s'omet.
 */
export function writeSettings(search: string, slugs: string[], rank: MeasuredRank): string {
  const params = new URLSearchParams(search);
  params.delete("h");
  params.delete("rang");
  if (rank !== "all") params.set("rang", rank);
  return [slugs.length ? `h=${slugs.join(",")}` : "", params.toString()].filter(Boolean).join("&");
}
