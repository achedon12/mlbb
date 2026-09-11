import type { RangMesure } from "./rangs-mesure";
import type { Lane, Palier, Role } from "./types";
import { cleRecherche } from "./utils";

/**
 * Tableau des statistiques : tri, filtres, etat d'URL et mini-courbes, en
 * calculs purs. La page serveur construit les lignes et rend le tableau dans
 * l'ordre par defaut ; le composant client les reordonne et les filtre avec ce
 * seul module, sans embarquer les donnees du jeu.
 */

export const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];
export const LANES: Lane[] = ["Or", "Experience", "Milieu", "Jungle", "Roam"];

/** Adresse du tableau d'un rang : « tous rangs » garde l'adresse principale. */
export const cheminStatistiques = (rang: RangMesure) => (rang === "all" ? "/statistics" : `/statistics/${rang}`);

/** Icone d'un heros, rangee par la synchronisation sous un nom fixe : inutile de l'envoyer ligne par ligne. */
export const iconeHeros = (slug: string) => `/visuels/heros/${slug}/icone.png`;

/**
 * Une ligne du tableau, telle qu'elle part au navigateur. Il y en a 132 : rien
 * de ce qui se deduit (icone, trace de la courbe), et aucun champ vide.
 */
export interface LigneStat {
  slug: string;
  nom: string;
  roles: Role[];
  lanes: Lane[];
  palier: Palier;
  /** Score de la tier list : departage deux heros d'un meme palier. */
  score: number;
  victoire: number;
  ban: number;
  selection: number;
  /** Ecart du taux de victoire sur une semaine, en points, et jours compares ; absents sans mesure fiable. */
  ecart?: number;
  jours?: number;
  /** Trop peu joue pour que ses taux soient stables. */
  faible?: true;
  /** Mini-courbe sur trente jours (voir `echelonnerCourbe`), avec la premiere et la derniere mesure. */
  courbe?: string;
  debut?: number;
  fin?: number;
}

/**
 * Ligne telle qu'elle voyage vers le navigateur, en tuple : les noms de champs
 * repetes sur 132 lignes pesaient pres de 20 Ko. Roles et positions y sont
 * des chiffres (`coderListe`) ; une valeur absente vaut null.
 */
export type LigneCompacte = [
  slug: string,
  nom: string,
  roles: number,
  lanes: number,
  palier: Palier,
  score: number,
  victoire: number,
  ban: number,
  selection: number,
  ecart: number | null,
  jours: number | null,
  faible: 0 | 1,
  courbe: string | null,
  debut: number | null,
  fin: number | null,
];

/**
 * Liste courte (deux roles, trois positions au plus) codee en un nombre, un
 * chiffre par element (sa place dans `reference`, plus un) : l'ordre est
 * garde, le role principal reste en tete.
 */
export function coderListe<T>(valeurs: readonly T[], reference: readonly T[]): number {
  return Number(valeurs.map((v) => reference.indexOf(v) + 1).filter((i) => i > 0).join("") || 0);
}

export function decoderListe<T>(code: number, reference: readonly T[]): T[] {
  return [...String(code)].flatMap((c) => (reference[Number(c) - 1] !== undefined ? [reference[Number(c) - 1]!] : []));
}

export function coderLigne(l: LigneStat): LigneCompacte {
  return [
    l.slug,
    l.nom,
    coderListe(l.roles, ROLES),
    coderListe(l.lanes, LANES),
    l.palier,
    l.score,
    l.victoire,
    l.ban,
    l.selection,
    l.ecart ?? null,
    l.jours ?? null,
    l.faible ? 1 : 0,
    l.courbe ?? null,
    l.debut ?? null,
    l.fin ?? null,
  ];
}

export function decoderLigne([
  slug,
  nom,
  roles,
  lanes,
  palier,
  score,
  victoire,
  ban,
  selection,
  ecart,
  jours,
  faible,
  courbe,
  debut,
  fin,
]: LigneCompacte): LigneStat {
  return {
    slug,
    nom,
    roles: decoderListe(roles, ROLES),
    lanes: decoderListe(lanes, LANES),
    palier,
    score,
    victoire,
    ban,
    selection,
    ...(ecart !== null ? { ecart } : {}),
    ...(jours !== null ? { jours } : {}),
    ...(faible ? { faible: true as const } : {}),
    ...(courbe !== null ? { courbe } : {}),
    ...(debut !== null ? { debut } : {}),
    ...(fin !== null ? { fin } : {}),
  };
}

export const COLONNES_TRI = ["nom", "palier", "victoire", "tendance", "ban", "selection"] as const;
export type ColonneTri = (typeof COLONNES_TRI)[number];
export type Ordre = "asc" | "desc";

export interface EtatTableau {
  tri: ColonneTri;
  ordre: Ordre;
  role: Role | null;
  lane: Lane | null;
  recherche: string;
}

/** Ordre rendu par le serveur : le taux de victoire, du plus haut au plus bas. */
export const ETAT_DEFAUT: EtatTableau = { tri: "victoire", ordre: "desc", role: null, lane: null, recherche: "" };

/** Sens du premier clic sur une colonne : alphabetique pour le nom, du plus fort au plus faible ailleurs. */
export const ordreInitial = (c: ColonneTri): Ordre => (c === "nom" ? "asc" : "desc");

const RANG_PALIER: Record<Palier, number> = { "S+": 5, S: 4, A: 3, B: 2, C: 1 };

function valeur(l: LigneStat, c: Exclude<ColonneTri, "nom">): number | null {
  switch (c) {
    case "palier":
      return RANG_PALIER[l.palier] * 1000 + l.score;
    case "tendance":
      return l.ecart ?? null;
    default:
      return l[c];
  }
}

const comparerNoms = (a: LigneStat, b: LigneStat) => a.nom.localeCompare(b.nom, "en");

/**
 * Lignes triees sur une colonne. Un heros sans mesure (ecart de la semaine)
 * passe en fin de liste dans les deux sens ; a egalite, l'ordre alphabetique
 * departage : le resultat ne depend pas de l'ordre d'entree.
 */
export function trierLignes(lignes: readonly LigneStat[], tri: ColonneTri, ordre: Ordre): LigneStat[] {
  const sens = ordre === "asc" ? 1 : -1;
  return [...lignes].sort((a, b) => {
    if (tri === "nom") return sens * comparerNoms(a, b);
    const va = valeur(a, tri);
    const vb = valeur(b, tri);
    if (va === null || vb === null) return va === vb ? comparerNoms(a, b) : va === null ? 1 : -1;
    return sens * (va - vb) || comparerNoms(a, b);
  });
}

/** Lignes qui passent les filtres : role, position, et recherche sans casse ni accents. */
export function filtrerLignes(
  lignes: readonly LigneStat[],
  f: Pick<EtatTableau, "role" | "lane" | "recherche">,
): LigneStat[] {
  const terme = cleRecherche(f.recherche.trim());
  return lignes.filter(
    (l) =>
      (!f.role || l.roles.includes(f.role)) &&
      (!f.lane || l.lanes.includes(f.lane)) &&
      (!terme || cleRecherche(l.nom).includes(terme)),
  );
}

/** Etat lu dans l'URL (`?tri=ban&ordre=asc&role=Mage&lane=Jungle&q=…`) ; une valeur inconnue garde le defaut. */
export function lireEtat(params: URLSearchParams): EtatTableau {
  const tri = COLONNES_TRI.find((c) => c === params.get("tri")) ?? ETAT_DEFAUT.tri;
  const ordre = params.get("ordre");
  return {
    tri,
    ordre: ordre === "asc" || ordre === "desc" ? ordre : ordreInitial(tri),
    role: ROLES.find((r) => r === params.get("role")) ?? null,
    lane: LANES.find((l) => l === params.get("lane")) ?? null,
    recherche: params.get("q") ?? "",
  };
}

/**
 * Report de l'etat dans des parametres d'URL existants, sans les valeurs par
 * defaut : l'adresse du tableau non filtre reste nue, donc canonique.
 */
export function ecrireEtat(etat: EtatTableau, base = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(base);
  const valeurs: [string, string | null][] = [
    ["tri", etat.tri === ETAT_DEFAUT.tri ? null : etat.tri],
    ["ordre", etat.ordre === ordreInitial(etat.tri) ? null : etat.ordre],
    ["role", etat.role],
    ["lane", etat.lane],
    ["q", etat.recherche.trim() || null],
  ];
  for (const [cle, v] of valeurs) {
    if (v) params.set(cle, v);
    else params.delete(cle);
  }
  return params;
}

// ── Mini-courbe ────────────────────────────────────────────────────

/** Points de la mini-courbe : un tous les deux jours sur trente. */
export const POINTS_COURBE = 15;
/** Hauteur du dessin, en unites ; en largeur, une unite separe deux points. */
export const HAUTEUR_COURBE = 20;

/**
 * Ordonnees de la mini-courbe, en texte compact : « 9 9 10 - 11 ». Les jours
 * sont regroupes en `points` tranches (moyenne des jours mesures). L'echelle
 * est propre a la serie, mais jamais plus serree que `ecartMin` points : un
 * taux stable reste plat au lieu de grossir l'arrondi du jeu. Une tranche
 * sans mesure vaut « - » et coupera le trait. Moins de deux tranches
 * mesurees : pas de courbe.
 */
export function echelonnerCourbe(
  valeurs: (number | null)[],
  points = POINTS_COURBE,
  hauteur = HAUTEUR_COURBE,
  ecartMin = 2,
): string | null {
  const n = Math.min(points, valeurs.length);
  if (n < 2) return null;
  const tranches = Array.from({ length: n }, (_, k) => {
    const jours = valeurs.slice(Math.floor((k * valeurs.length) / n), Math.floor(((k + 1) * valeurs.length) / n));
    const mesures = jours.filter((v): v is number => typeof v === "number");
    return mesures.length ? mesures.reduce((a, b) => a + b, 0) / mesures.length : null;
  });
  const mesurees = tranches.filter((v): v is number => v !== null);
  if (mesurees.length < 2) return null;
  let min = Math.min(...mesurees);
  let max = Math.max(...mesurees);
  if (max - min < ecartMin) {
    const milieu = (min + max) / 2;
    min = milieu - ecartMin / 2;
    max = milieu + ecartMin / 2;
  }
  // Une unite de marge garde l'epaisseur du trait dans le cadre.
  return tranches
    .map((v) => (v === null ? "-" : String(Math.round(1 + (hauteur - 2) * (1 - (v - min) / (max - min))))))
    .join(" ");
}

/** Trace SVG d'une mini-courbe : un point par unite de largeur, le trait coupe sur « - ». */
export function cheminCourbe(echelle: string): string {
  let trace = "";
  let enCours = false;
  echelle.split(" ").forEach((y, x) => {
    if (y === "-") {
      enCours = false;
      return;
    }
    // Apres un deplacement, les couples suivants sont des segments : pas besoin de « L ».
    trace += `${enCours ? " " : "M"}${x} ${y}`;
    enCours = true;
  });
  return trace;
}

/** Taux au format de la langue, a une decimale : « 52,4 % », « 52.4% ». */
export function formateurTaux(langue: string): (v: number) => string {
  const f = new Intl.NumberFormat(langue, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (v) => f.format(v / 100);
}
