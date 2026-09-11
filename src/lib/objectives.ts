/**
 * Objective timer: in-game schedule and pure timing functions.
 *
 * Every duration comes from a Fandom wiki page listed in `SOURCES`, checked on
 * 11 September 2026 (`CHECKED_ON`): the "Jungle Infobox" first, then the page
 * text. Nothing is estimated. A value the wiki does not give is left out; when
 * a page contradicts itself, both values stay visible (an `at` / `until`
 * window) instead of silently picking one.
 *
 * The module reads neither the clock nor storage: the component passes the
 * current instant, and the tests replay a match second by second.
 */
import { OBJECTIFS } from "@/lib/chatiment";

export const CHECKED_ON = "2026-09-11";

const WIKI = "https://mobilelegends.fandom.com/wiki/";

export const SOURCES = {
  turtle: `${WIKI}Turtle`,
  lord: `${WIKI}Lord`,
  purpleBuff: `${WIKI}Thunder_Fenrir`,
  orangeBuff: `${WIKI}Molten_Fiend`,
  crab: `${WIKI}Crab`,
  lithowanderer: `${WIKI}Lithowanderer`,
  lizard: `${WIKI}Horned_Lizard`,
  beetle: `${WIKI}Fire_Beetle`,
  golem: `${WIKI}Lava_Golem`,
  cyclone: `${WIKI}Cyclone_Eye`,
  turrets: `${WIKI}Turret`,
  minions: `${WIKI}Minion`,
  jungle: `${WIKI}Jungle`,
  map: `${WIKI}Map`,
  guide: `${WIKI}Battlefield_Guide`,
} as const;

/**
 * "Battlefield Events" table of the Battlefield Guide page: the Crab upgrade
 * at 2:00 (the Crab infobox says 3:00, so the timer shows the window) and the
 * roamer sharing minion and creep rewards from 8:00.
 */
export const GUIDE_EVENTS = {
  crabUpgrade: 120,
  roamerShare: 480,
} as const;

/** Turtle — "Turtle" page: infobox, "Spawn Time and Respawning", "Benefits". */
export const TURTLE = {
  /** First spawn, at exactly 2:00. */
  firstSpawn: 120,
  /** Back 120 s after it dies. */
  respawn: 120,
  /** Killed after 6:00, the Turtle does not come back: the Lord takes over. */
  cutoff: 360,
  /** At most four Turtles per match (patch notes 1.5.38, quoted on the page). */
  max: 4,
  /** Still alive at 8:00, it turns into the Lord after 5 s without damage; 9:00 at the latest. */
  lordFrom: 480,
  lordIdle: 5,
  lordAtLatest: 540,
  /** Gold for each hero of the team for the 1st, 2nd and 3rd Turtle. */
  goldPerHero: [60, 70, 80],
  /** Shield duration, in seconds. */
  shield: 120,
} as const;

/** Lord — "Lord" page: infobox and "Spawn Time and Interval". */
export const LORD = {
  /** Appears 2 min after the last Turtle is killed. */
  afterTurtle: 120,
  /** Back after a kill between 8:00 and 18:00. */
  respawn: 180,
  /** From 18:00, the respawn gets shorter. */
  lateFrom: 1080,
  /**
   * Respawn after a kill past 18:00: 120 s in the page text, 2.5 min in its
   * infobox. The timer counts to the first and shows the window to the second.
   */
  lateRespawn: 120,
  lateRespawnInfobox: 150,
  /** Extra magic damage of allies near the summoned Lord, and its cooldown. */
  allyBonus: 250,
  allyBonusCooldown: 2,
} as const;

/** Buffs — infoboxes of the "Thunder Fenrir" and "Molten Fiend" pages. */
export const BUFFS = {
  "purple-buff": { firstSpawn: 25, respawn: 90, duration: 75 },
  "orange-buff": { firstSpawn: 20, respawn: 90, duration: 75 },
} as const;

/** Buff effects, same infoboxes. */
export const BUFF_EFFECTS = {
  purple: { cooldown: 10, mana: 60, energy: 25, healMinion: 3, healHero: 8, healCreep: 12 },
  /** Penetration and slow: Assassin, Fighter, Tank / Marksman, Mage, Support. */
  orange: { damage: 50, penetration: [5, 10], slow: [60, 20], cooldown: 3 },
} as const;

/** Camps on a fixed schedule — infoboxes of the cited pages. A Cyclone Eye recharges after use, not after a kill. */
export const CAMPS = {
  lithowanderer: { firstSpawn: 35, respawn: 120 },
  "little-crab": { firstSpawn: 42, respawn: 20 },
  crab: { firstSpawn: 180, respawn: 120 },
  lizard: { firstSpawn: 40, respawn: 70 },
  beetle: { firstSpawn: 39, respawn: 70 },
  golem: { firstSpawn: 31, respawn: 70 },
  cyclone: { firstSpawn: 40, respawn: 30 },
} as const;

/** Camp rewards, same pages. */
export const CAMP_REWARDS = {
  /** Crab gold buff: gold earned and duration, for the Crab and the Little Crab. */
  crab: { gold: 60, duration: 18 },
  littleCrab: { gold: 30, duration: 10 },
  /** Walkie Grass: mana per second, river speed, duration; patrol of the Stone Roamer. */
  lithowanderer: { mana: 1, speed: 15, duration: 45, patrol: 45 },
  /** Healing buff of the small camps: HP and mana restored, over seconds. */
  heal: { hp: 350, mana: 5, duration: 2 },
  /** The Fire Beetle leaves a Little Fire Beetle that lives at most this long. */
  larva: 15,
  /** Cyclone Eyes: how many, and the delay before the glide. */
  cycloneCount: 4,
  glideDelay: 1.2,
} as const;

/** Turrets — "Turret" page. */
export const TURRETS = {
  perTeam: 9,
  perLane: 3,
  range: 5.3,
  sight: 8,
  /** Outer turrets stay idle until 15 s after the first minion wave. */
  idle: 15,
  /** Damage taken halved with no enemy minion in range. */
  reduction: 50,
  /** Each consecutive shot on a hero hits 75% harder, up to 20 times. */
  rampUp: 75,
  rampUpMax: 20,
} as const;

/** Minions — "Minion" page. */
export const MINIONS = {
  firstWave: 10,
  interval: 30,
  /** First 10 waves (until 5:10): cannon bonus in the Gold and EXP lanes. */
  bonusWaves: 10,
  bonusEnd: 310,
  goldBonus: 45,
  expBonus: 35,
  /** Mid lane, first 10 waves: lancers and infantry. */
  midLancers: 3,
  midInfantry: 1,
} as const;

export type CampKey = "turtle" | "lord" | "purple-buff" | "orange-buff" | "crab" | "lithowanderer" | "lizard" | "beetle" | "golem";

/** HP at spawn and after 12 min: "Initial ATTR" and "ATTR after 12 MIN" columns of the infoboxes. */
export const HP: Record<CampKey, { start: number; at12: number | null }> = {
  turtle: { start: OBJECTIFS.tortue.pv, at12: null },
  lord: { start: OBJECTIFS.seigneur.pv, at12: OBJECTIFS["seigneur-12"].pv },
  "purple-buff": { start: 4090, at12: OBJECTIFS["buff-violet"].pv },
  "orange-buff": { start: 4941, at12: OBJECTIFS["buff-orange"].pv },
  crab: { start: 3640, at12: 7867 },
  lithowanderer: { start: 2251, at12: 6056 },
  lizard: { start: 3019, at12: 4743 },
  beetle: { start: 2501, at12: 3895 },
  golem: { start: 3000, at12: 3897 },
};

// ---------------------------------------------------------------------------
// Match: clock and recorded kills
// ---------------------------------------------------------------------------

export type Side = "ours" | "theirs";
export type KillableKey = "turtle" | "lord" | "purple-buff" | "orange-buff";

/** Timer buttons: the side only matters for buffs, each team has its own. */
export const KILLABLES: readonly { key: KillableKey; side: Side | null }[] = [
  { key: "turtle", side: null },
  { key: "lord", side: null },
  { key: "purple-buff", side: "ours" },
  { key: "purple-buff", side: "theirs" },
  { key: "orange-buff", side: "ours" },
  { key: "orange-buff", side: "theirs" },
];

export interface Kill {
  key: KillableKey;
  side: Side | null;
  /** Game second of the kill. */
  at: number;
}

export interface Match {
  /** Game seconds at the `reference` instant. */
  game: number;
  /** Reference instant, in ms since the epoch: survives a page reload. */
  reference: number;
  running: boolean;
  kills: Kill[];
}

/** The clock stops there: 99:59 fits the display. */
export const MAX_TIME = 99 * 60 + 59;
const clamp = (s: number) => Math.min(MAX_TIME, Math.max(0, s));

export function gameTime(m: Match, now: number): number {
  return clamp(m.running ? m.game + (now - m.reference) / 1000 : m.game);
}

/** Match start: 0:00, clock running, no kill. */
export function startMatch(now: number): Match {
  return { game: 0, reference: now, running: true, kills: [] };
}

/** Syncs the clock to the time read in game; with no match yet, it starts at that time. */
export function setTime(m: Match | null, seconds: number, now: number): Match {
  if (!m) return { game: clamp(seconds), reference: now, running: true, kills: [] };
  return { ...m, game: clamp(seconds), reference: now };
}

export function shiftTime(m: Match, delta: number, now: number): Match {
  return setTime(m, gameTime(m, now) + delta, now);
}

/** Pause or resume; game time does not move while paused. */
export function togglePause(m: Match, now: number): Match {
  return m.running
    ? { ...m, game: gameTime(m, now), reference: now, running: false }
    : { ...m, reference: now, running: true };
}

/** Kill recorded at the displayed second (rounded down, like the in-game clock). */
export function recordKill(m: Match, key: KillableKey, side: Side | null, now: number): Match {
  const kill: Kill = { key, side: key.endsWith("-buff") ? side : null, at: Math.floor(gameTime(m, now)) };
  return { ...m, kills: [...m.kills, kill] };
}

/** A mistaken tap can be taken back: the last recorded kill goes away. */
export function undoLastKill(m: Match): Match {
  return { ...m, kills: m.kills.slice(0, -1) };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export type EventKey = KillableKey | "lithowanderer" | "cyclone" | "little-crab" | "crab" | "last-turtle" | "lord-18";

/**
 * Why a time is a window or needs a word: a Lord replacing a Turtle still alive
 * (8:00-9:00), a Lord following the last Turtle, a self-contradicting page, or
 * two pages that disagree.
 */
export type EventNote = "replacesTurtle" | "afterTurtle" | "infobox" | "sourcesDisagree";

export interface GameEvent {
  /** Stable across renders, changes with each kill: used as the alert key. */
  id: string;
  key: EventKey;
  /** Buff of one jungle; null for a shared objective or both jungles at once. */
  side: Side | null;
  /** Game second of the spawn, or of the milestone. */
  at: number;
  /** End of the window when the source does not give an exact second. */
  until: number | null;
  kind: "spawn" | "respawn" | "milestone";
  note: EventNote | null;
}

const event = (e: Pick<GameEvent, "id" | "key" | "at" | "kind"> & Partial<GameEvent>): GameEvent => ({
  side: null,
  until: null,
  note: null,
  ...e,
});

/**
 * Every appointment of the match, soonest first, from the recorded kills:
 * fixed spawns, the return of each tracked objective, and two milestones
 * (last possible Turtle, shorter Lord respawn).
 */
export function schedule(kills: readonly Kill[]): GameEvent[] {
  const events: GameEvent[] = [];

  // Camps without a button: their first spawn only.
  for (const key of ["lithowanderer", "cyclone", "little-crab"] as const) {
    events.push(event({ id: `${key}:1`, key, at: CAMPS[key].firstSpawn, kind: "spawn" }));
  }
  events.push(
    event({
      id: "crab:1",
      key: "crab",
      at: GUIDE_EVENTS.crabUpgrade,
      until: CAMPS.crab.firstSpawn,
      kind: "spawn",
      note: "sourcesDisagree",
    }),
  );

  // Buffs: one line for both jungles until someone kills one.
  for (const key of ["purple-buff", "orange-buff"] as const) {
    const rule = BUFFS[key];
    const bySide = (side: Side) => kills.filter((k) => k.key === key && k.side === side);
    const sides = [["ours", bySide("ours")], ["theirs", bySide("theirs")]] as const;
    if (sides.every(([, list]) => list.length === 0)) {
      events.push(event({ id: `${key}:1`, key, at: rule.firstSpawn, kind: "spawn" }));
      continue;
    }
    for (const [side, list] of sides) {
      const last = list.at(-1);
      events.push(
        last
          ? event({ id: `${key}:${side}:${list.length + 1}`, key, side, at: last.at + rule.respawn, kind: "respawn" })
          : event({ id: `${key}:${side}:1`, key, side, at: rule.firstSpawn, kind: "spawn" }),
      );
    }
  }

  // Turtle, then the Lord that replaces it.
  const turtles = kills.filter((k) => k.key === "turtle");
  const lastTurtle = turtles.at(-1);
  let lordAfterTurtle: number | null = null;
  if (!lastTurtle) {
    events.push(event({ id: "turtle:1", key: "turtle", at: TURTLE.firstSpawn, kind: "spawn" }));
  } else if (turtles.length < TURTLE.max && lastTurtle.at < TURTLE.cutoff) {
    events.push(event({ id: `turtle:${turtles.length + 1}`, key: "turtle", at: lastTurtle.at + TURTLE.respawn, kind: "respawn" }));
  } else {
    lordAfterTurtle = lastTurtle.at + LORD.afterTurtle;
  }

  const lords = kills.filter((k) => k.key === "lord");
  const lastLord = lords.at(-1);
  if (lastLord) {
    const late = lastLord.at >= LORD.lateFrom;
    events.push(
      event({
        id: `lord:${lords.length + 1}`,
        key: "lord",
        at: lastLord.at + (late ? LORD.lateRespawn : LORD.respawn),
        until: late ? lastLord.at + LORD.lateRespawnInfobox : null,
        kind: "respawn",
        note: late ? "infobox" : null,
      }),
    );
  } else if (lordAfterTurtle !== null) {
    events.push(event({ id: "lord:1", key: "lord", at: lordAfterTurtle, kind: "spawn", note: "afterTurtle" }));
  } else {
    events.push(
      event({ id: "lord:1", key: "lord", at: TURTLE.lordFrom, until: TURTLE.lordAtLatest, kind: "spawn", note: "replacesTurtle" }),
    );
  }

  // Milestones: the 6:00 cutoff no longer matters once the last Turtle is down.
  if (lordAfterTurtle === null && !lastLord) {
    events.push(event({ id: "milestone:turtle", key: "last-turtle", at: TURTLE.cutoff, kind: "milestone" }));
  }
  events.push(event({ id: "milestone:lord", key: "lord-18", at: LORD.lateFrom, kind: "milestone" }));

  return events.sort((x, y) => x.at - y.at);
}

/** An objective that just spawned stays in the list this long, marked "up". */
export const GRACE_S = 15;

/** Appointments still useful: upcoming, or spawned less than `GRACE_S` ago. */
export function upcoming(events: readonly GameEvent[], time: number): GameEvent[] {
  return events.filter((e) => (e.until ?? e.at) + GRACE_S > time);
}

export type ObjectiveState =
  | { state: "waiting"; at: number; until: number | null }
  | { state: "up"; since: number }
  | { state: "gone" };

/** State of a timer button: waiting for its return, up, or gone (no more Turtles). */
export function objectiveState(events: readonly GameEvent[], key: KillableKey, side: Side | null, time: number): ObjectiveState {
  if (key === "turtle" && time >= TURTLE.lordAtLatest) return { state: "gone" };
  const e = events.find((x) => x.key === key && (x.side === null || x.side === side));
  if (!e) return { state: "gone" };
  return time < e.at ? { state: "waiting", at: e.at, until: e.until } : { state: "up", since: e.at };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const ALERT_THRESHOLDS = [30, 10] as const;
/** Beyond this, a missed alert (sleeping tab, clock resync) is dropped: it would mislead. */
export const MAX_ALERT_DELAY_S = 2;
/**
 * Only the four tracked objectives buzz: the camps spawning between 0:20 and
 * 0:42 would otherwise fire five alerts in twenty seconds.
 */
export const ALERTED_KEYS: ReadonlySet<EventKey> = new Set(KILLABLES.map((k) => k.key));

export interface Alert {
  id: string;
  event: GameEvent;
  threshold: number;
}

/**
 * Thresholds crossed between two clock readings. Each alert fires once (the
 * threshold falls in a single interval), and only for a tracked objective.
 */
export function crossedAlerts(events: readonly GameEvent[], before: number, after: number): Alert[] {
  if (!(after > before)) return [];
  const alerts: Alert[] = [];
  for (const e of events) {
    if (!ALERTED_KEYS.has(e.key)) continue;
    for (const threshold of ALERT_THRESHOLDS) {
      const moment = e.at - threshold;
      if (moment > before && moment <= after && after - moment <= MAX_ALERT_DELAY_S) {
        alerts.push({ id: `${e.id}@${threshold}`, event: e, threshold });
      }
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Time display and input
// ---------------------------------------------------------------------------

/** "m:ss", like the in-game clock. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds left, rounded up: "0:01" until the end, "0:00" at the spawn. */
export function remaining(target: number, time: number): number {
  return Math.max(0, Math.ceil(target - time - 1e-9));
}

/**
 * Typed time: "12:34", "12.34", "12 34" or "1234". Seconds take two digits:
 * "5:7" would be ambiguous.
 */
export function parseTime(text: string): number | null {
  const s = text.trim();
  const m = s.match(/^(\d{1,2})\s*[:.,h\s]\s*(\d{2})$/) ?? s.match(/^(\d{1,2})(\d{2})$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  return seconds < 60 ? minutes * 60 + seconds : null;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const isNumber = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const KILLABLE_KEYS = new Set<string>(KILLABLES.map((k) => k.key));

/** Reads back a match kept in the tab; null for anything malformed. */
export function parseMatch(raw: string | null): Match | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<Match> | null;
    if (!d || !isNumber(d.game) || !isNumber(d.reference) || typeof d.running !== "boolean" || !Array.isArray(d.kills)) {
      return null;
    }
    const kills = d.kills
      .filter((k): k is Kill => !!k && KILLABLE_KEYS.has(k.key) && isNumber(k.at))
      .map((k) => ({
        key: k.key,
        side: k.key.endsWith("-buff") && (k.side === "ours" || k.side === "theirs") ? k.side : null,
        at: clamp(Math.floor(k.at)),
      }));
    return { game: clamp(d.game), reference: d.reference, running: d.running, kills };
  } catch {
    return null;
  }
}

export interface Settings {
  vibration: boolean;
  /** Beep off by default: people often play with the phone sound on. */
  sound: boolean;
  wakeLock: boolean;
}

export const DEFAULT_SETTINGS: Settings = { vibration: true, sound: false, wakeLock: false };

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const d = JSON.parse(raw) as Partial<Settings> | null;
    const flag = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
    return {
      vibration: flag(d?.vibration, DEFAULT_SETTINGS.vibration),
      sound: flag(d?.sound, DEFAULT_SETTINGS.sound),
      wakeLock: flag(d?.wakeLock, DEFAULT_SETTINGS.wakeLock),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
