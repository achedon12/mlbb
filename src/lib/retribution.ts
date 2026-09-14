/**
 * Retribution trainer engine.
 *
 * Pure module: hit generation, strike verdict, points, run
 * summary and records. The client component only adds the clock and the screen;
 * tests replay everything with a seeded generator.
 *
 * Two kinds of values, not to be confused:
 *
 * - **sourced** — Retribution damage and monster HP, taken from the Fandom wiki
 *   (accessed on September 11, 2026);
 * - **training** — hit pace, team damage, enemy jungler
 *   reaction, recommended levels: tuned so the exercise feels like
 *   a real fight, without claiming to reproduce the game.
 */

/**
 * Retribution damage: 520 (+80 x hero level) true damage, from 600 at
 * level 1 to 1720 at level 15. Source: "Spell data Retribution" template of the
 * Fandom wiki, https://mobilelegends.fandom.com/wiki/Retribution
 */
export const RETRIBUTION_BASE = 520;
export const RETRIBUTION_BY_LEVEL = 80;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 15;
/** Retribution cooldown, in seconds (same source): a missed Retribution does not come back in time. */
export const COOLDOWN_RETRIBUTION_S = 35;

export const SOURCE_RETRIBUTION = "https://mobilelegends.fandom.com/wiki/Retribution";

export function damageRetribution(level: number): number {
  const n = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(level)));
  return RETRIBUTION_BASE + RETRIBUTION_BY_LEVEL * n;
}

export type ObjectiveKey = "turtle" | "lord" | "lord-12" | "purple-buff" | "orange-buff";

export interface Objective {
  /**
   * Monster HP (sourced): "Initial ATTR" and "ATTR after 12 MIN" columns
   * of the Fandom wiki page.
   */
  hp: number;
  /**
   * HP per segment of the health bar (sourced): 2,000 for Turtle and
   * Lord, 1,000 for other creatures (patch notes quoted by the
   * wiki, "Lord" and "Turtle" pages).
   */
  segment: number;
  /** Jungler level suggested by default — training value. */
  levelRecommended: number;
  /** Moment of the fight, for the label: at spawn or after 12 minutes. */
  moment: "spawn" | "12min";
  source: string;
  /** Local portrait, copied from the wiki page by the sync. */
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

/** Settings of a difficulty — training values, all of them. */
export interface Setting {
  /**
   * Time the team takes, at its average pace, to bring the monster
   * from the Retribution threshold to zero: the strike window. Damage per second
   * is derived from it (threshold / window).
   */
  windowMs: number;
  /** Interval between two hits, in ms: shorter is harder to follow. */
  interval: [number, number];
  /** Relative spread of a hit's damage around the average. */
  noise: number;
  /** Probability that a hit is an ally skill (x2 to x3). */
  pSkill: number;
  /** Probability that a hit comes with a burst from the enemy team. */
  pBurst: number;
  /** Enemy burst, as a fraction of the Retribution threshold. */
  burst: [number, number];
  /** Enemy jungler reaction once the threshold is crossed, in ms. */
  reactionEnemy: [number, number];
  /** On-screen aids: threshold marker on the bar, HP figures. */
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

/** Fight duration before the threshold, in seconds at average pace: the wait, then the tension. */
const BEFORE_THRESHOLD_S: [number, number] = [2.5, 5.5];
/** A hit that crosses the threshold leaves at least this share of the threshold: never a round lost in advance. */
const REST_MIN_AU_THRESHOLD = 0.3;

export const ROUNDS_PER_RUN = 5;

/** Seeded pseudo-random generator (mulberry32): a round replays identically. */
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
  /** Team damage per second, on average. */
  dps: number;
  /** Enemy jungler reaction for this round, in ms. */
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
  /** Wait before this hit, in ms. */
  interval: number;
  damage: number;
  source: "ally" | "skill" | "enemy";
  hpAfter: number;
}

/**
 * Next hit. Damage follows the team's average pace, with noise,
 * ally skills and enemy bursts. Two safeguards: a hit
 * never takes the monster from above the threshold to zero, and the one that
 * crosses the threshold leaves at least 30% of the threshold — there is always a
 * strike window.
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
  /** Share of the window kept: HP at strike / HP when the threshold was crossed. */
  accuracy: number | null;
  /** Time between the threshold crossing and the strike, in ms. */
  reaction: number | null;
  /** HP left after a Retribution cast too early. */
  rest: number | null;
  /** Enemy jungler reaction, when they stole the monster. */
  reactionEnemy: number | null;
}

/**
 * Points for a successful strike, out of 1,000: 700 for accuracy (the share of
 * threshold HP still there when striking), 300 for speed (full
 * under 150 ms, zero beyond one second).
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

/** Verdict of a player strike. */
export function evaluateHit(o: {
  hp: number;
  threshold: number;
  /** HP right after the hit that crossed the threshold; null if not crossed yet. */
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

/** Records kept in the browser. */
export interface Records {
  /** Best run total, by objective and difficulty (`lord:hard`). */
  series: Record<string, { total: number; date: string }>;
  /** Successful strikes in a row, current and best. */
  enCours: number;
  meilleureSuite: number;
}

export const RECORDS_EMPTY: Records = { series: {}, enCours: 0, meilleureSuite: 0 };

export const keyRecord = (objective: ObjectiveKey, difficulty: Difficulty) => `${objective}:${difficulty}`;

/** Streak of successful strikes after a round: +1, or back to zero. */
export function afterRound(records: Records, issue: Issue): Records {
  const inProgress = issue === "secured" ? records.enCours + 1 : 0;
  return { ...records, enCours: inProgress, meilleureSuite: Math.max(records.meilleureSuite, inProgress) };
}

/** Records after a complete run, and whether it beats the previous one. */
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

/** Reads stored records, ignoring anything that does not have the right shape. */
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
