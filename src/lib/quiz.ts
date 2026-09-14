import type { Lane, Role } from "./types";
import { keySearch } from "./utils";

/**
 * Quiz MLBB : defi du jour et entrainement.
 *
 * Module sans donnees ni dependance au navigateur. Le serveur s'en sert pour
 * tirer le defi du jour dans le vivier (`quiz-donnees.ts`) ; le client, pour
 * refaire ce meme tirage hors ligne a partir du vivier garde en cache, et pour
 * les manches de l'entrainement.
 *
 * Le defi ne depend que de la date UTC : tout le monde a le meme, dans toutes
 * les langues — seuls les textes changent. Chaque choix prend le candidat au
 * plus petit hachage de « date + slug » plutot qu'un indice dans une liste :
 * l'arrivee d'un nouveau heros ne rebat pas les defis deja joues.
 */

export type TypeRound = "skill" | "skin" | "story" | "item" | "duel";
export type GuessType = Exclude<TypeRound, "duel">;

/** Ordre des manches du defi du jour, repris par la grille de partage. */
export const ORDER_CHALLENGE: TypeRound[] = ["skill", "skin", "story", "item", "duel"];

/** Essais par manche : cinq pour un heros parmi 133, quatre pour un objet. */
export const ATTEMPTS: Record<GuessType, number> = { skill: 5, skin: 5, story: 5, item: 4 };

/** Paires du duel « plus ou moins » : trois le jour, une a l'entrainement. */
export const PAIRS_DUEL = 3;

/** Premier defi : le numero d'un jour se compte a partir de celui-ci. */
export const EPOCH = "2026-09-11";

/** Essai qui abandonne la manche : il la termine sans compter comme erreur de plus. */
export const ABANDON = "-";

/** Agrandissement de l'illustration d'un skin, erreur apres erreur. */
export const ZOOMS = [3.2, 2.4, 1.8, 1.35, 1];

/** Pictogramme de chaque manche dans la grille partagee : il ne dit rien de la reponse. */
export const EMOJI_ROUND: Record<TypeRound, string> = {
  skill: "✨",
  skin: "🎨",
  story: "📜",
  item: "🛡️",
  duel: "⚖️",
};

// ─────────────────────────────────────────────────────────────
// Vivier
// ─────────────────────────────────────────────────────────────

/** Un heros tel que le quiz le compare : de quoi proposer, comparer et donner des indices. */
export interface QuizHero {
  slug: string;
  nom: string;
  icone: string | null;
  roles: Role[];
  lanes: Lane[];
  annee: number | null;
  /** Region, deja traduite. */
  region: string | null;
}

/** Un objet tel que le champ de reponse le propose et le compare. */
export interface ItemRoster {
  slug: string;
  nom: string;
  icone: string | null;
  prix: number | null;
  /** Categorie, deja traduite. */
  categorie: string;
}

export interface ItemQuiz extends ItemRoster {
  bonus: string;
  recette: { nom: string; icone: string | null }[];
  /** Passif ou effet unique, nom de l'objet masque. */
  passif: string | null;
}

export interface SkillQuiz {
  nom: string;
  icone: string;
  /** Debut de la description, nom du heros masque. */
  extrait: string | null;
}

export interface SkinQuiz {
  nom: string;
  image: string;
}

/**
 * Tout ce qu'il faut pour tirer des manches, dans une langue. Le serveur le
 * sert a l'entrainement (`/quiz/<langue>.json`) ; le defi du jour n'en envoie
 * que le tirage.
 */
export interface PoolQuiz {
  /** Change a chaque synchronisation : le cache du navigateur se renouvelle alors. */
  version: string;
  /** Date du releve des taux de victoire. */
  mesure: string;
  heros: QuizHero[];
  competences: Record<string, SkillQuiz[]>;
  histoires: Record<string, string[]>;
  skins: Record<string, SkinQuiz[]>;
  objets: ItemQuiz[];
  /** Taux de victoire tous rangs, heros assez joues seulement. */
  victoires: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────
// Manches
// ─────────────────────────────────────────────────────────────

export interface DuelHero {
  slug: string;
  victoire: number;
}
export type PairDuel = [DuelHero, DuelHero];

export type Round =
  | { type: "skill"; reponse: string; nom: string; icone: string; extrait: string | null }
  /** `foyer` : point de l'illustration sur lequel l'image est agrandie, en fractions. */
  | { type: "skin"; reponse: string; image: string; skin: string; foyer: [number, number] }
  | { type: "story"; reponse: string; extraits: string[] }
  | {
      type: "item";
      reponse: string;
      bonus: string;
      prix: number | null;
      categorie: string;
      recette: { nom: string; icone: string | null }[];
      passif: string | null;
    }
  | { type: "duel"; paires: PairDuel[] };

export interface Challenge {
  jour: string;
  numero: number;
  version: string;
  mesure: string;
  manches: Round[];
}

/**
 * Source de hasard d'un tirage : a une cle, elle associe un nombre de [0, 1[.
 * Le defi du jour la tire d'un hachage (meme cle, meme nombre) ; l'entrainement
 * de `Math.random`.
 */
export type Draw = (key: string) => number;

/** Hachage FNV-1a sur 32 bits : court, sans dependance, identique partout. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Tirage reproductible : une graine, puis chaque cle donne toujours le meme nombre. */
export function fixedDraw(seed: string): Draw {
  return (key) => hash(`${seed}|${key}`) / 4294967296;
}

/** Candidat au plus petit tirage : stable quand la liste s'allonge d'un element qui ne gagne pas. */
function choose<T>(candidates: T[], key: (x: T) => string, draw: Draw): T | undefined {
  let best: T | undefined;
  let value = Infinity;
  for (const c of candidates) {
    const v = draw(key(c));
    if (v < value) {
      value = v;
      best = c;
    }
  }
  return best;
}

const hint = (n: number, r: number) => Math.min(n - 1, Math.floor(r * n));
const rounded = (v: number) => Math.round(v * 100) / 100;

/**
 * Une manche du type demande. `exclus` evite de reprendre un heros ou un
 * objet deja tire (il est complete au passage) ; `paires` fixe la longueur du
 * duel. Rend `null` quand le vivier n'a aucun candidat.
 */
export function generateRound(
  pool: PoolQuiz,
  type: TypeRound,
  draw: Draw,
  o: { excluded?: Set<string>; pairs?: number; recipeOnly?: boolean } = {},
): Round | null {
  const excluded = o.excluded ?? new Set<string>();
  const free = pool.heros.filter((h) => !excluded.has(h.slug));

  if (type === "skill") {
    const h = choose(free.filter((x) => pool.competences[x.slug]?.length), (x) => `competence:${x.slug}`, draw);
    if (!h) return null;
    const list = pool.competences[h.slug];
    const c = list[hint(list.length, draw(`competence:${h.slug}:laquelle`))];
    excluded.add(h.slug);
    return { type, reponse: h.slug, nom: c.nom, icone: c.icone, extrait: c.extrait };
  }

  if (type === "skin") {
    const h = choose(free.filter((x) => pool.skins[x.slug]?.length), (x) => `skin:${x.slug}`, draw);
    if (!h) return null;
    const list = pool.skins[h.slug];
    const s = list[hint(list.length, draw(`skin:${h.slug}:lequel`))];
    excluded.add(h.slug);
    // Le foyer reste vers le centre, la ou se tient le personnage.
    const home: [number, number] = [
      rounded(0.3 + 0.4 * draw(`skin:${h.slug}:x`)),
      rounded(0.25 + 0.35 * draw(`skin:${h.slug}:y`)),
    ];
    return { type, reponse: h.slug, image: s.image, skin: s.nom, foyer: home };
  }

  if (type === "story") {
    const h = choose(free.filter((x) => pool.histoires[x.slug]?.length), (x) => `histoire:${x.slug}`, draw);
    if (!h) return null;
    const list = pool.histoires[h.slug];
    const i = hint(list.length, draw(`histoire:${h.slug}:lequel`));
    excluded.add(h.slug);
    const excerpts = list.length > 1 ? [list[i], list[(i + 1) % list.length]] : [list[i]];
    return { type, reponse: h.slug, extraits: excerpts };
  }

  if (type === "item") {
    const candidates = pool.objets.filter((x) => !excluded.has(x.slug) && (!o.recipeOnly || x.recette.length));
    const obj = choose(candidates, (x) => `objet:${x.slug}`, draw);
    if (!obj) return null;
    excluded.add(obj.slug);
    return {
      type,
      reponse: obj.slug,
      bonus: obj.bonus,
      prix: obj.prix,
      categorie: obj.categorie,
      recette: obj.recette,
      passif: obj.passif,
    };
  }

  // Duel : deux heros aux taux assez ecartes pour qu'il y ait une reponse,
  // pas assez pour qu'elle saute aux yeux.
  const measures = free.filter((h) => pool.victoires[h.slug] !== undefined);
  const pairs: PairDuel[] = [];
  for (let n = 0; n < (o.pairs ?? 1); n++) {
    const key = (x: QuizHero) => `duel:${n}:${x.slug}`;
    const a = choose(measures.filter((x) => !excluded.has(x.slug)), key, draw);
    if (!a) break;
    const va = pool.victoires[a.slug];
    const b = choose(
      measures.filter((x) => {
        const gap = Math.abs(pool.victoires[x.slug] - va);
        return x.slug !== a.slug && !excluded.has(x.slug) && gap >= 0.5 && gap <= 6;
      }),
      (x) => `duel:${n}:b:${x.slug}`,
      draw,
    );
    if (!b) break;
    excluded.add(a.slug).add(b.slug);
    pairs.push([
      { slug: a.slug, victoire: va },
      { slug: b.slug, victoire: pool.victoires[b.slug] },
    ]);
  }
  return pairs.length ? { type: "duel", paires: pairs } : null;
}

/** Defi du jour : une manche de chaque type, dans l'ordre de la grille, sans heros repete. */
export function generateChallenge(pool: PoolQuiz, day: string): Challenge {
  const draw = fixedDraw(`defi:${day}`);
  const excluded = new Set<string>();
  const rounds = ORDER_CHALLENGE.flatMap((type) => {
    const m = generateRound(pool, type, draw, { excluded, pairs: PAIRS_DUEL, recipeOnly: true });
    return m ? [m] : [];
  });
  return { jour: day, numero: numberChallenge(day), version: pool.version, mesure: pool.mesure, manches: rounds };
}

// ─────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────

/** Jour UTC d'une date, « 2026-09-11 » : le defi change a minuit UTC pour tout le monde. */
export function dayUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && dayUtc(d) === day;
}

export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayUtc(d);
}

export function numberChallenge(day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / 86_400_000) + 1;
}

// ─────────────────────────────────────────────────────────────
// Textes
// ─────────────────────────────────────────────────────────────

export const MASK = "▢▢▢";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Masque un nom dans un texte : le nom complet, sans casse, puis chacune de
 * ses parties d'au moins trois lettres qui commence par une majuscule
 * (« Popol and Kupa » masque « Popol » et « Kupa », pas « and » ; « Yi
 * Sun-shin » masque « Sun » sans toucher au soleil d'une phrase).
 */
export function maskName(text: string, names: string[]): string {
  let output = text;
  const full = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  const edge = (pattern: string, flags: string) =>
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, flags);
  if (full.length) output = output.replace(edge(full.map(escape).join("|"), "giu"), MASK);
  const matches = [
    ...new Set(full.flatMap((n) => n.split(/[\s.'’-]+/).filter((p) => p.length >= 3 && /^\p{Lu}/u.test(p)))),
  ].sort((a, b) => b.length - a.length);
  if (matches.length) output = output.replace(edge(matches.map(escape).join("|"), "gu"), MASK);
  return output;
}

/** Coupe un texte vers `max` caracteres, a la fin d'une phrase si possible, sinon d'un mot. */
export function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const start = clean.slice(0, max);
  const sentence = Math.max(start.lastIndexOf(". "), start.lastIndexOf("! "), start.lastIndexOf("? "));
  if (sentence >= max * 0.45) return start.slice(0, sentence + 1);
  const word = start.lastIndexOf(" ");
  return `${start.slice(0, word > 0 ? word : max).replace(/[,;:]$/, "")}…`;
}

// ─────────────────────────────────────────────────────────────
// Reponses et comparaisons
// ─────────────────────────────────────────────────────────────

/** Vainqueur de chaque paire du duel. */
export function responsesDuel(round: Extract<Round, { type: "duel" }>): string[] {
  return round.paires.map(([a, b]) => (a.victoire >= b.victoire ? a.slug : b.slug));
}

export function attemptsMax(round: Round): number {
  return round.type === "duel" ? round.paires.length : ATTEMPTS[round.type];
}

/** Erreurs d'une devinette : elles debloquent les indices, une par une. */
export function errors(round: Round, attempts: string[]): number {
  if (round.type === "duel") return 0;
  return attempts.filter((e) => e !== ABANDON && e !== round.reponse).length;
}

export function roundSuccessful(round: Round, attempts: string[]): boolean {
  if (round.type === "duel") {
    const good = responsesDuel(round);
    return attempts.length === good.length && attempts.every((e, i) => e === good[i]);
  }
  return attempts.includes(round.reponse);
}

export function roundFinished(round: Round, attempts: string[]): boolean {
  if (round.type === "duel") return attempts.length >= round.paires.length;
  return attempts.includes(round.reponse) || attempts.includes(ABANDON) || attempts.length >= ATTEMPTS[round.type];
}

/** Points : un par devinette trouvee, un par paire du duel. */
export function pointsRound(round: Round, attempts: string[]): number {
  if (round.type === "duel") {
    const good = responsesDuel(round);
    return attempts.filter((e, i) => e === good[i]).length;
  }
  return attempts.includes(round.reponse) ? 1 : 0;
}

export function pointsMax(rounds: Round[]): number {
  return rounds.reduce((n, m) => n + (m.type === "duel" ? m.paires.length : 1), 0);
}

export type Agreement = "yes" | "partial" | "no";
/** Position de la reponse par rapport a l'essai : `plus` = plus recent, plus cher. */
export type Direction = "equal" | "higher" | "lower" | "unknown";

function agreement<T>(attempt: T[], target: T[]): Agreement {
  const common = attempt.filter((x) => target.includes(x)).length;
  if (common === 0) return "no";
  return common === target.length && attempt.length === target.length ? "yes" : "partial";
}

function direction(attempt: number | null, target: number | null): Direction {
  if (attempt === null || target === null) return "unknown";
  return attempt === target ? "equal" : target > attempt ? "higher" : "lower";
}

/** Ce qu'un mauvais heros a en commun avec la reponse : un indice de plus a chaque essai. */
export function compareHeroes(attempt: QuizHero, target: QuizHero) {
  return {
    roles: agreement(attempt.roles, target.roles),
    lanes: agreement(attempt.lanes, target.lanes),
    year: direction(attempt.annee, target.annee),
    region: (attempt.region && attempt.region === target.region ? "yes" : "no") as Agreement,
  };
}

export function compareItems(attempt: ItemRoster, target: ItemRoster) {
  return {
    price: direction(attempt.prix, target.prix),
    category: (attempt.categorie === target.categorie ? "yes" : "no") as Agreement,
  };
}

/**
 * Propositions du champ de reponse : le debut du nom d'abord, puis le debut
 * d'un mot, puis n'importe quelle partie. Sans casse ni accents.
 */
export function searchOptions<T extends { slug: string; name: string }>(
  options: T[],
  text: string,
  excluded: Set<string>,
  max = 8,
): T[] {
  const term = keySearch(text.trim());
  if (!term) return [];
  const rank = (name: string) => {
    const key = keySearch(name);
    if (key.startsWith(term)) return 0;
    if (key.split(/[\s.'’-]+/).some((m) => m.startsWith(term))) return 1;
    return key.includes(term) ? 2 : -1;
  };
  return options
    .filter((o) => !excluded.has(o.slug))
    .map((o) => ({ o, r: rank(o.name) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.o.name.localeCompare(b.o.name))
    .slice(0, max)
    .map((x) => x.o);
}

// ─────────────────────────────────────────────────────────────
// Partage et statistiques
// ─────────────────────────────────────────────────────────────

/**
 * Ligne de la grille : un carre par essai, sans rien dire de la reponse. Les
 * essais non joues restent noirs ; une manche abandonnee se remplit de rouge,
 * pour ne pas se lire comme une manche pas encore jouee.
 */
export function rowGrid(round: Round, attempts: string[]): string {
  if (round.type === "duel") {
    const good = responsesDuel(round);
    const squares = good.map((b, i) => (attempts[i] === undefined ? "⬛" : attempts[i] === b ? "🟩" : "🟥"));
    return `${EMOJI_ROUND.duel} ${squares.join("")}`;
  }
  const played = attempts.filter((e) => e !== ABANDON).map((e) => (e === round.reponse ? "🟩" : "🟥"));
  const rest = attempts.includes(ABANDON) ? "🟥" : "⬛";
  const empty = Array(Math.max(0, ATTEMPTS[round.type] - played.length)).fill(rest);
  return `${EMOJI_ROUND[round.type]} ${[...played, ...empty].join("")}`;
}

export function textShare(o: {
  number: number;
  points: number;
  max: number;
  series: number;
  rows: string[];
  url: string;
}): string {
  const series = o.series >= 2 ? ` 🔥${o.series}` : "";
  return [`MLBBDex Quiz #${o.number} · ${o.points}/${o.max}${series}`, ...o.rows, o.url].join("\n");
}

export interface StatsQuiz {
  joues: number;
  serie: number;
  meilleure: number;
  /** Dernier jour termine. */
  dernier: string | null;
  /** Nombre de defis par score, de 0 au maximum. */
  distribution: number[];
}

export const STATS_EMPTY: StatsQuiz = { joues: 0, serie: 0, meilleure: 0, dernier: null, distribution: [] };

/** Enregistre un defi termine. Un jour deja compte ne l'est pas deux fois. */
export function saveMatch(stats: StatsQuiz, day: string, points: number): StatsQuiz {
  if (stats.dernier === day) return stats;
  const series = stats.dernier === shiftDay(day, -1) ? stats.serie + 1 : 1;
  const distribution = [...stats.distribution];
  while (distribution.length <= points) distribution.push(0);
  distribution[points] += 1;
  return { joues: stats.joues + 1, serie: series, meilleure: Math.max(stats.meilleure, series), dernier: day, distribution };
}

/** Serie a afficher : rompue si ni aujourd'hui ni hier n'ont ete joues. */
export function currentStreak(stats: StatsQuiz, today: string): number {
  return stats.dernier === today || stats.dernier === shiftDay(today, -1) ? stats.serie : 0;
}
