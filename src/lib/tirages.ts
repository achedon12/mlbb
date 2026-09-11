/**
 * Calculateur de tirages (evenements a tirage au sort de la boutique).
 *
 * Le joueur saisit les parametres publies par le jeu : prix d'un tirage (et
 * d'un tirage x10), probabilite du lot voulu a chaque tirage, et eventuelle
 * garantie au N-ieme tirage. On suppose les tirages independants et de
 * meme probabilite `p` jusqu'a la garantie, ce que decrivent les regles des
 * evenements.
 *
 * Nombre de tirages T jusqu'au premier lot : P(T > n) = (1 − p)^n tant que
 * n < N, puis 0. D'ou E[T] = (1 − (1 − p)^N) / p, et 1 / p sans garantie.
 * Les puissances passent par `log1p`/`expm1` : pour p = 0,01 %, calculer
 * 1 − 0,9999^n a la main perdrait la moitie des chiffres significatifs.
 * Les diamants, eux, restent des entiers exacts.
 */

/** Bornes de saisie : au-dela, la valeur est une faute de frappe plus qu'un evenement reel. */
export const BORNES = {
  cout: 100_000,
  coutDix: 1_000_000,
  garantie: 100_000,
  budget: 1_000_000_000,
  tirages: 1_000_000,
  /** Probabilite minimale en pourcent : 0,0001 %, soit un sur un million. */
  probaMin: 0.0001,
} as const;

/** Tolerance des comparaisons de probabilite, pour qu'un 50 % calcule a 0,4999999999 compte comme 50 %. */
const EPSILON = 1e-12;

export interface Tirage {
  /** Prix d'un tirage, en diamants. */
  cout: number;
  /** Prix d'un tirage x10 ; `null` s'il n'existe pas. */
  coutDix: number | null;
  /** Probabilite du lot voulu a chaque tirage, en pourcent. */
  probabilite: number;
  /** Tirage auquel le lot est garanti ; `null` sans garantie. */
  garantie: number | null;
}

/**
 * Lit un nombre entier de diamants ou de tirages. Les separateurs de milliers
 * de toutes les langues du site (espace, point, virgule, apostrophe) sont
 * ignores : « 3,000 », « 3.000 » et « 3 000 » valent 3000.
 */
export function lireEntier(saisie: string): number | null {
  const texte = saisie.replace(/[\s\u00a0\u202f.,'’]/g, "");
  if (!/^\d+$/.test(texte)) return null;
  const valeur = Number(texte);
  return Number.isSafeInteger(valeur) ? valeur : null;
}

/** Lit un pourcentage : virgule ou point decimal, signe % tolere. */
export function lirePourcent(saisie: string): number | null {
  const texte = saisie.trim().replace(/[\s\u00a0\u202f%]/g, "").replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(texte)) return null;
  const valeur = Number(texte);
  return Number.isFinite(valeur) ? valeur : null;
}

/** Champ fautif d'une saisie, pour que l'interface le signale. */
export type ChampTirage = "cout" | "coutDix" | "probabilite" | "garantie" | "budget" | "tirages";

const entierDans = (v: number | null, min: number, max: number) =>
  v !== null && Number.isInteger(v) && v >= min && v <= max;

/** Champs invalides d'un evenement ; tableau vide si tout est exploitable. */
export function erreursTirage(t: Tirage): ChampTirage[] {
  const erreurs: ChampTirage[] = [];
  if (!entierDans(t.cout, 1, BORNES.cout)) erreurs.push("cout");
  if (t.coutDix !== null && !entierDans(t.coutDix, 1, BORNES.coutDix)) erreurs.push("coutDix");
  if (!(Number.isFinite(t.probabilite) && t.probabilite >= BORNES.probaMin && t.probabilite <= 100)) {
    erreurs.push("probabilite");
  }
  if (t.garantie !== null && !entierDans(t.garantie, 1, BORNES.garantie)) erreurs.push("garantie");
  return erreurs;
}

/** Le tirage x10 ne sert que s'il revient moins cher que dix tirages simples. */
export function dixAvantageux(t: Tirage): boolean {
  return t.coutDix !== null && t.coutDix < 10 * t.cout;
}

/** ln(1 − p), precis meme pour p minuscule ; −∞ quand p = 1. */
const logEchec = (t: Tirage) => Math.log1p(-t.probabilite / 100);

/** Probabilite d'avoir obtenu le lot en `n` tirages au plus (entre 0 et 1). */
export function probabiliteEn(n: number, t: Tirage): number {
  if (n <= 0) return 0;
  if (t.garantie !== null && n >= t.garantie) return 1;
  if (t.probabilite >= 100) return 1;
  return -Math.expm1(n * logEchec(t));
}

/** Nombre moyen de tirages pour obtenir le lot, garantie comprise. */
export function tiragesEsperes(t: Tirage): number {
  const p = t.probabilite / 100;
  if (p >= 1) return 1;
  if (t.garantie === null) return 1 / p;
  return -Math.expm1(t.garantie * logEchec(t)) / p;
}

/**
 * Nombre moyen de tirages x10 achetes quand on ne tire que par dix et qu'on
 * s'arrete au premier lot : E[⌈T/10⌉] = Σ P(T > 10j), une serie geometrique
 * de raison (1 − p)^10, coupee a la garantie.
 */
export function lotsDeDixEsperes(t: Tirage): number {
  if (t.probabilite >= 100) return 1;
  const raison = 10 * logEchec(t);
  const unMoinsRaison = -Math.expm1(raison);
  if (t.garantie === null) return 1 / unMoinsRaison;
  const termes = Math.ceil(t.garantie / 10);
  return -Math.expm1(termes * raison) / unMoinsRaison;
}

/**
 * Diamants pour faire au moins `n` tirages, au meilleur prix : des tirages
 * x10 et le reste a l'unite, ou un x10 de plus quand il coute moins que le
 * reste a l'unite (9 tirages a 50 contre un x10 a 450).
 */
export function diamantsPour(n: number, t: Tirage): number {
  if (n <= 0) return 0;
  if (!dixAvantageux(t)) return n * t.cout;
  const dix = t.coutDix!;
  const complets = Math.floor(n / 10);
  return Math.min(complets * dix + (n % 10) * t.cout, Math.ceil(n / 10) * dix);
}

/**
 * Tirages permis par un budget : autant de x10 que possible, puis a l'unite.
 * Renoncer a un x10 pour des tirages simples n'en donne jamais plus, puisque
 * dix tirages simples coutent au moins un x10.
 */
export function tiragesAvecBudget(budget: number, t: Tirage): number {
  if (budget <= 0) return 0;
  if (!dixAvantageux(t)) return Math.floor(budget / t.cout);
  const dix = t.coutDix!;
  return 10 * Math.floor(budget / dix) + Math.floor((budget % dix) / t.cout);
}

/** Plus petit nombre de tirages qui donne au moins `cible` (entre 0 et 1) de chances d'avoir le lot. */
export function tiragesPour(cible: number, t: Tirage): number {
  if (cible <= 0) return 0;
  if (t.probabilite >= 100) return 1;
  const atteint = (n: number) => probabiliteEn(n, t) >= cible - EPSILON;
  // Estimation par les logarithmes, puis ajustement d'un cran pour les arrondis.
  let n = cible >= 1 ? Infinity : Math.max(1, Math.ceil(Math.log1p(-cible) / logEchec(t)));
  if (t.garantie !== null) n = Math.min(n, t.garantie);
  if (!Number.isFinite(n)) return Infinity;
  while (n > 1 && atteint(n - 1)) n--;
  while (!atteint(n)) n++;
  return n;
}

/** Paliers de chances affiches : une chance sur deux, neuf sur dix, quasi-certitude. */
export const PALIERS = [0.5, 0.9, 0.99] as const;

export interface Palier {
  cible: number;
  tirages: number;
  diamants: number;
}

export interface Analyse {
  /** Tirages effectues : ceux du budget, ou ceux saisis. */
  tirages: number;
  /** Diamants depenses pour ces tirages (au plus le budget). */
  diamants: number;
  /** Chances d'avoir le lot a l'issue de ces tirages (entre 0 et 1). */
  probabilite: number;
  tiragesEsperes: number;
  /** Diamants moyens en tirant un par un. */
  diamantsEsperesUnParUn: number;
  /** Diamants moyens en tirant par dix ; `null` sans tirage x10 avantageux. */
  diamantsEsperesParDix: number | null;
  paliers: Palier[];
}

export type Objectif = { type: "budget"; diamants: number } | { type: "tirages"; nombre: number };

export type Resultat = { etat: "invalide"; erreurs: ChampTirage[] } | ({ etat: "ok" } & Analyse);

/** Tout ce qu'affiche le calculateur, pour un evenement et un budget (ou un nombre de tirages). */
export function analyser(t: Tirage, objectif: Objectif): Resultat {
  const erreurs = erreursTirage(t);
  if (objectif.type === "budget" && !entierDans(objectif.diamants, 0, BORNES.budget)) erreurs.push("budget");
  if (objectif.type === "tirages" && !entierDans(objectif.nombre, 1, BORNES.tirages)) erreurs.push("tirages");
  if (erreurs.length) return { etat: "invalide", erreurs };

  const tirages = objectif.type === "budget" ? tiragesAvecBudget(objectif.diamants, t) : objectif.nombre;
  const esperes = tiragesEsperes(t);
  return {
    etat: "ok",
    tirages,
    diamants: diamantsPour(tirages, t),
    probabilite: probabiliteEn(tirages, t),
    tiragesEsperes: esperes,
    diamantsEsperesUnParUn: esperes * t.cout,
    diamantsEsperesParDix: dixAvantageux(t) ? lotsDeDixEsperes(t) * t.coutDix! : null,
    paliers: PALIERS.map((cible) => {
      const n = tiragesPour(cible, t);
      return { cible, tirages: n, diamants: diamantsPour(n, t) };
    }),
  };
}

/**
 * Evenements dont le wiki publie les chances, repris tels quels avec leur
 * page et sa date de derniere modification : les regles changent, le joueur
 * doit pouvoir verifier. Le lot est « un skin (ou un heros) du lot », pas un
 * skin precis : le wiki ne donne pas la chance de chacun. Le nom est celui de
 * l'evenement dans le jeu, en anglais comme sur le wiki.
 */
export interface Prereglage {
  cle: "aurora" | "nouveautesSkin" | "nouveautesHeros";
  nom: string;
  tirage: Tirage;
  source: string;
  /** Date ISO de la derniere modification de la page citee. */
  releve: string;
}

export const PREREGLAGES: readonly Prereglage[] = [
  {
    // 10 points de chance par tirage, 90 au plus : le 10e tirage est garanti.
    cle: "aurora",
    nom: "Aurora Summon",
    tirage: { cout: 50, coutDix: 450, probabilite: 1, garantie: 10 },
    source: "https://mobilelegends.fandom.com/wiki/Aurora_Summon",
    releve: "2025-04-11",
  },
  {
    cle: "nouveautesSkin",
    nom: "New Arrival Shop",
    tirage: { cout: 10, coutDix: 90, probabilite: 1.38, garantie: 160 },
    source: "https://mobilelegends.fandom.com/wiki/New_Arrival_Shop",
    releve: "2025-07-04",
  },
  {
    cle: "nouveautesHeros",
    nom: "New Arrival Shop",
    tirage: { cout: 10, coutDix: 90, probabilite: 1, garantie: 160 },
    source: "https://mobilelegends.fandom.com/wiki/New_Arrival_Shop",
    releve: "2025-07-04",
  },
];

/** Page du wiki qui etablit l'equivalence un Cristal d'Aurore = un diamant dans les tirages. */
export const SOURCE_CRISTAL = "https://mobilelegends.fandom.com/wiki/Crystal_of_Aurora";

/**
 * Points de la courbe des chances cumulees, de 0 a `jusqua` tirages. Au plus
 * `points` + 1 points, en gardant le saut de la garantie : sans le point juste
 * avant, la courbe monterait en pente au lieu d'une marche.
 */
export function courbe(t: Tirage, jusqua: number, points = 120): { n: number; p: number }[] {
  const max = Math.max(1, Math.round(jusqua));
  const pas = Math.max(1, max / points);
  const ns = new Set<number>([0, max]);
  for (let x = 0; x <= max; x += pas) ns.add(Math.round(x));
  if (t.garantie !== null && t.garantie <= max) {
    ns.add(t.garantie - 1);
    ns.add(t.garantie);
  }
  return [...ns].sort((a, b) => a - b).map((n) => ({ n, p: probabiliteEn(n, t) }));
}
