import { describe, expect, it } from "vitest";
import {
  BUFFS,
  CAMPS,
  CHECKED_ON,
  DEFAULT_SETTINGS,
  GRACE_S,
  HP,
  KILLABLES,
  LORD,
  SOURCES,
  TURTLE,
  crossedAlerts,
  formatTime,
  gameTime,
  objectiveState,
  parseMatch,
  parseSettings,
  parseTime,
  recordKill,
  remaining,
  schedule,
  setTime,
  shiftTime,
  startMatch,
  togglePause,
  undoLastKill,
  upcoming,
  type Kill,
} from "@/lib/objectives";
import { MAP_POINTS, mirror } from "@/lib/game-map";

const T0 = 1_700_000_000_000;
const min = (m: number, s = 0) => m * 60 + s;
const find = (kills: Kill[], id: string) => schedule(kills).find((e) => e.id === id);

describe("sourced data", () => {
  it("cites the Fandom wiki and dates the check", () => {
    expect(CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const url of Object.values(SOURCES)) expect(url).toMatch(/^https:\/\/mobilelegends\.fandom\.com\/wiki\//);
    for (const p of MAP_POINTS) expect(Object.values(SOURCES)).toContain(p.source);
  });

  it("matches the wiki infoboxes", () => {
    expect(TURTLE.firstSpawn).toBe(120);
    expect(TURTLE.respawn).toBe(120);
    expect(LORD.respawn).toBe(180);
    expect(BUFFS["purple-buff"]).toMatchObject({ firstSpawn: 25, respawn: 90 });
    expect(BUFFS["orange-buff"]).toMatchObject({ firstSpawn: 20, respawn: 90 });
    expect(CAMPS.crab.firstSpawn).toBe(180);
    expect(HP.lord).toEqual({ start: 31_743, at12: 42_953 });
  });
});

describe("game time", () => {
  it("formats and parses m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65.9)).toBe("1:05");
    expect(formatTime(-3)).toBe("0:00");
    expect(formatTime(min(18, 30))).toBe("18:30");
    expect(parseTime("12:34")).toBe(min(12, 34));
    expect(parseTime(" 7.05 ")).toBe(min(7, 5));
    expect(parseTime("1234")).toBe(min(12, 34));
    expect(parseTime("305")).toBe(min(3, 5));
    expect(parseTime("12:75")).toBeNull();
    expect(parseTime("5:7")).toBeNull();
    expect(parseTime("45")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });

  it("rounds the seconds left up", () => {
    expect(remaining(120, 119.2)).toBe(1);
    expect(remaining(120, 120)).toBe(0);
    expect(remaining(120, 130)).toBe(0);
  });

  it("follows the clock, pause and resync", () => {
    let m = startMatch(T0);
    expect(gameTime(m, T0 + 61_500)).toBeCloseTo(61.5);
    m = togglePause(m, T0 + 61_500);
    expect(m.running).toBe(false);
    expect(gameTime(m, T0 + 300_000)).toBeCloseTo(61.5);
    m = togglePause(m, T0 + 300_000);
    expect(gameTime(m, T0 + 310_000)).toBeCloseTo(71.5);
    m = setTime(m, min(5), T0 + 310_000);
    expect(gameTime(m, T0 + 312_000)).toBeCloseTo(302);
    m = shiftTime(m, -5, T0 + 312_000);
    expect(gameTime(m, T0 + 312_000)).toBeCloseTo(297);
    expect(gameTime(shiftTime(m, -9999, T0 + 312_000), T0 + 312_000)).toBe(0);
  });

  it("starts at the typed time when there is no match yet", () => {
    const m = setTime(null, min(3, 20), T0);
    expect(m.running).toBe(true);
    expect(gameTime(m, T0 + 1000)).toBeCloseTo(201);
  });

  it("records a kill at the displayed second and undoes it", () => {
    let m = startMatch(T0);
    m = recordKill(m, "turtle", "ours", T0 + 145_900);
    expect(m.kills).toEqual([{ key: "turtle", side: null, at: 145 }]);
    m = recordKill(m, "orange-buff", "theirs", T0 + 150_000);
    expect(m.kills.at(-1)).toEqual({ key: "orange-buff", side: "theirs", at: 150 });
    expect(undoLastKill(m).kills).toHaveLength(1);
  });
});

describe("schedule", () => {
  it("lists the first spawns of a fresh match", () => {
    const events = schedule([]);
    expect(events.map((e) => [e.id, e.at])).toEqual([
      ["orange-buff:1", 20],
      ["purple-buff:1", 25],
      ["lithowanderer:1", 35],
      ["cyclone:1", 40],
      ["little-crab:1", 42],
      ["crab:1", 120],
      ["turtle:1", 120],
      ["milestone:turtle", 360],
      ["lord:1", 480],
      ["milestone:lord", 1080],
    ]);
    expect(events.find((e) => e.id === "lord:1")).toMatchObject({ until: 540, note: "replacesTurtle" });
  });

  it("shows the Crab between the two wiki times", () => {
    expect(find([], "crab:1")).toMatchObject({ at: 120, until: 180, note: "sourcesDisagree" });
  });

  it("brings the Turtle back 2 min after it dies, while it dies before 6:00", () => {
    const kills: Kill[] = [{ key: "turtle", side: null, at: min(2, 30) }];
    expect(find(kills, "turtle:2")).toMatchObject({ at: min(4, 30), kind: "respawn" });
    expect(find(kills, "lord:1")).toMatchObject({ at: min(8), note: "replacesTurtle" });
  });

  it("replaces a Turtle killed after 6:00 with the Lord, 2 min later", () => {
    const kills: Kill[] = [
      { key: "turtle", side: null, at: min(2, 10) },
      { key: "turtle", side: null, at: min(6, 15) },
    ];
    const events = schedule(kills);
    expect(events.some((e) => e.key === "turtle")).toBe(false);
    expect(events.some((e) => e.key === "last-turtle")).toBe(false);
    expect(find(kills, "lord:1")).toMatchObject({ at: min(8, 15), until: null, note: "afterTurtle" });
  });

  it("stops at four Turtles", () => {
    const kills: Kill[] = [130, 140, 150, 160].map((at) => ({ key: "turtle", side: null, at }));
    expect(schedule(kills).some((e) => e.key === "turtle")).toBe(false);
    expect(find(kills, "lord:1")?.at).toBe(280);
  });

  it("brings the Lord back in 3 min, then within the wiki window after 18:00", () => {
    const before: Kill[] = [{ key: "lord", side: null, at: min(10) }];
    expect(find(before, "lord:2")).toMatchObject({ at: min(13), until: null, note: null });
    const after: Kill[] = [...before, { key: "lord", side: null, at: min(18, 30) }];
    expect(find(after, "lord:3")).toMatchObject({ at: min(20, 30), until: min(21), note: "infobox" });
  });

  it("tracks each jungle's buffs separately", () => {
    const kills: Kill[] = [{ key: "purple-buff", side: "ours", at: min(1) }];
    const events = schedule(kills);
    expect(find(kills, "purple-buff:ours:2")).toMatchObject({ at: min(2, 30), side: "ours" });
    expect(find(kills, "purple-buff:theirs:1")).toMatchObject({ at: 25, side: "theirs" });
    expect(events.find((e) => e.id === "orange-buff:1")?.side).toBeNull();
  });

  it("keeps a spawned objective for a few seconds, then drops it", () => {
    const events = schedule([]);
    expect(upcoming(events, 120 + GRACE_S - 1).some((e) => e.id === "turtle:1")).toBe(true);
    expect(upcoming(events, 120 + GRACE_S).some((e) => e.id === "turtle:1")).toBe(false);
    // A window stays listed until it closes.
    expect(upcoming(events, 530).some((e) => e.id === "lord:1")).toBe(true);
  });

  it("gives the state of each button", () => {
    const events = schedule([{ key: "orange-buff", side: "theirs", at: 100 }]);
    expect(objectiveState(events, "orange-buff", "theirs", 150)).toEqual({ state: "waiting", at: 190, until: null });
    expect(objectiveState(events, "orange-buff", "ours", 150)).toEqual({ state: "up", since: 20 });
    expect(objectiveState(events, "turtle", null, 60)).toMatchObject({ state: "waiting", at: 120 });
    expect(objectiveState(events, "turtle", null, min(9))).toEqual({ state: "gone" });
    const noTurtle = schedule([{ key: "turtle", side: null, at: min(6, 30) }]);
    expect(objectiveState(noTurtle, "turtle", null, min(7))).toEqual({ state: "gone" });
  });
});

describe("alerts", () => {
  const events = schedule([]);

  it("fires at 30 s and at 10 s, once each", () => {
    const turtle30 = crossedAlerts(events, 89.8, 90.05).filter((a) => a.event.id === "turtle:1");
    expect(turtle30.map((a) => a.threshold)).toEqual([30]);
    expect(crossedAlerts(events, 90.05, 90.3).some((a) => a.event.id === "turtle:1")).toBe(false);
    expect(crossedAlerts(events, 109.9, 110.1).find((a) => a.event.id === "turtle:1")?.threshold).toBe(10);
  });

  it("stays quiet for a stale alert, a milestone or a clock going back", () => {
    expect(crossedAlerts(events, 80, 95)).toEqual([]);
    expect(crossedAlerts(events, 1049.9, 1050.1)).toEqual([]);
    expect(crossedAlerts(events, 100, 50)).toEqual([]);
  });

  it("only alerts for the four tracked objectives", () => {
    // Lithowanderer at 0:35: its 10 s mark (0:25) passes without a buzz.
    expect(crossedAlerts(events, 24.9, 25.1).some((a) => a.event.key === "lithowanderer")).toBe(false);
    // Purple buff at 0:25: its 10 s mark (0:15) buzzes.
    expect(crossedAlerts(events, 14.9, 15.1).map((a) => a.event.id)).toEqual(["purple-buff:1"]);
  });
});

describe("storage", () => {
  it("reads back a valid match and rejects the rest", () => {
    const m = recordKill(startMatch(T0), "purple-buff", "theirs", T0 + 30_000);
    expect(parseMatch(JSON.stringify(m))).toEqual(m);
    expect(parseMatch(null)).toBeNull();
    expect(parseMatch("{")).toBeNull();
    expect(parseMatch(JSON.stringify({ game: "x", reference: 1, running: true, kills: [] }))).toBeNull();
    const dirty = { ...m, kills: [{ key: "dragon", at: 3 }, { key: "turtle", side: "theirs", at: 125.7 }] };
    expect(parseMatch(JSON.stringify(dirty))?.kills).toEqual([{ key: "turtle", side: null, at: 125 }]);
  });

  it("fills settings with the defaults", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.sound).toBe(false);
    expect(parseSettings('{"sound":true,"wakeLock":"yes"}')).toEqual({ vibration: true, sound: true, wakeLock: false });
    expect(parseSettings("not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("offers one button per objective, per jungle for buffs", () => {
    expect(KILLABLES.filter((k) => k.key.endsWith("-buff")).every((k) => k.side !== null)).toBe(true);
    expect(KILLABLES.filter((k) => !k.key.endsWith("-buff")).every((k) => k.side === null)).toBe(true);
  });
});

describe("map layout", () => {
  it("stays inside the square and mirrors across the river", () => {
    for (const p of MAP_POINTS) {
      for (const pos of p.positions) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThanOrEqual(100);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThanOrEqual(100);
        const image = mirror(pos);
        expect(p.positions.some((q) => q.x === image.x && q.y === image.y && q.side === image.side)).toBe(true);
      }
    }
  });

  it("has nine turrets per team, our side below the river", () => {
    const turrets = MAP_POINTS.find((p) => p.key === "turret")!.positions;
    expect(turrets.filter((t) => t.side === "ours")).toHaveLength(9);
    for (const p of MAP_POINTS) for (const pos of p.positions) if (pos.side === "ours") expect(pos.y).toBeGreaterThan(pos.x);
  });

  it("leaves enough room between two markers to tap them", () => {
    const all = MAP_POINTS.flatMap((p) => p.positions);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y)).toBeGreaterThanOrEqual(9.9);
      }
    }
  });
});
