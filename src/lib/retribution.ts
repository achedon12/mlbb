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
export const RETRIBUTION_BASE = 520;
export const RETRIBUTION_BY_LEVEL = 80;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 15;
/** Recharge du Chatiment, en secondes (meme source) : un Chatiment rate ne revient pas a temps. */
export const COOLDOWN_RETRIBUTION_S = 35;

export const SOURCE_RETRIBUTION = "https://mobilelegends.fandom.com/wiki/Retribution";

export function damageRetribution(level: number): number {
  const n = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(level)));
  return RETRIBUTION_BASE + RETRIBUTION_BY_LEVEL * n;
}

export type ObjectiveKey = "turtle" | "lord" | "lord-12" | "purple-buff" | "orange-buff";

export interface Objective {
  /**
   * PV du monstre (source) : colonnes « Initial ATTR » et « ATTR after 12 MIN »
   * de la fiche du wiki Fandom.
   */
  hp: number;
  /**
   * PV par segment de la barre de vie (source) : 2 000 pour la Tortue et le
   * Seigneur, 1 000 pour les autres creatures (notes de patch citees par le
   * wiki, pages « Lord » et « Turtle »).
   */
  segment: number;
  /** Niveau du jungler propose par defaut — valeur d'entrainement. */
  levelRecommended: number;
  /** Moment du combat, pour le libelle : a l'apparition ou apres 12 minutes. */
  moment: "spawn" | "12min";
  source: string;
  /** Portrait local, copie depuis la page du wiki par la synchronisation. */
  image: string;
}

export const OBJECTIVES: Record<ObjectiveKey, Objective> = {
  turtle: {
    hp: 10_367,
    segment: 2000,
    levelRecommended: 4,
    moment: "spawn",
    source: "https://mobilelegends.fandom.com/wiki/Turtle",
    image: "/visuels/monstres/turtle.webp",
  },
  lord: {
    hp: 31_743,
    segment: 2000,
    levelRecommended: 9,
    moment: "spawn",
    source: "https://mobilelegends.fandom.com/wiki/Lord",
    image: "/visuels/monstres/lord.webp",
  },
  "lord-12": {
    hp: 42_953,
    segment: 2000,
    levelRecommended: 12,
    moment: "12min",
    source: "https://mobilelegends.fandom.com/wiki/Lord",
    image: "/visuels/monstres/lord.webp",
  },
  "purple-buff": {
    hp: 6622,
    segment: 1000,
    levelRecommended: 12,
    moment: "12min",
    source: "https://mobilelegends.fandom.com/wiki/Thunder_Fenrir",
    image: "/visuels/monstres/purple-buff.webp",
  },
  "orange-buff": {
    hp: 8111,
    segment: 1000,
    levelRecommended: 12,
    moment: "12min",
    source: "https://mobilelegends.fandom.com/wiki/Molten_Fiend",
    image: "/visuels/monstres/orange-buff.webp",
  },
};

export const OBJECTIVE_KEYS = Object.keys(OBJECTIVES) as ObjectiveKey[];

export type Difficulty = "easy" | "normal" | "hard" | "pro";
export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard", "pro"];

/** Reglage d'une difficulte — valeurs d'entrainement, toutes. */
export interface Setting {
  /**
   * Temps que met l'equipe, a son rythme moyen, pour faire passer le monstre
   * du seuil du Chatiment a zero : la fenetre de tir. Les degats par seconde
   * s'en deduisent (seuil / fenetre).
   */
  windowMs: number;
  /** Intervalle entre deux coups, en ms : plus court, plus dur a suivre. */
  interval: [number, number];
  /** Ecart relatif des degats d'un coup autour de la moyenne. */
  noise: number;
  /** Probabilite qu'un coup soit une competence alliee (x2 a x3). */
  pSkill: number;
  /** Probabilite qu'un coup s'accompagne d'une rafale de l'equipe adverse. */
  pBurst: number;
  /** Rafale adverse, en fraction du seuil du Chatiment. */
  burst: [number, number];
  /** Reaction du jungler adverse une fois le seuil franchi, en ms. */
  reactionEnemy: [number, number];
  /** Aides a l'ecran : repere du seuil sur la barre, PV chiffres. */
  marker: boolean;
  hpFigures: boolean;
}

export const SETTINGS: Record<Difficulty, Setting> = {
  easy: {
    windowMs: 1800,
    interval: [380, 520],
    noise: 0.15,
    pSkill: 0.05,
    pBurst: 0,
    burst: [0, 0],
    reactionEnemy: [1200, 1500],
    marker: true,
    hpFigures: true,
  },
  normal: {
    windowMs: 1150,
    interval: [240, 400],
    noise: 0.3,
    pSkill: 0.1,
    pBurst: 0.06,
    burst: [0.25, 0.45],
    reactionEnemy: [650, 900],
    marker: true,
    hpFigures: true,
  },
  hard: {
    windowMs: 800,
    interval: [160, 320],
    noise: 0.45,
    pSkill: 0.14,
    pBurst: 0.12,
    burst: [0.3, 0.6],
    reactionEnemy: [430, 600],
    marker: false,
    hpFigures: false,
  },
  pro: {
    windowMs: 560,
    interval: [110, 240],
    noise: 0.55,
    pSkill: 0.18,
    pBurst: 0.18,
    burst: [0.35, 0.7],
    reactionEnemy: [300, 420],
    marker: false,
    hpFigures: false,
  },
};

/** Duree du combat avant le seuil, en secondes au rythme moyen : l'attente, puis la tension. */
const BEFORE_THRESHOLD_S: [number, number] = [2.5, 5.5];
/** Un coup qui franchit le seuil laisse au moins cette part du seuil : jamais de manche perdue d'avance. */
const REST_MIN_AU_THRESHOLD = 0.3;

export const ROUNDS_PER_RUN = 5;

/** Generateur pseudo-aleatoire a graine (mulberry32) : une manche se rejoue a l'identique. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const between = (random: () => number, [min, max]: [number, number]) => min + (max - min) * random();

export interface Round {
  hpMax: number;
  threshold: number;
  hpStart: number;
  /** Degats par seconde de l'equipe, en moyenne. */
  dps: number;
  /** Reaction du jungler adverse pour cette manche, en ms. */
  reactionEnemy: number;
}

export function prepareRound(objective: ObjectiveKey, difficulty: Difficulty, level: number, random: () => number): Round {
  const o = OBJECTIVES[objective];
  const r = SETTINGS[difficulty];
  const threshold = damageRetribution(level);
  const dps = threshold / (r.windowMs / 1000);
  const hpStart = Math.round(Math.min(o.hp, threshold + dps * between(random, BEFORE_THRESHOLD_S)));
  return { hpMax: o.hp, threshold, hpStart, dps, reactionEnemy: Math.round(between(random, r.reactionEnemy)) };
}

export interface Hit {
  /** Attente avant ce coup, en ms. */
  interval: number;
  damage: number;
  source: "ally" | "skill" | "enemy";
  hpAfter: number;
}

/**
 * Coup suivant. Les degats suivent le rythme moyen de l'equipe, avec du bruit,
 * des competences alliees et des rafales adverses. Deux garde-fous : un coup
 * ne fait jamais passer le monstre d'au-dessus du seuil a zero, et celui qui
 * franchit le seuil laisse au moins 30 % du seuil — il reste toujours une
 * fenetre de tir.
 */
export function hitNext(hp: number, round: Round, difficulty: Difficulty, random: () => number): Hit {
  const r = SETTINGS[difficulty];
  const interval = Math.round(between(random, r.interval));
  let damage = round.dps * (interval / 1000) * (1 + r.noise * (random() * 2 - 1));
  let source: Hit["source"] = "ally";
  if (random() < r.pSkill) {
    damage *= between(random, [2, 3]);
    source = "skill";
  }
  if (random() < r.pBurst) {
    damage += round.threshold * between(random, r.burst);
    source = "enemy";
  }
  damage = Math.max(1, Math.round(damage));
  let hpAfter = hp - damage;
  if (hp > round.threshold && hpAfter < round.threshold * REST_MIN_AU_THRESHOLD) {
    hpAfter = Math.round(round.threshold * between(random, [REST_MIN_AU_THRESHOLD, 0.95]));
    damage = hp - hpAfter;
  }
  return { interval, damage, source, hpAfter: Math.max(0, hpAfter) };
}

export type Issue = "secured" | "tooEarly" | "stolen" | "missed";

export interface Result {
  issue: Issue;
  points: number;
  /** Part de la fenetre gardee : PV a la frappe / PV au franchissement du seuil. */
  accuracy: number | null;
  /** Temps entre le franchissement du seuil et la frappe, en ms. */
  reaction: number | null;
  /** PV restants apres un Chatiment trop tot. */
  rest: number | null;
  /** Reaction du jungler adverse, quand il a vole le monstre. */
  reactionEnemy: number | null;
}

/**
 * Points d'une frappe reussie, sur 1 000 : 700 pour la precision (la part des
 * PV du seuil encore la au moment de frapper), 300 pour la vitesse (pleine
 * sous 150 ms, nulle au-dela d'une seconde).
 */
export const WEIGHT_ACCURACY = 700;
export const WEIGHT_SPEED = 300;
export const REACTION_FULL_MS = 150;
export const REACTION_NONE_MS = 1000;

export function pointsHit(accuracy: number, reaction: number): number {
  const p = Math.min(1, Math.max(0, accuracy));
  const v = Math.min(1, Math.max(0, (REACTION_NONE_MS - reaction) / (REACTION_NONE_MS - REACTION_FULL_MS)));
  return Math.round(WEIGHT_ACCURACY * p + WEIGHT_SPEED * v);
}

/** Verdict d'une frappe du joueur. */
export function evaluateHit(o: {
  hp: number;
  threshold: number;
  /** PV juste apres le coup qui a franchi le seuil ; null s'il ne l'est pas encore. */
  hpCrossing: number | null;
  reaction: number | null;
}): Result {
  if (o.hp > o.threshold || o.hpCrossing === null || o.reaction === null) {
    return { issue: "tooEarly", points: 0, accuracy: null, reaction: null, rest: o.hp - o.threshold, reactionEnemy: null };
  }
  const accuracy = o.hpCrossing > 0 ? o.hp / o.hpCrossing : 1;
  return {
    issue: "secured",
    points: pointsHit(accuracy, o.reaction),
    accuracy,
    reaction: Math.max(0, Math.round(o.reaction)),
    rest: null,
    reactionEnemy: null,
  };
}

export function resultStolen(reactionEnemy: number): Result {
  return { issue: "stolen", points: 0, accuracy: null, reaction: null, rest: null, reactionEnemy };
}

export function resultRate(): Result {
  return { issue: "missed", points: 0, accuracy: null, reaction: null, rest: null, reactionEnemy: null };
}

export interface Summary {
  total: number;
  secured: number;
  rounds: number;
  bestReaction: number | null;
  accuracyAverage: number | null;
}

export function runSummary(results: Result[]): Summary {
  const successful = results.filter((r) => r.issue === "secured");
  const reactions = successful.map((r) => r.reaction!).filter((r) => r !== null);
  return {
    total: results.reduce((s, r) => s + r.points, 0),
    secured: successful.length,
    rounds: results.length,
    bestReaction: reactions.length ? Math.min(...reactions) : null,
    accuracyAverage: successful.length ? successful.reduce((s, r) => s + r.accuracy!, 0) / successful.length : null,
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

export const RECORDS_EMPTY: Records = { series: {}, enCours: 0, meilleureSuite: 0 };

export const keyRecord = (objective: ObjectiveKey, difficulty: Difficulty) => `${objective}:${difficulty}`;

/** Suite de frappes reussies apres une manche : +1, ou retour a zero. */
export function afterRound(records: Records, issue: Issue): Records {
  const inProgress = issue === "secured" ? records.enCours + 1 : 0;
  return { ...records, enCours: inProgress, meilleureSuite: Math.max(records.meilleureSuite, inProgress) };
}

/** Records apres une serie complete, et si elle bat le precedent. */
export function afterRun(
  records: Records,
  key: string,
  summary: Summary,
  date: string,
): { records: Records; isNewRecord: boolean } {
  const before = records.series[key];
  if (summary.total <= 0 || (before && before.total >= summary.total)) return { records, isNewRecord: false };
  return { records: { ...records, series: { ...records.series, [key]: { total: summary.total, date } } }, isNewRecord: true };
}

/**
 * Records stored before the objective and difficulty tokens were renamed use
 * keys such as `seigneur:difficile`. They are read under the current keys so
 * no one loses a best score.
 */
const LEGACY_RECORD_TOKENS: Record<string, string> = {
  tortue: "turtle", seigneur: "lord", "seigneur-12": "lord-12", "buff-violet": "purple-buff", "buff-orange": "orange-buff",
  facile: "easy", difficile: "hard",
};
const currentRecordKey = (key: string) => key.split(":").map((part) => LEGACY_RECORD_TOKENS[part] ?? part).join(":");

/** Relit des records stockes, en ignorant tout ce qui n'a pas la bonne forme. */
export function readRecords(raw: string | null): Records {
  if (!raw) return RECORDS_EMPTY;
  try {
    const d = JSON.parse(raw) as Partial<Records>;
    const series: Records["series"] = {};
    for (const [key, v] of Object.entries(d.series ?? {})) {
      if (v && typeof v.total === "number" && typeof v.date === "string") series[currentRecordKey(key)] = { total: v.total, date: v.date };
    }
    const count = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    return { series, enCours: count(d.enCours), meilleureSuite: count(d.meilleureSuite) };
  } catch {
    return RECORDS_EMPTY;
  }
}
