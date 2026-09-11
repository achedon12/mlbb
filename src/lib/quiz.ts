import type { Lane, Role } from "./types";
import { cleRecherche } from "./utils";

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

export type TypeManche = "competence" | "skin" | "histoire" | "objet" | "duel";
export type TypeDevinette = Exclude<TypeManche, "duel">;

/** Ordre des manches du defi du jour, repris par la grille de partage. */
export const ORDRE_DEFI: TypeManche[] = ["competence", "skin", "histoire", "objet", "duel"];

/** Essais par manche : cinq pour un heros parmi 133, quatre pour un objet. */
export const ESSAIS: Record<TypeDevinette, number> = { competence: 5, skin: 5, histoire: 5, objet: 4 };

/** Paires du duel « plus ou moins » : trois le jour, une a l'entrainement. */
export const PAIRES_DUEL = 3;

/** Premier defi : le numero d'un jour se compte a partir de celui-ci. */
export const EPOQUE = "2026-09-11";

/** Essai qui abandonne la manche : il la termine sans compter comme erreur de plus. */
export const ABANDON = "-";

/** Agrandissement de l'illustration d'un skin, erreur apres erreur. */
export const ZOOMS = [3.2, 2.4, 1.8, 1.35, 1];

/** Pictogramme de chaque manche dans la grille partagee : il ne dit rien de la reponse. */
export const EMOJI_MANCHE: Record<TypeManche, string> = {
  competence: "✨",
  skin: "🎨",
  histoire: "📜",
  objet: "🛡️",
  duel: "⚖️",
};

// ─────────────────────────────────────────────────────────────
// Vivier
// ─────────────────────────────────────────────────────────────

/** Un heros tel que le quiz le compare : de quoi proposer, comparer et donner des indices. */
export interface HerosQuiz {
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
export interface ObjetRoster {
  slug: string;
  nom: string;
  icone: string | null;
  prix: number | null;
  /** Categorie, deja traduite. */
  categorie: string;
}

export interface ObjetQuiz extends ObjetRoster {
  bonus: string;
  recette: { nom: string; icone: string | null }[];
  /** Passif ou effet unique, nom de l'objet masque. */
  passif: string | null;
}

export interface CompetenceQuiz {
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
  heros: HerosQuiz[];
  competences: Record<string, CompetenceQuiz[]>;
  histoires: Record<string, string[]>;
  skins: Record<string, SkinQuiz[]>;
  objets: ObjetQuiz[];
  /** Taux de victoire tous rangs, heros assez joues seulement. */
  victoires: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────
// Manches
// ─────────────────────────────────────────────────────────────

export interface DuelHeros {
  slug: string;
  victoire: number;
}
export type PaireDuel = [DuelHeros, DuelHeros];

export type Manche =
  | { type: "competence"; reponse: string; nom: string; icone: string; extrait: string | null }
  /** `foyer` : point de l'illustration sur lequel l'image est agrandie, en fractions. */
  | { type: "skin"; reponse: string; image: string; skin: string; foyer: [number, number] }
  | { type: "histoire"; reponse: string; extraits: string[] }
  | {
      type: "objet";
      reponse: string;
      bonus: string;
      prix: number | null;
      categorie: string;
      recette: { nom: string; icone: string | null }[];
      passif: string | null;
    }
  | { type: "duel"; paires: PaireDuel[] };

export interface Defi {
  jour: string;
  numero: number;
  version: string;
  mesure: string;
  manches: Manche[];
}

/**
 * Source de hasard d'un tirage : a une cle, elle associe un nombre de [0, 1[.
 * Le defi du jour la tire d'un hachage (meme cle, meme nombre) ; l'entrainement
 * de `Math.random`.
 */
export type Tirage = (cle: string) => number;

/** Hachage FNV-1a sur 32 bits : court, sans dependance, identique partout. */
export function hacher(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Tirage reproductible : une graine, puis chaque cle donne toujours le meme nombre. */
export function tirageFixe(graine: string): Tirage {
  return (cle) => hacher(`${graine}|${cle}`) / 4294967296;
}

/** Candidat au plus petit tirage : stable quand la liste s'allonge d'un element qui ne gagne pas. */
function choisir<T>(candidats: T[], cle: (x: T) => string, tirage: Tirage): T | undefined {
  let meilleur: T | undefined;
  let valeur = Infinity;
  for (const c of candidats) {
    const v = tirage(cle(c));
    if (v < valeur) {
      valeur = v;
      meilleur = c;
    }
  }
  return meilleur;
}

const indice = (n: number, r: number) => Math.min(n - 1, Math.floor(r * n));
const arrondi = (v: number) => Math.round(v * 100) / 100;

/**
 * Une manche du type demande. `exclus` evite de reprendre un heros ou un
 * objet deja tire (il est complete au passage) ; `paires` fixe la longueur du
 * duel. Rend `null` quand le vivier n'a aucun candidat.
 */
export function genererManche(
  pool: PoolQuiz,
  type: TypeManche,
  tirage: Tirage,
  o: { exclus?: Set<string>; paires?: number; recetteSeulement?: boolean } = {},
): Manche | null {
  const exclus = o.exclus ?? new Set<string>();
  const libres = pool.heros.filter((h) => !exclus.has(h.slug));

  if (type === "competence") {
    const h = choisir(libres.filter((x) => pool.competences[x.slug]?.length), (x) => `competence:${x.slug}`, tirage);
    if (!h) return null;
    const liste = pool.competences[h.slug];
    const c = liste[indice(liste.length, tirage(`competence:${h.slug}:laquelle`))];
    exclus.add(h.slug);
    return { type, reponse: h.slug, nom: c.nom, icone: c.icone, extrait: c.extrait };
  }

  if (type === "skin") {
    const h = choisir(libres.filter((x) => pool.skins[x.slug]?.length), (x) => `skin:${x.slug}`, tirage);
    if (!h) return null;
    const liste = pool.skins[h.slug];
    const s = liste[indice(liste.length, tirage(`skin:${h.slug}:lequel`))];
    exclus.add(h.slug);
    // Le foyer reste vers le centre, la ou se tient le personnage.
    const foyer: [number, number] = [
      arrondi(0.3 + 0.4 * tirage(`skin:${h.slug}:x`)),
      arrondi(0.25 + 0.35 * tirage(`skin:${h.slug}:y`)),
    ];
    return { type, reponse: h.slug, image: s.image, skin: s.nom, foyer };
  }

  if (type === "histoire") {
    const h = choisir(libres.filter((x) => pool.histoires[x.slug]?.length), (x) => `histoire:${x.slug}`, tirage);
    if (!h) return null;
    const liste = pool.histoires[h.slug];
    const i = indice(liste.length, tirage(`histoire:${h.slug}:lequel`));
    exclus.add(h.slug);
    const extraits = liste.length > 1 ? [liste[i], liste[(i + 1) % liste.length]] : [liste[i]];
    return { type, reponse: h.slug, extraits };
  }

  if (type === "objet") {
    const candidats = pool.objets.filter((x) => !exclus.has(x.slug) && (!o.recetteSeulement || x.recette.length));
    const obj = choisir(candidats, (x) => `objet:${x.slug}`, tirage);
    if (!obj) return null;
    exclus.add(obj.slug);
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
  const mesures = libres.filter((h) => pool.victoires[h.slug] !== undefined);
  const paires: PaireDuel[] = [];
  for (let n = 0; n < (o.paires ?? 1); n++) {
    const cle = (x: HerosQuiz) => `duel:${n}:${x.slug}`;
    const a = choisir(mesures.filter((x) => !exclus.has(x.slug)), cle, tirage);
    if (!a) break;
    const va = pool.victoires[a.slug];
    const b = choisir(
      mesures.filter((x) => {
        const ecart = Math.abs(pool.victoires[x.slug] - va);
        return x.slug !== a.slug && !exclus.has(x.slug) && ecart >= 0.5 && ecart <= 6;
      }),
      (x) => `duel:${n}:b:${x.slug}`,
      tirage,
    );
    if (!b) break;
    exclus.add(a.slug).add(b.slug);
    paires.push([
      { slug: a.slug, victoire: va },
      { slug: b.slug, victoire: pool.victoires[b.slug] },
    ]);
  }
  return paires.length ? { type: "duel", paires } : null;
}

/** Defi du jour : une manche de chaque type, dans l'ordre de la grille, sans heros repete. */
export function genererDefi(pool: PoolQuiz, jour: string): Defi {
  const tirage = tirageFixe(`defi:${jour}`);
  const exclus = new Set<string>();
  const manches = ORDRE_DEFI.flatMap((type) => {
    const m = genererManche(pool, type, tirage, { exclus, paires: PAIRES_DUEL, recetteSeulement: true });
    return m ? [m] : [];
  });
  return { jour, numero: numeroDefi(jour), version: pool.version, mesure: pool.mesure, manches };
}

// ─────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────

/** Jour UTC d'une date, « 2026-09-11 » : le defi change a minuit UTC pour tout le monde. */
export function jourUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function estJourValide(jour: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false;
  const d = new Date(`${jour}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && jourUtc(d) === jour;
}

export function decalerJour(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return jourUtc(d);
}

export function numeroDefi(jour: string): number {
  return Math.round((Date.parse(`${jour}T00:00:00Z`) - Date.parse(`${EPOQUE}T00:00:00Z`)) / 86_400_000) + 1;
}

// ─────────────────────────────────────────────────────────────
// Textes
// ─────────────────────────────────────────────────────────────

export const MASQUE = "▢▢▢";

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Masque un nom dans un texte : le nom complet, sans casse, puis chacune de
 * ses parties d'au moins trois lettres qui commence par une majuscule
 * (« Popol and Kupa » masque « Popol » et « Kupa », pas « and » ; « Yi
 * Sun-shin » masque « Sun » sans toucher au soleil d'une phrase).
 */
export function masquerNom(texte: string, noms: string[]): string {
  let sortie = texte;
  const complets = [...new Set(noms.filter(Boolean))].sort((a, b) => b.length - a.length);
  const bord = (motif: string, drapeaux: string) =>
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${motif})(?![\\p{L}\\p{N}])`, drapeaux);
  if (complets.length) sortie = sortie.replace(bord(complets.map(echapper).join("|"), "giu"), MASQUE);
  const parties = [
    ...new Set(complets.flatMap((n) => n.split(/[\s.'’-]+/).filter((p) => p.length >= 3 && /^\p{Lu}/u.test(p)))),
  ].sort((a, b) => b.length - a.length);
  if (parties.length) sortie = sortie.replace(bord(parties.map(echapper).join("|"), "gu"), MASQUE);
  return sortie;
}

/** Coupe un texte vers `max` caracteres, a la fin d'une phrase si possible, sinon d'un mot. */
export function couper(texte: string, max: number): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= max) return propre;
  const debut = propre.slice(0, max);
  const phrase = Math.max(debut.lastIndexOf(". "), debut.lastIndexOf("! "), debut.lastIndexOf("? "));
  if (phrase >= max * 0.45) return debut.slice(0, phrase + 1);
  const mot = debut.lastIndexOf(" ");
  return `${debut.slice(0, mot > 0 ? mot : max).replace(/[,;:]$/, "")}…`;
}

// ─────────────────────────────────────────────────────────────
// Reponses et comparaisons
// ─────────────────────────────────────────────────────────────

/** Vainqueur de chaque paire du duel. */
export function reponsesDuel(manche: Extract<Manche, { type: "duel" }>): string[] {
  return manche.paires.map(([a, b]) => (a.victoire >= b.victoire ? a.slug : b.slug));
}

export function essaisMax(manche: Manche): number {
  return manche.type === "duel" ? manche.paires.length : ESSAIS[manche.type];
}

/** Erreurs d'une devinette : elles debloquent les indices, une par une. */
export function erreurs(manche: Manche, essais: string[]): number {
  if (manche.type === "duel") return 0;
  return essais.filter((e) => e !== ABANDON && e !== manche.reponse).length;
}

export function mancheReussie(manche: Manche, essais: string[]): boolean {
  if (manche.type === "duel") {
    const bonnes = reponsesDuel(manche);
    return essais.length === bonnes.length && essais.every((e, i) => e === bonnes[i]);
  }
  return essais.includes(manche.reponse);
}

export function mancheFinie(manche: Manche, essais: string[]): boolean {
  if (manche.type === "duel") return essais.length >= manche.paires.length;
  return essais.includes(manche.reponse) || essais.includes(ABANDON) || essais.length >= ESSAIS[manche.type];
}

/** Points : un par devinette trouvee, un par paire du duel. */
export function pointsManche(manche: Manche, essais: string[]): number {
  if (manche.type === "duel") {
    const bonnes = reponsesDuel(manche);
    return essais.filter((e, i) => e === bonnes[i]).length;
  }
  return essais.includes(manche.reponse) ? 1 : 0;
}

export function pointsMax(manches: Manche[]): number {
  return manches.reduce((n, m) => n + (m.type === "duel" ? m.paires.length : 1), 0);
}

export type Accord = "oui" | "partiel" | "non";
/** Position de la reponse par rapport a l'essai : `plus` = plus recent, plus cher. */
export type Sens = "egal" | "plus" | "moins" | "inconnu";

function accord<T>(essai: T[], cible: T[]): Accord {
  const communs = essai.filter((x) => cible.includes(x)).length;
  if (communs === 0) return "non";
  return communs === cible.length && essai.length === cible.length ? "oui" : "partiel";
}

function sens(essai: number | null, cible: number | null): Sens {
  if (essai === null || cible === null) return "inconnu";
  return essai === cible ? "egal" : cible > essai ? "plus" : "moins";
}

/** Ce qu'un mauvais heros a en commun avec la reponse : un indice de plus a chaque essai. */
export function comparerHeros(essai: HerosQuiz, cible: HerosQuiz) {
  return {
    roles: accord(essai.roles, cible.roles),
    lanes: accord(essai.lanes, cible.lanes),
    annee: sens(essai.annee, cible.annee),
    region: (essai.region && essai.region === cible.region ? "oui" : "non") as Accord,
  };
}

export function comparerObjets(essai: ObjetRoster, cible: ObjetRoster) {
  return {
    prix: sens(essai.prix, cible.prix),
    categorie: (essai.categorie === cible.categorie ? "oui" : "non") as Accord,
  };
}

/**
 * Propositions du champ de reponse : le debut du nom d'abord, puis le debut
 * d'un mot, puis n'importe quelle partie. Sans casse ni accents.
 */
export function chercherOptions<T extends { slug: string; nom: string }>(
  options: T[],
  texte: string,
  exclus: Set<string>,
  max = 8,
): T[] {
  const terme = cleRecherche(texte.trim());
  if (!terme) return [];
  const rang = (nom: string) => {
    const cle = cleRecherche(nom);
    if (cle.startsWith(terme)) return 0;
    if (cle.split(/[\s.'’-]+/).some((m) => m.startsWith(terme))) return 1;
    return cle.includes(terme) ? 2 : -1;
  };
  return options
    .filter((o) => !exclus.has(o.slug))
    .map((o) => ({ o, r: rang(o.nom) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.o.nom.localeCompare(b.o.nom))
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
export function ligneGrille(manche: Manche, essais: string[]): string {
  if (manche.type === "duel") {
    const bonnes = reponsesDuel(manche);
    const carres = bonnes.map((b, i) => (essais[i] === undefined ? "⬛" : essais[i] === b ? "🟩" : "🟥"));
    return `${EMOJI_MANCHE.duel} ${carres.join("")}`;
  }
  const joues = essais.filter((e) => e !== ABANDON).map((e) => (e === manche.reponse ? "🟩" : "🟥"));
  const reste = essais.includes(ABANDON) ? "🟥" : "⬛";
  const vides = Array(Math.max(0, ESSAIS[manche.type] - joues.length)).fill(reste);
  return `${EMOJI_MANCHE[manche.type]} ${[...joues, ...vides].join("")}`;
}

export function textePartage(o: {
  numero: number;
  points: number;
  max: number;
  serie: number;
  lignes: string[];
  url: string;
}): string {
  const serie = o.serie >= 2 ? ` 🔥${o.serie}` : "";
  return [`MLBBDex Quiz #${o.numero} · ${o.points}/${o.max}${serie}`, ...o.lignes, o.url].join("\n");
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

export const STATS_VIDES: StatsQuiz = { joues: 0, serie: 0, meilleure: 0, dernier: null, distribution: [] };

/** Enregistre un defi termine. Un jour deja compte ne l'est pas deux fois. */
export function enregistrerPartie(stats: StatsQuiz, jour: string, points: number): StatsQuiz {
  if (stats.dernier === jour) return stats;
  const serie = stats.dernier === decalerJour(jour, -1) ? stats.serie + 1 : 1;
  const distribution = [...stats.distribution];
  while (distribution.length <= points) distribution.push(0);
  distribution[points] += 1;
  return { joues: stats.joues + 1, serie, meilleure: Math.max(stats.meilleure, serie), dernier: jour, distribution };
}

/** Serie a afficher : rompue si ni aujourd'hui ni hier n'ont ete joues. */
export function serieCourante(stats: StatsQuiz, aujourdhui: string): number {
  return stats.dernier === aujourdhui || stats.dernier === decalerJour(aujourdhui, -1) ? stats.serie : 0;
}
