import { decalerJour, enregistrerPartie, hacher, type StatsQuiz } from "./quiz";
import type { Lane, Role } from "./types";

/**
 * MLBBdle : un heros secret par jour, a deviner en comparant ses traits a
 * ceux des heros proposes (mode classique), ou d'apres une icone de
 * competence (mode competence). Essais illimites, comme sur Loldle.
 *
 * Module pur, sans donnees ni navigateur : le serveur s'en sert pour tirer les
 * secrets du jour, le client pour comparer les essais, remplir la grille a
 * partager et tenir les statistiques.
 *
 * Le secret ne depend que de la date UTC et du roster : le meme pour tout le
 * monde, dans toutes les langues. Il se tire de proche en proche depuis
 * l'epoque, pour ne pas reprendre un heros des `FENETRE` derniers jours ; un
 * heros n'est candidat que quelques jours apres sa sortie, si bien que
 * l'arrivee d'un nouveau heros ne rebat pas les jours deja joues.
 */

/** Premier jour du jeu : le numero d'un jour se compte a partir de celui-ci. */
export const EPOQUE = "2026-09-11";

/** Jours pendant lesquels un secret ne revient pas, dans chaque mode. */
export const FENETRE = 60;

/**
 * Delai entre la sortie d'un heros et sa premiere apparition : le temps que
 * la synchro l'amene et que les joueurs le connaissent.
 */
export const DELAI_NOUVEAU = 14;

/** Derniere case de la repartition des essais : « 10 et plus ». */
export const SEAU_MAX = 10;

/** Lignes d'essais dans la grille partagee, au-dela desquelles on resume. */
export const LIGNES_PARTAGE = 8;

/** Au-dela, la grille d'un mode competence s'ecrit en nombre plutot qu'en carres. */
const CARRES_MAX = 12;

export type Genre = "homme" | "femme" | "aucun";

/** Traits compares par le mode classique, dans l'ordre des colonnes. */
export type Colonne =
  | "genre"
  | "roles"
  | "lanes"
  | "specialites"
  | "degats"
  | "attaque"
  | "ressource"
  | "region"
  | "annee";

export const COLONNES: Colonne[] = [
  "genre",
  "roles",
  "lanes",
  "specialites",
  "degats",
  "attaque",
  "ressource",
  "region",
  "annee",
];

/**
 * Un heros tel que MLBBdle le compare. Les valeurs sont des cles
 * independantes de la langue (`magic`, `moniyan-empire`) : la comparaison vaut
 * pour toutes les langues, les libelles arrivent a part.
 */
export interface HerosMlbbdle {
  slug: string;
  nom: string;
  icone: string | null;
  genre: Genre | null;
  roles: Role[];
  lanes: Lane[];
  specialites: string[];
  degats: string | null;
  attaque: string | null;
  ressource: string | null;
  region: string | null;
  annee: number | null;
}

// ─────────────────────────────────────────────────────────────
// Comparaison
// ─────────────────────────────────────────────────────────────

/** Vert, orange, rouge ; gris quand une des deux valeurs manque. */
export type Verdict = "oui" | "partiel" | "non" | "inconnu";
/** Position du secret par rapport a l'essai : `plus` = sorti plus tard. */
export type Sens = "egal" | "plus" | "moins" | "inconnu";

export interface CaseComparee {
  verdict: Verdict;
  /** Annee seulement : dans quel sens chercher. */
  sens?: Sens;
}

function ensembles<T>(essai: T[], cible: T[]): Verdict {
  if (!essai.length || !cible.length) return "inconnu";
  const communs = essai.filter((x) => cible.includes(x)).length;
  if (communs === 0) return "non";
  return communs === cible.length && essai.length === cible.length ? "oui" : "partiel";
}

/**
 * Valeur unique. `large` couvre les deux autres valeurs du trait (degats
 * mixtes, portee hybride) : il donne un accord partiel avec chacune.
 */
function unique(essai: string | null, cible: string | null, large?: string): Verdict {
  if (!essai || !cible) return "inconnu";
  if (essai === cible) return "oui";
  return large && (essai === large || cible === large) ? "partiel" : "non";
}

function sens(essai: number | null, cible: number | null): Sens {
  if (essai === null || cible === null) return "inconnu";
  return essai === cible ? "egal" : cible > essai ? "plus" : "moins";
}

/** Une case par colonne : ce que l'essai partage avec le secret. */
export function comparer(essai: HerosMlbbdle, cible: HerosMlbbdle): Record<Colonne, CaseComparee> {
  const annee = sens(essai.annee, cible.annee);
  return {
    genre: { verdict: unique(essai.genre, cible.genre) },
    roles: { verdict: ensembles(essai.roles, cible.roles) },
    lanes: { verdict: ensembles(essai.lanes, cible.lanes) },
    specialites: { verdict: ensembles(essai.specialites, cible.specialites) },
    degats: { verdict: unique(essai.degats, cible.degats, "mixed") },
    attaque: { verdict: unique(essai.attaque, cible.attaque, "hybrid") },
    ressource: { verdict: unique(essai.ressource, cible.ressource) },
    region: { verdict: unique(essai.region, cible.region) },
    annee: { verdict: annee === "egal" ? "oui" : annee === "inconnu" ? "inconnu" : "non", sens: annee },
  };
}

// ─────────────────────────────────────────────────────────────
// Mode competence
// ─────────────────────────────────────────────────────────────

/** Une icone de competence, son nom et un extrait de sa description, nom du heros masque. */
export interface EnigmeCompetence {
  reponse: string;
  nom: string;
  icone: string;
  extrait: string | null;
}

export type IndiceCompetence = "couleur" | "nom" | "description" | "roles";

/** Indices du mode competence, et le nombre d'erreurs qui debloque chacun. */
export const INDICES_COMPETENCE: { cle: IndiceCompetence; seuil: number }[] = [
  { cle: "couleur", seuil: 2 },
  { cle: "nom", seuil: 4 },
  { cle: "description", seuil: 6 },
  { cle: "roles", seuil: 8 },
];

export function indicesDebloques(erreurs: number): Set<IndiceCompetence> {
  return new Set(INDICES_COMPETENCE.filter((i) => erreurs >= i.seuil).map((i) => i.cle));
}

/** Prochain indice a debloquer, et les erreurs qui l'en separent. */
export function prochainIndice(erreurs: number): { cle: IndiceCompetence; restant: number } | null {
  const i = INDICES_COMPETENCE.find((x) => erreurs < x.seuil);
  return i ? { cle: i.cle, restant: i.seuil - erreurs } : null;
}

// ─────────────────────────────────────────────────────────────
// Defi du jour
// ─────────────────────────────────────────────────────────────

export interface DefiMlbbdle {
  jour: string;
  numero: number;
  classique: string;
  competence: EnigmeCompetence | null;
  /** Reponses de la veille ; absentes avant le premier jour. */
  hier: { classique: string | null; competence: string | null } | null;
}

/** Ce que le tirage sait d'un heros : son slug, et depuis quand il peut sortir. */
export interface CandidatMlbbdle {
  slug: string;
  /** Premier jour ou il peut etre tire ; null tant que sa sortie n'est pas datee. */
  depuis: string | null;
  /** A-t-il une competence illustree, pour le mode competence ? */
  competence: boolean;
}

export interface SecretsJour {
  jour: string;
  classique: string | null;
  competence: string | null;
}

export function numeroMlbbdle(jour: string): number {
  return Math.round((Date.parse(`${jour}T00:00:00Z`) - Date.parse(`${EPOQUE}T00:00:00Z`)) / 86_400_000) + 1;
}

const MOIS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Premier jour ou un heros peut etre le secret. Le wiki date la sortie au
 * jour (« 26 October 2021 »), au mois ou a l'annee pour les plus anciens ; un
 * heros annonce (« TBA ») n'est pas encore candidat.
 */
export function dateEligibilite(sortie: string | null): string | null {
  const m = /^(?:(\d{1,2}) )?(?:([A-Za-z]+) )?(\d{4})$/.exec((sortie ?? "").trim());
  if (!m) return null;
  const mois = m[2] ? MOIS.indexOf(m[2].toLowerCase()) : 0;
  if (mois < 0) return null;
  const date = new Date(Date.UTC(Number(m[3]), mois, m[1] ? Number(m[1]) : 1));
  return decalerJour(date.toISOString().slice(0, 10), DELAI_NOUVEAU);
}

/** Candidat au plus petit hachage : un nouveau venu ne deplace le choix que s'il gagne. */
function choisir(slugs: string[], graine: string): string | null {
  let meilleur: string | null = null;
  let valeur = Infinity;
  for (const s of slugs) {
    const v = hacher(`mlbbdle:${graine}|${s}`);
    if (v < valeur) {
      valeur = v;
      meilleur = s;
    }
  }
  return meilleur;
}

/** Sans les secrets recents ; tous, si la fenetre les ecartait jusqu'au dernier. */
function sansRecents(slugs: string[], recents: Set<string | null>): string[] {
  const libres = slugs.filter((s) => !recents.has(s));
  return libres.length ? libres : slugs;
}

/**
 * Secrets de chaque jour, de l'epoque jusqu'a `jusqua` compris. Le tirage
 * d'un jour depend des precedents (pas de repetition sur `FENETRE` jours) :
 * on les deroule tous, quelques millisecondes pour des annees.
 */
export function tirerSecrets(candidats: CandidatMlbbdle[], jusqua: string, debut = EPOQUE): SecretsJour[] {
  const tries = [...candidats].sort((a, b) => a.slug.localeCompare(b.slug));
  const sortie: SecretsJour[] = [];
  for (let jour = jusqua < debut ? jusqua : debut; jour <= jusqua; jour = decalerJour(jour, 1)) {
    const eligibles = tries.filter((c) => c.depuis !== null && c.depuis <= jour);
    const recents = sortie.slice(-FENETRE);
    const classique = choisir(
      sansRecents(eligibles.map((c) => c.slug), new Set(recents.map((s) => s.classique))),
      `classique:${jour}`,
    );
    // Jamais le meme heros dans les deux modes le meme jour.
    const pourCompetence = eligibles.filter((c) => c.competence && c.slug !== classique).map((c) => c.slug);
    const competence = choisir(
      sansRecents(pourCompetence, new Set(recents.map((s) => s.competence))),
      `competence:${jour}`,
    );
    sortie.push({ jour, classique, competence });
  }
  return sortie;
}

/** Un secret au hasard pour l'entrainement, hors des derniers joues quand c'est possible. */
export function tirerAuHasard(slugs: string[], recents: string[], alea: () => number = Math.random): string | null {
  const libres = sansRecents(slugs, new Set(recents));
  return libres.length ? libres[Math.min(libres.length - 1, Math.floor(alea() * libres.length))] : null;
}

// ─────────────────────────────────────────────────────────────
// Partage et statistiques
// ─────────────────────────────────────────────────────────────

const EMOJI: Record<Verdict, string> = { oui: "🟩", partiel: "🟧", non: "🟥", inconnu: "⬛" };

/** Une ligne de carres par essai : les couleurs, jamais les noms. */
export function ligneEmoji(essai: HerosMlbbdle, cible: HerosMlbbdle): string {
  const cases = comparer(essai, cible);
  return COLONNES.map((c) => EMOJI[essai.slug === cible.slug ? "oui" : cases[c].verdict]).join("");
}

/**
 * Grille du mode classique, du premier essai au dernier. Trop longue, elle
 * garde le debut et la ligne gagnante, separes par le nombre d'essais omis.
 */
export function grilleClassique(
  essais: string[],
  cible: HerosMlbbdle,
  parSlug: Map<string, HerosMlbbdle>,
  max = LIGNES_PARTAGE,
): string[] {
  const lignes = essais.flatMap((s) => {
    const h = parSlug.get(s);
    return h ? [ligneEmoji(h, cible)] : [];
  });
  if (lignes.length <= max) return lignes;
  return [...lignes.slice(0, max - 1), `⋯ +${lignes.length - max}`, lignes.at(-1)!];
}

/** Grille du mode competence : un carre rouge par erreur, le vert a la fin. */
export function grilleCompetence(essais: string[], reponse: string): string {
  const erreurs = essais.filter((e) => e !== reponse).length;
  const trouve = essais.includes(reponse) ? "🟩" : "";
  if (erreurs >= CARRES_MAX) return `🟥×${erreurs}${trouve}`;
  return `${"🟥".repeat(erreurs)}${trouve}`;
}

export function textePartage(o: { titre: string; lignes: string[]; url: string }): string {
  return [o.titre, ...o.lignes, o.url].join("\n");
}

/** Enregistre un jour gagne, range dans la case de son nombre d'essais. */
export function enregistrerVictoire(stats: StatsQuiz, jour: string, essais: number): StatsQuiz {
  return enregistrerPartie(stats, jour, Math.min(Math.max(1, essais), SEAU_MAX));
}

/** Essais moyens par jour gagne ; la derniere case compte pour sa borne. */
export function moyenneEssais(stats: StatsQuiz): number {
  const total = stats.distribution.reduce((n, x) => n + x, 0);
  return total ? stats.distribution.reduce((s, n, i) => s + n * i, 0) / total : 0;
}
