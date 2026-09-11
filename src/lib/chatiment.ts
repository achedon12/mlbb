/**
 * Moteur de l'entraineur de Chatiment (Retribution).
 *
 * Module pur : tirage des coups, verdict d'une frappe, points, bilan d'une
 * serie et records. Le composant client n'y ajoute que l'horloge et l'ecran ;
 * les tests rejouent tout avec un generateur a graine.
 *
 * Deux sortes de valeurs, a ne pas confondre :
 *
 * - **sourcees** — degats du Chatiment et PV des monstres, tires du wiki Fandom
 *   (consulte le 11 septembre 2026) ;
 * - **d'entrainement** — rythme des coups, degats de l'equipe, reaction du
 *   jungler adverse, niveaux conseilles : reglees pour que l'exercice ressemble
 *   a un vrai combat, sans pretendre reproduire le jeu.
 */

/**
 * Degats du Chatiment : 520 (+80 x niveau du heros) degats bruts, de 600 au
 * niveau 1 a 1720 au niveau 15. Source : modele « Spell data Retribution » du
 * wiki Fandom, https://mobilelegends.fandom.com/wiki/Retribution
 */
export const CHATIMENT_BASE = 520;
export const CHATIMENT_PAR_NIVEAU = 80;
export const NIVEAU_MIN = 1;
export const NIVEAU_MAX = 15;
/** Recharge du Chatiment, en secondes (meme source) : un Chatiment rate ne revient pas a temps. */
export const RECHARGE_CHATIMENT_S = 35;

export const SOURCE_CHATIMENT = "https://mobilelegends.fandom.com/wiki/Retribution";

export function degatsChatiment(niveau: number): number {
  const n = Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, Math.round(niveau)));
  return CHATIMENT_BASE + CHATIMENT_PAR_NIVEAU * n;
}

export type CleObjectif = "tortue" | "seigneur" | "seigneur-12" | "buff-violet" | "buff-orange";

export interface Objectif {
  /**
   * PV du monstre (source) : colonnes « Initial ATTR » et « ATTR after 12 MIN »
   * de la fiche du wiki Fandom.
   */
  pv: number;
  /**
   * PV par segment de la barre de vie (source) : 2 000 pour la Tortue et le
   * Seigneur, 1 000 pour les autres creatures (notes de patch citees par le
   * wiki, pages « Lord » et « Turtle »).
   */
  segment: number;
  /** Niveau du jungler propose par defaut — valeur d'entrainement. */
  niveauConseille: number;
  /** Moment du combat, pour le libelle : a l'apparition ou apres 12 minutes. */
  moment: "apparition" | "12min";
  source: string;
}

export const OBJECTIFS: Record<CleObjectif, Objectif> = {
  tortue: {
    pv: 10_367,
    segment: 2000,
    niveauConseille: 4,
    moment: "apparition",
    source: "https://mobilelegends.fandom.com/wiki/Turtle",
  },
  seigneur: {
    pv: 31_743,
    segment: 2000,
    niveauConseille: 9,
    moment: "apparition",
    source: "https://mobilelegends.fandom.com/wiki/Lord",
  },
  "seigneur-12": {
    pv: 42_953,
    segment: 2000,
    niveauConseille: 12,
    moment: "12min",
    source: "https://mobilelegends.fandom.com/wiki/Lord",
  },
  "buff-violet": {
    pv: 6622,
    segment: 1000,
    niveauConseille: 12,
    moment: "12min",
    source: "https://mobilelegends.fandom.com/wiki/Thunder_Fenrir",
  },
  "buff-orange": {
    pv: 8111,
    segment: 1000,
    niveauConseille: 12,
    moment: "12min",
    source: "https://mobilelegends.fandom.com/wiki/Molten_Fiend",
  },
};

export const CLES_OBJECTIFS = Object.keys(OBJECTIFS) as CleObjectif[];

export type Difficulte = "facile" | "normal" | "difficile" | "pro";
export const DIFFICULTES_ORDRE: Difficulte[] = ["facile", "normal", "difficile", "pro"];

/** Reglage d'une difficulte — valeurs d'entrainement, toutes. */
export interface Reglage {
  /**
   * Temps que met l'equipe, a son rythme moyen, pour faire passer le monstre
   * du seuil du Chatiment a zero : la fenetre de tir. Les degats par seconde
   * s'en deduisent (seuil / fenetre).
   */
  fenetreMs: number;
  /** Intervalle entre deux coups, en ms : plus court, plus dur a suivre. */
  intervalle: [number, number];
  /** Ecart relatif des degats d'un coup autour de la moyenne. */
  bruit: number;
  /** Probabilite qu'un coup soit une competence alliee (x2 a x3). */
  pCompetence: number;
  /** Probabilite qu'un coup s'accompagne d'une rafale de l'equipe adverse. */
  pRafale: number;
  /** Rafale adverse, en fraction du seuil du Chatiment. */
  rafale: [number, number];
  /** Reaction du jungler adverse une fois le seuil franchi, en ms. */
  reactionAdverse: [number, number];
  /** Aides a l'ecran : repere du seuil sur la barre, PV chiffres. */
  repere: boolean;
  pvChiffres: boolean;
}

export const REGLAGES: Record<Difficulte, Reglage> = {
  facile: {
    fenetreMs: 1800,
    intervalle: [380, 520],
    bruit: 0.15,
    pCompetence: 0.05,
    pRafale: 0,
    rafale: [0, 0],
    reactionAdverse: [1200, 1500],
    repere: true,
    pvChiffres: true,
  },
  normal: {
    fenetreMs: 1150,
    intervalle: [240, 400],
    bruit: 0.3,
    pCompetence: 0.1,
    pRafale: 0.06,
    rafale: [0.25, 0.45],
    reactionAdverse: [650, 900],
    repere: true,
    pvChiffres: true,
  },
  difficile: {
    fenetreMs: 800,
    intervalle: [160, 320],
    bruit: 0.45,
    pCompetence: 0.14,
    pRafale: 0.12,
    rafale: [0.3, 0.6],
    reactionAdverse: [430, 600],
    repere: false,
    pvChiffres: false,
  },
  pro: {
    fenetreMs: 560,
    intervalle: [110, 240],
    bruit: 0.55,
    pCompetence: 0.18,
    pRafale: 0.18,
    rafale: [0.35, 0.7],
    reactionAdverse: [300, 420],
    repere: false,
    pvChiffres: false,
  },
};

/** Duree du combat avant le seuil, en secondes au rythme moyen : l'attente, puis la tension. */
const AVANT_SEUIL_S: [number, number] = [2.5, 5.5];
/** Un coup qui franchit le seuil laisse au moins cette part du seuil : jamais de manche perdue d'avance. */
const RESTE_MIN_AU_SEUIL = 0.3;

export const MANCHES_PAR_SERIE = 5;

/** Generateur pseudo-aleatoire a graine (mulberry32) : une manche se rejoue a l'identique. */
export function creerAlea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const entre = (alea: () => number, [min, max]: [number, number]) => min + (max - min) * alea();

export interface Manche {
  pvMax: number;
  seuil: number;
  pvDepart: number;
  /** Degats par seconde de l'equipe, en moyenne. */
  dps: number;
  /** Reaction du jungler adverse pour cette manche, en ms. */
  reactionAdverse: number;
}

export function preparerManche(objectif: CleObjectif, difficulte: Difficulte, niveau: number, alea: () => number): Manche {
  const o = OBJECTIFS[objectif];
  const r = REGLAGES[difficulte];
  const seuil = degatsChatiment(niveau);
  const dps = seuil / (r.fenetreMs / 1000);
  const pvDepart = Math.round(Math.min(o.pv, seuil + dps * entre(alea, AVANT_SEUIL_S)));
  return { pvMax: o.pv, seuil, pvDepart, dps, reactionAdverse: Math.round(entre(alea, r.reactionAdverse)) };
}

export interface Coup {
  /** Attente avant ce coup, en ms. */
  intervalle: number;
  degats: number;
  source: "allie" | "competence" | "adverse";
  pvApres: number;
}

/**
 * Coup suivant. Les degats suivent le rythme moyen de l'equipe, avec du bruit,
 * des competences alliees et des rafales adverses. Deux garde-fous : un coup
 * ne fait jamais passer le monstre d'au-dessus du seuil a zero, et celui qui
 * franchit le seuil laisse au moins 30 % du seuil — il reste toujours une
 * fenetre de tir.
 */
export function coupSuivant(pv: number, manche: Manche, difficulte: Difficulte, alea: () => number): Coup {
  const r = REGLAGES[difficulte];
  const intervalle = Math.round(entre(alea, r.intervalle));
  let degats = manche.dps * (intervalle / 1000) * (1 + r.bruit * (alea() * 2 - 1));
  let source: Coup["source"] = "allie";
  if (alea() < r.pCompetence) {
    degats *= entre(alea, [2, 3]);
    source = "competence";
  }
  if (alea() < r.pRafale) {
    degats += manche.seuil * entre(alea, r.rafale);
    source = "adverse";
  }
  degats = Math.max(1, Math.round(degats));
  let pvApres = pv - degats;
  if (pv > manche.seuil && pvApres < manche.seuil * RESTE_MIN_AU_SEUIL) {
    pvApres = Math.round(manche.seuil * entre(alea, [RESTE_MIN_AU_SEUIL, 0.95]));
    degats = pv - pvApres;
  }
  return { intervalle, degats, source, pvApres: Math.max(0, pvApres) };
}

export type Issue = "securise" | "tropTot" | "vole" | "rate";

export interface Resultat {
  issue: Issue;
  points: number;
  /** Part de la fenetre gardee : PV a la frappe / PV au franchissement du seuil. */
  precision: number | null;
  /** Temps entre le franchissement du seuil et la frappe, en ms. */
  reaction: number | null;
  /** PV restants apres un Chatiment trop tot. */
  reste: number | null;
  /** Reaction du jungler adverse, quand il a vole le monstre. */
  reactionAdverse: number | null;
}

/**
 * Points d'une frappe reussie, sur 1 000 : 700 pour la precision (la part des
 * PV du seuil encore la au moment de frapper), 300 pour la vitesse (pleine
 * sous 150 ms, nulle au-dela d'une seconde).
 */
export const POIDS_PRECISION = 700;
export const POIDS_VITESSE = 300;
export const REACTION_PLEINE_MS = 150;
export const REACTION_NULLE_MS = 1000;

export function pointsFrappe(precision: number, reaction: number): number {
  const p = Math.min(1, Math.max(0, precision));
  const v = Math.min(1, Math.max(0, (REACTION_NULLE_MS - reaction) / (REACTION_NULLE_MS - REACTION_PLEINE_MS)));
  return Math.round(POIDS_PRECISION * p + POIDS_VITESSE * v);
}

/** Verdict d'une frappe du joueur. */
export function evaluerFrappe(o: {
  pv: number;
  seuil: number;
  /** PV juste apres le coup qui a franchi le seuil ; null s'il ne l'est pas encore. */
  pvFranchissement: number | null;
  reaction: number | null;
}): Resultat {
  if (o.pv > o.seuil || o.pvFranchissement === null || o.reaction === null) {
    return { issue: "tropTot", points: 0, precision: null, reaction: null, reste: o.pv - o.seuil, reactionAdverse: null };
  }
  const precision = o.pvFranchissement > 0 ? o.pv / o.pvFranchissement : 1;
  return {
    issue: "securise",
    points: pointsFrappe(precision, o.reaction),
    precision,
    reaction: Math.max(0, Math.round(o.reaction)),
    reste: null,
    reactionAdverse: null,
  };
}

export function resultatVole(reactionAdverse: number): Resultat {
  return { issue: "vole", points: 0, precision: null, reaction: null, reste: null, reactionAdverse };
}

export function resultatRate(): Resultat {
  return { issue: "rate", points: 0, precision: null, reaction: null, reste: null, reactionAdverse: null };
}

export interface Bilan {
  total: number;
  securises: number;
  manches: number;
  meilleureReaction: number | null;
  precisionMoyenne: number | null;
}

export function bilanSerie(resultats: Resultat[]): Bilan {
  const reussis = resultats.filter((r) => r.issue === "securise");
  const reactions = reussis.map((r) => r.reaction!).filter((r) => r !== null);
  return {
    total: resultats.reduce((s, r) => s + r.points, 0),
    securises: reussis.length,
    manches: resultats.length,
    meilleureReaction: reactions.length ? Math.min(...reactions) : null,
    precisionMoyenne: reussis.length ? reussis.reduce((s, r) => s + r.precision!, 0) / reussis.length : null,
  };
}

/** Records gardes dans le navigateur. */
export interface Records {
  /** Meilleur total de serie, par objectif et difficulte (`seigneur:difficile`). */
  series: Record<string, { total: number; date: string }>;
  /** Frappes reussies d'affilee, en cours et au mieux. */
  enCours: number;
  meilleureSuite: number;
}

export const RECORDS_VIDES: Records = { series: {}, enCours: 0, meilleureSuite: 0 };

export const cleRecord = (objectif: CleObjectif, difficulte: Difficulte) => `${objectif}:${difficulte}`;

/** Suite de frappes reussies apres une manche : +1, ou retour a zero. */
export function apresManche(records: Records, issue: Issue): Records {
  const enCours = issue === "securise" ? records.enCours + 1 : 0;
  return { ...records, enCours, meilleureSuite: Math.max(records.meilleureSuite, enCours) };
}

/** Records apres une serie complete, et si elle bat le precedent. */
export function apresSerie(
  records: Records,
  cle: string,
  bilan: Bilan,
  date: string,
): { records: Records; nouveau: boolean } {
  const avant = records.series[cle];
  if (bilan.total <= 0 || (avant && avant.total >= bilan.total)) return { records, nouveau: false };
  return { records: { ...records, series: { ...records.series, [cle]: { total: bilan.total, date } } }, nouveau: true };
}

/** Relit des records stockes, en ignorant tout ce qui n'a pas la bonne forme. */
export function lireRecords(brut: string | null): Records {
  if (!brut) return RECORDS_VIDES;
  try {
    const d = JSON.parse(brut) as Partial<Records>;
    const series: Records["series"] = {};
    for (const [cle, v] of Object.entries(d.series ?? {})) {
      if (v && typeof v.total === "number" && typeof v.date === "string") series[cle] = { total: v.total, date: v.date };
    }
    const nombre = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    return { series, enCours: nombre(d.enCours), meilleureSuite: nombre(d.meilleureSuite) };
  } catch {
    return RECORDS_VIDES;
  }
}
