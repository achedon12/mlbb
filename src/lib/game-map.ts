/**
 * Schematic plan of the Land of Dawn (classic mode), drawn for the site: no
 * game asset. Coordinates on a 100 x 100 square, y pointing down, our base in
 * the bottom left corner as on the player's screen.
 *
 * What the drawing takes from the wiki: three lanes with three turrets per
 * team ("Turret" page), a river across the map, the first Turtle next to the
 * EXP lane ("Turtle" page) and the Gold lane on the other side ("Minion"
 * page), the purple buff on the left side and the orange buff near the bottom
 * lane ("Thunder Fenrir", "Molten Fiend"), the Lithowanderer by the mid lane,
 * the Crabs near the side lanes, four Cyclone Eyes. Everything else
 * (distances, camp shapes) is schematic, not to scale.
 *
 * The wiki does not pin the Lord's pit: the Turtle page says the game shows
 * where the next Turtle spawns, and the Lord page that a Turtle still alive at
 * 8:00 turns into the Lord where it stands. The drawing puts a second pit
 * across the river and the Lord's card says so.
 *
 * Both halves mirror each other across the river: (x, y) -> (y, x) maps an
 * allied point to its enemy counterpart. A Turtle beside the EXP lane for both
 * teams requires it: each lane is the same lane from both sides.
 */
import { SOURCES } from "@/lib/objectives";

export type MapPointKey =
  | "turtle"
  | "lord"
  | "purple-buff"
  | "orange-buff"
  | "lithowanderer"
  | "crab"
  | "lizard"
  | "beetle"
  | "golem"
  | "cyclone"
  | "turret"
  | "base"
  | "exp-lane"
  | "mid-lane"
  | "gold-lane";

export type MapSide = "ours" | "theirs" | null;
export type MapGroup = "objective" | "buff" | "camp" | "terrain" | "lane";

export interface Position {
  x: number;
  y: number;
  side: MapSide;
}

export interface MapPoint {
  key: MapPointKey;
  group: MapGroup;
  positions: Position[];
  source: string;
}

export const mirror = (p: Position): Position => ({
  x: p.y,
  y: p.x,
  side: p.side === "ours" ? "theirs" : p.side === "theirs" ? "ours" : null,
});

/** An allied point and its enemy image. */
const bothSides = (...points: [number, number][]): Position[] =>
  points.flatMap(([x, y]) => {
    const ally: Position = { x, y, side: "ours" };
    return [ally, mirror(ally)];
  });

const shared = (x: number, y: number): Position => ({ x, y, side: null });

export const MAP_GROUPS: readonly MapGroup[] = ["objective", "buff", "camp", "terrain", "lane"];

export const MAP_POINTS: readonly MapPoint[] = [
  { key: "turtle", group: "objective", positions: [shared(29, 29)], source: SOURCES.turtle },
  { key: "lord", group: "objective", positions: [shared(71, 71)], source: SOURCES.lord },
  { key: "purple-buff", group: "buff", positions: bothSides([20, 56]), source: SOURCES.purpleBuff },
  { key: "orange-buff", group: "buff", positions: bothSides([48, 80]), source: SOURCES.orangeBuff },
  { key: "lithowanderer", group: "camp", positions: [shared(40, 40)], source: SOURCES.lithowanderer },
  { key: "crab", group: "camp", positions: [shared(19, 19), shared(81, 81)], source: SOURCES.crab },
  { key: "lizard", group: "camp", positions: bothSides([24, 40]), source: SOURCES.lizard },
  { key: "beetle", group: "camp", positions: bothSides([40, 70]), source: SOURCES.beetle },
  { key: "golem", group: "camp", positions: bothSides([64, 80]), source: SOURCES.golem },
  { key: "cyclone", group: "terrain", positions: bothSides([30, 52], [60, 70]), source: SOURCES.cyclone },
  {
    key: "turret",
    group: "terrain",
    // Per lane, from the base outwards: EXP lane (left edge), mid lane, Gold lane (bottom edge).
    positions: bothSides([9, 74], [9, 54], [9, 34], [20, 80], [30, 70], [40, 60], [28, 91], [48, 91], [68, 91]),
    source: SOURCES.turrets,
  },
  { key: "base", group: "terrain", positions: bothSides([10, 90]), source: SOURCES.turrets },
  // Lane labels sit where no turret is in the way: the neutral corners and the centre.
  { key: "exp-lane", group: "lane", positions: [shared(9, 9)], source: SOURCES.map },
  { key: "mid-lane", group: "lane", positions: [shared(50, 50)], source: SOURCES.map },
  { key: "gold-lane", group: "lane", positions: [shared(91, 91)], source: SOURCES.map },
];

/** Lane paths: each one is its own mirror image, drawn from our base to theirs. */
export const LANE_PATHS = {
  exp: "M 10 88 L 9 14 Q 9 9 14 9 L 88 10",
  mid: "M 12 88 L 88 12",
  gold: "M 12 90 L 86 91 Q 91 91 91 86 L 90 12",
} as const;

/** Terrain blocks of our half, [x, y, width, height]; the enemy half is their mirror image. */
export const TERRAIN_BLOCKS: readonly [number, number, number, number][] = [
  [14, 44, 4, 8],
  [24, 63, 6, 5],
  [33, 58, 8, 4],
  [44, 73, 9, 4],
  [55, 83, 4, 6],
  [16, 30, 5, 4],
];
