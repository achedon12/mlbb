/**
 * Profil de joueur : ses chiffres, rapportes a ceux du site.
 *
 * Le service donne les parties et les heros joues ; le site connait le taux de
 * victoire de chaque heros dans chaque tranche de rang. Rapprocher les deux
 * situe le joueur face aux autres joueurs de son niveau, et en tire quelques
 * conseils simples. Tout est calcule ici, sans appel reseau : pages et tests
 * passent des reponses deja lues par `joueur-api`.
 */
import { allHeroes } from "./data";
import type { FrequentHero, GameHero, Participant, MatchSummary } from "./player-api";
import { readableRank } from "./ranks";
import type { MeasuredRank } from "./measured-ranks";
import { statsByRank } from "./tier-list";
import { keySearch } from "./utils";

/** Heros pret a afficher : fiche du site quand elle existe, sinon ce qu'en dit le service. */
export interface ShownHero {
  slug: string | null;
  name: string;
  portrait: string | null;
}

const keyName = (name: string) => keySearch(name).replace(/[^a-z0-9]/g, "");

/**
 * Identifiant du jeu vers fiche du site. Le wiki numerote les heros comme le
 * jeu, suivis d'un chiffre : Fanny, heros 17 du jeu, est « 171 » ; Miya,
 * heros 1, « 011 ».
 */
const BY_HID = new Map(allHeroes.map((h) => [Math.floor(Number(h.id) / 10), h]));
const BY_NAME = new Map(allHeroes.map((h) => [keyName(h.name), h]));

export function shownHero(h: GameHero): ShownHero {
  // Le nom d'abord : un nouveau heros numerote autrement ne doit pas en
  // emprunter un autre. L'identifiant rattrape les graphies divergentes.
  const site = BY_NAME.get(keyName(h.name)) ?? BY_HID.get(h.hid);
  if (!site) return { slug: null, name: h.name, portrait: h.image };
  return { slug: site.slug, name: site.name, portrait: site.images.portrait ?? h.image };
}

/**
 * Tranche de mesure du rang du joueur.
 *
 * Le site mesure les heros d'Epique a Gloire mythique. En dessous, aucune
 * tranche ne correspond : on compare a tous rangs confondus. Immortel, au-dela
 * de la derniere tranche mesuree, se compare a Gloire.
 */
const BUCKETS: Partial<Record<string, MeasuredRank>> = {
  epic: "epic",
  legend: "legend",
  mythic: "mythic",
  "mythic-honor": "honor",
  "mythic-glory": "glory",
  "mythic-immortal": "glory",
};

export function bucketOfRank(rankLevel: number): MeasuredRank {
  if (!Number.isFinite(rankLevel) || rankLevel < 1) return "all";
  return BUCKETS[readableRank(rankLevel).key] ?? "all";
}

/** Taux de victoire d'un heros dans la tranche, ou tous rangs confondus a defaut. */
export function averageOfRank(slug: string, bucket: MeasuredRank): { win: number; bucket: MeasuredRank } | null {
  const stats = statsByRank(slug);
  const kept = stats[bucket] ? bucket : stats.all ? "all" : null;
  return kept ? { win: stats[kept]!.winRate, bucket: kept } : null;
}

export interface HeroRow {
  hero: ShownHero;
  matches: number;
  wins: number;
  /** Taux de victoire du joueur, en points (0 a 100). */
  rate: number;
  /** Taux de victoire du heros chez tous les joueurs de la tranche, en points. */
  average: number | null;
  bucketAverage: MeasuredRank | null;
  /** Taux du joueur moins la moyenne, en points. */
  gap: number | null;
  note: number | null;
}

/** Heros joues, du plus au moins joue, chacun face a la moyenne de la tranche. */
export function compareHeroes(frequents: FrequentHero[], bucket: MeasuredRank): HeroRow[] {
  return frequents
    .filter((f) => f.matches > 0)
    .map((f) => {
      const shown = shownHero(f.hero);
      const rate = (f.wins / f.matches) * 100;
      const average = shown.slug ? averageOfRank(shown.slug, bucket) : null;
      return {
        hero: shown,
        matches: f.matches,
        wins: f.wins,
        rate,
        average: average?.win ?? null,
        bucketAverage: average?.bucket ?? null,
        gap: average ? rate - average.win : null,
        note: f.note,
      };
    })
    .sort((a, b) => b.matches - a.matches || b.wins - a.wins);
}

export interface SummarySeason {
  matches: number;
  wins: number;
  /** Taux de victoire, en points ; null sans partie. */
  rate: number | null;
  heroes: number;
}

/** Bilan de la saison, somme des heros joues : le service ne le donne pas tout fait. */
export function summarySeason(frequents: FrequentHero[]): SummarySeason {
  const matches = frequents.reduce((n, f) => n + f.matches, 0);
  const wins = frequents.reduce((n, f) => n + f.wins, 0);
  return { matches, wins, rate: matches ? (wins / matches) * 100 : null, heroes: frequents.length };
}

/** En dessous, un taux de victoire sur un heros ne dit encore rien. */
export const MATCHES_MIN = 5;
/** Ecart a la moyenne, en points, a partir duquel un heros est signale. */
export const MARGIN_POINTS = 3;

/**
 * Borne basse de l'intervalle de Wilson (90 %). Classe les heros sur ce que
 * leur taux garantit plutot que sur ce qu'il affiche : 5 victoires en 5
 * parties passent derriere 17 en 20.
 */
function boundLow(wins: number, matches: number): number {
  if (matches === 0) return 0;
  const z = 1.645;
  const p = wins / matches;
  const z2 = z * z;
  const center = p + z2 / (2 * matches);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * matches)) / matches);
  return (center - margin) / (1 + z2 / matches);
}

/** Heros qui font gagner le joueur, assez joues pour que ce soit credible. */
export function bestHero(rows: HeroRow[], howMany = 3): HeroRow[] {
  return rows
    .filter((l) => l.matches >= MATCHES_MIN && l.rate > 50)
    .sort((a, b) => boundLow(b.wins, b.matches) - boundLow(a.wins, a.matches))
    .slice(0, howMany);
}

/**
 * Heros nettement sous la moyenne de la tranche. Classes par parties perdues
 * de trop — l'ecart fois le nombre de parties : un heros un peu faible mais
 * tres joue coute plus qu'un echec ponctuel.
 */
export function belowAverageHeroes(rows: HeroRow[], howMany = 3): HeroRow[] {
  const missing = (l: HeroRow) => (-(l.gap ?? 0) * l.matches) / 100;
  return rows
    .filter((l) => l.matches >= MATCHES_MIN && l.gap !== null && l.gap <= -MARGIN_POINTS)
    .sort((a, b) => missing(b) - missing(a))
    .slice(0, howMany);
}

/** Nombre de parties recentes dont on lit le detail pour reperer les adversaires. */
export const ANALYZED_MATCHES = 12;

export interface AnalyzedMatch {
  /** Issue selon la liste des parties ; a defaut, celle du detail. */
  win: boolean | null;
  participants: Participant[];
}

export interface Nemesis {
  hero: ShownHero;
  defeats: number;
  encounters: number;
}

/**
 * Heros adverses qui reviennent dans les defaites du joueur.
 *
 * Le joueur se retrouve dans le detail par son identifiant ; son equipe
 * designe, par difference, les adversaires. Une partie ou il n'apparait pas,
 * ou sans equipes, est ignoree plutot que devinee. Un heros n'est retenu qu'a
 * partir de deux defaites : une seule ne fait pas une tendance.
 */
export function nemeses(
  matches: AnalyzedMatch[],
  me: { roleId: number; zoneId: number },
  howMany = 3,
): { list: Nemesis[]; analyzed: number } {
  const counters = new Map<number, { hero: GameHero; defeats: number; encounters: number }>();
  let analyzed = 0;

  for (const match of matches) {
    const own = match.participants.find(
      (p) => p.roleId === me.roleId && (p.zoneId === null || p.zoneId === me.zoneId),
    );
    const win = match.win ?? own?.win ?? null;
    if (!own || own.team === null || win === null) continue;

    const opponents = match.participants.filter((p) => p.team !== null && p.team !== own.team);
    if (opponents.length === 0) continue;
    analyzed++;

    const seen = new Set<number>();
    for (const a of opponents) {
      if (seen.has(a.hero.hid)) continue;
      seen.add(a.hero.hid);
      const c = counters.get(a.hero.hid) ?? { hero: a.hero, defeats: 0, encounters: 0 };
      c.encounters++;
      if (!win) c.defeats++;
      counters.set(a.hero.hid, c);
    }
  }

  const list = [...counters.values()]
    .filter((c) => c.defeats >= 2)
    .sort((a, b) => b.defeats - a.defeats || b.defeats / b.encounters - a.defeats / a.encounters)
    .slice(0, howMany)
    .map((c) => ({ hero: shownHero(c.hero), defeats: c.defeats, encounters: c.encounters }));

  return { list, analyzed };
}

/** Partie prete a afficher, transmissible telle quelle au navigateur. */
export interface MatchShown {
  id: string;
  hero: ShownHero;
  win: boolean | null;
  eliminations: number;
  deaths: number;
  assists: number;
  note: number | null;
  mvp: boolean;
  lane: number | null;
  date: number | null;
}

export function showMatch(p: MatchSummary): MatchShown {
  return {
    id: p.id,
    hero: shownHero(p.hero),
    win: p.win,
    eliminations: p.eliminations,
    deaths: p.deaths,
    assists: p.assists,
    note: p.note,
    mvp: p.mvp,
    lane: p.lane,
    date: p.date,
  };
}
