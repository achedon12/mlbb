/**
 * Analyses du profil de joueur : roles et positions, evolution au fil des
 * parties, et ce que joue le rang du joueur sur ses heros.
 *
 * Calculs purs, sans appel reseau, comme `profil-joueur` : pages et tests leur
 * passent des reponses deja lues par `joueur-api`.
 */
import type { ResolvedBuild } from "@/components/builds-by-rank";
import { buildsPlayed, counters, heroesBySlug, type BuildPlayed } from "./data";
import { GAME_LANE } from "./player-format";
import type { FrequentHero, MatchSummary } from "./player-api";
import { shownHero, type ShownHero, type HeroRow } from "./player-profile";
import type { MeasuredRank } from "./measured-ranks";
import type { Lane, Role } from "./types";
import { resolveBuild } from "./build-visuals";

// ─────────────────────────────────────────────────────────────
// Roles et positions
// ─────────────────────────────────────────────────────────────

/** En dessous, un role ou une position n'est ni point fort ni point faible : trop peu de parties. */
export const MATCHES_MIN_ROLE = 10;

export interface RowRole<C extends string> {
  key: C;
  matches: number;
  wins: number;
  /** Taux de victoire, en points. */
  rate: number;
  /** Part des parties comptees, en points. */
  part: number;
}

export interface SummaryRoles<C extends string> {
  /** Du plus au moins joue. */
  rows: RowRole<C>[];
  /** Base de la part des parties. */
  total: number;
  /** Parties qui n'ont pu etre rattachees a rien : heros inconnu du site, position absente. */
  excluded: number;
  /** Meilleur et plus faible taux parmi ceux joues au moins `PARTIES_MIN_POSTE` fois. */
  strong: C | null;
  weak: C | null;
}

type Counters<C extends string> = Map<C, { matches: number; wins: number }>;

function add<C extends string>(tallies: Counters<C>, key: C, matches: number, wins: number) {
  const c = tallies.get(key) ?? { matches: 0, wins: 0 };
  c.matches += matches;
  c.wins += wins;
  tallies.set(key, c);
}

function summaryRoles<C extends string>(tallies: Counters<C>, total: number, excluded: number): SummaryRoles<C> {
  const rows = [...tallies]
    .filter(([, c]) => c.matches > 0)
    .map(([key, c]) => ({
      key,
      matches: c.matches,
      wins: c.wins,
      rate: (c.wins / c.matches) * 100,
      part: total > 0 ? (c.matches / total) * 100 : 0,
    }))
    .sort((a, b) => b.matches - a.matches || b.rate - a.rate);

  // A taux egal, le plus joue l'emporte : son taux est le plus sur.
  const kept = rows.filter((l) => l.matches >= MATCHES_MIN_ROLE);
  const strong = [...kept].sort((a, b) => b.rate - a.rate || b.matches - a.matches)[0];
  const weak = [...kept].sort((a, b) => a.rate - b.rate || b.matches - a.matches)[0];
  const contrast = kept.length >= 2 && strong.rate > weak.rate;
  return { rows, total, excluded, strong: contrast ? strong.key : null, weak: contrast ? weak.key : null };
}

const sheetOf = (h: MatchSummary["hero"]) => {
  const slug = shownHero(h).slug;
  return slug ? heroesBySlug.get(slug) : undefined;
};

/**
 * Parties de la saison par role du heros, d'apres le catalogue du site. Un
 * heros a deux roles compte dans chacun : la somme des parts peut depasser
 * cent. Un heros inconnu du site est ecarte plutot que devine.
 */
export function statsByRole(frequents: FrequentHero[]): SummaryRoles<Role> {
  const tallies: Counters<Role> = new Map();
  let total = 0;
  let excluded = 0;
  for (const f of frequents) {
    if (f.matches <= 0) continue;
    total += f.matches;
    const roles = sheetOf(f.hero)?.roles ?? [];
    if (roles.length === 0) excluded += f.matches;
    for (const role of new Set(roles)) add(tallies, role, f.matches, f.wins);
  }
  return summaryRoles(tallies, total, excluded);
}

/**
 * Position occupee partie par partie. Le service la donne (`lid`) ; a defaut,
 * un heros qui n'a qu'une position au catalogue la prete. Une partie a l'issue
 * inconnue ne compte pas : elle ne dirait rien du taux.
 */
export function positionOf(p: MatchSummary): Lane | null {
  if (p.lane !== null && GAME_LANE[p.lane]) return GAME_LANE[p.lane];
  const lanes = sheetOf(p.hero)?.lanes ?? [];
  return lanes.length === 1 ? lanes[0] : null;
}

export function statsByPosition(matches: MatchSummary[]): SummaryRoles<Lane> {
  const tallies: Counters<Lane> = new Map();
  let counted = 0;
  let excluded = 0;
  for (const p of matches) {
    if (p.win === null) continue;
    const lane = positionOf(p);
    if (!lane) {
      excluded++;
      continue;
    }
    counted++;
    add(tallies, lane, 1, p.win ? 1 : 0);
  }
  return summaryRoles(tallies, counted, excluded);
}

// ─────────────────────────────────────────────────────────────
// Evolution au fil des parties
// ─────────────────────────────────────────────────────────────

/** Parties de la moyenne glissante, et de la « forme » recente. */
export const WINDOW_SHAPE = 10;

export interface Series {
  win: boolean;
  length: number;
}

export interface Evolution {
  /** Parties dont l'issue est connue. */
  matches: number;
  wins: number;
  /** Serie en cours, a partir de la partie la plus recente. */
  ongoingSeries: Series | null;
  /** Plus longues series de victoires et de defaites. */
  bestStreak: number;
  worstStreak: number;
  /** Taux sur les `FENETRE_FORME` dernieres parties ; null s'il y en a moins. */
  shape: number | null;
  /**
   * Courbe, de la plus ancienne partie a la plus recente, a partir de la
   * premiere fenetre complete : une date (jour UTC) par partie, le taux
   * glissant et le taux cumule. null faute de deux points, ou de dates.
   */
  curve: { dates: string[]; rolling: number[]; cumulative: number[] } | null;
}

const dayUtc = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * Jour de chaque partie. Une partie sans date prend celle de sa voisine plus
 * ancienne, ou a defaut plus recente : la courbe exige une date par point, et
 * l'ordre du service fait foi. null si aucune partie n'est datee.
 */
function datesOf(timer: MatchSummary[]): string[] | null {
  const known = timer.map((p) => (p.date !== null && Number.isFinite(p.date) ? dayUtc(p.date) : null));
  const first = known.find((d) => d !== null);
  if (!first) return null;
  let previous = first;
  return known.map((d) => (previous = d ?? previous));
}

/**
 * Evolution sur l'historique lu, des plus recentes aux plus anciennes comme
 * les rend le service. Les parties a l'issue inconnue sont laissees de cote :
 * elles ne cassent pas une serie.
 */
export function evolution(matches: MatchSummary[], window = WINDOW_SHAPE): Evolution {
  const timer = matches.filter((p) => p.win !== null).reverse();
  const issues = timer.map((p) => p.win === true);
  const n = issues.length;

  let bestStreak = 0;
  let worstStreak = 0;
  let current = null as Series | null;
  for (const v of issues) {
    current = { win: v, length: current?.win === v ? current.length + 1 : 1 };
    if (v) bestStreak = Math.max(bestStreak, current.length);
    else worstStreak = Math.max(worstStreak, current.length);
  }

  const rolling: number[] = [];
  const cumulative: number[] = [];
  let won = 0;
  let inWindow = 0;
  issues.forEach((v, i) => {
    won += v ? 1 : 0;
    inWindow += v ? 1 : 0;
    if (i >= window) inWindow -= issues[i - window] ? 1 : 0;
    if (i >= window - 1) {
      rolling.push((inWindow / window) * 100);
      cumulative.push((won / (i + 1)) * 100);
    }
  });

  const dates = datesOf(timer);
  return {
    matches: n,
    wins: won,
    ongoingSeries: current,
    bestStreak,
    worstStreak,
    shape: n >= window ? rolling.at(-1)! : null,
    curve: dates && rolling.length >= 2 ? { dates: dates.slice(window - 1), rolling, cumulative } : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Ce que joue le rang
// ─────────────────────────────────────────────────────────────

export interface CounterHard {
  hero: ShownHero;
  /** Ecart de taux de victoire du heros du joueur face a lui, en points (negatif). */
  advantage: number;
}

export interface HeroRankSheet {
  row: HeroRow & { hero: { slug: string } };
  /** Position du build retenu. */
  lane: Lane | null;
  build: ResolvedBuild | null;
  /** Rang dont vient le build : celui du joueur, ou tous rangs a defaut. */
  rankBuild: MeasuredRank | null;
  weak: CounterHard[];
  rankCounters: MeasuredRank | null;
}

/** Heros de la fiche du site, pret a afficher. */
function shownOnSite(slug: string): ShownHero | null {
  const h = heroesBySlug.get(slug);
  return h ? { slug: h.slug, name: h.name, portrait: h.images.portrait } : null;
}

/**
 * Position a retenir pour les builds d'un heros : celle ou le joueur l'a le
 * plus joue recemment, si le rang y a des builds ; sinon la premiere position
 * du catalogue qui en a, puis la premiere mesuree.
 */
function laneOfPlayer(slug: string, available: string[], recent: MatchSummary[]): string | null {
  const played = new Map<string, number>();
  for (const p of recent) {
    const lane = p.lane !== null ? GAME_LANE[p.lane] : undefined;
    if (lane && shownHero(p.hero).slug === slug) played.set(lane, (played.get(lane) ?? 0) + 1);
  }
  const preferred = [...played].sort((a, b) => b[1] - a[1]).find(([l]) => available.includes(l));
  if (preferred) return preferred[0];
  const catalog = heroesBySlug.get(slug)?.lanes.find((l) => available.includes(l));
  return catalog ?? available[0] ?? null;
}

/** Le plus joue d'abord : la plus forte part des parties. */
const bySelection = (a: BuildPlayed, b: BuildPlayed) => (b.pickRate ?? -1) - (a.pickRate ?? -1);

/** Le rang demande, ou tous rangs confondus a defaut. */
function atRank<V>(byRank: Partial<Record<MeasuredRank, V>> | undefined, bucket: MeasuredRank) {
  if (byRank?.[bucket] !== undefined) return { value: byRank[bucket]!, rank: bucket };
  if (byRank?.all !== undefined) return { value: byRank.all, rank: "all" as MeasuredRank };
  return null;
}

/**
 * Pour les heros les plus joues : le build le plus joue a son rang — la plus
 * forte part des parties — et les heros qui le mettent le plus en difficulte a
 * ce rang. Un heros sans aucune de ces mesures est passe.
 */
export function heroRankSheets(
  rows: HeroRow[],
  bucket: MeasuredRank,
  recent: MatchSummary[],
  howMany = 3,
): HeroRankSheet[] {
  const sheets: HeroRankSheet[] = [];
  for (const row of rows) {
    if (sheets.length >= howMany) break;
    const slug = row.hero.slug;
    if (!slug) continue;

    const byLane = buildsPlayed[slug] ?? {};
    const lane = laneOfPlayer(slug, Object.keys(byLane), recent);
    const builds = lane ? atRank(byLane[lane], bucket) : null;
    const mostPlayed = [...(builds?.value ?? [])].sort(bySelection)[0];

    const measure = atRank(counters[slug], bucket);
    const weak = [...(measure?.value.weak ?? [])]
      .filter((c) => c.advantage < 0)
      .sort((a, b) => a.advantage - b.advantage)
      .flatMap((c) => {
        const hero = shownOnSite(c.slug);
        return hero ? [{ hero, advantage: c.advantage }] : [];
      })
      .slice(0, 3);

    if (!mostPlayed && weak.length === 0) continue;
    sheets.push({
      row: { ...row, hero: { ...row.hero, slug } },
      lane: mostPlayed ? (lane as Lane) : null,
      build: mostPlayed ? resolveBuild(mostPlayed) : null,
      rankBuild: mostPlayed ? builds!.rank : null,
      weak,
      rankCounters: weak.length > 0 ? measure!.rank : null,
    });
  }
  return sheets;
}
