import { decodeText, encodeText } from "./link-code";

/**
 * Strategy planner: the plan drawn over the map, its edit history and its
 * link.
 *
 * A plan is a list of elements on a 1000 x 1000 board (the map's 100 x 100
 * plan, at a tenth of a unit): heroes of both teams, objective markers,
 * arrows, freehand lines and text labels. Every operation returns a new
 * plan; the history keeps the previous ones for undo and redo.
 *
 * The link carries the whole plan after `#plan=`, never sent to a server: a
 * short text (one element per line, numbers only, lines as deltas), then
 * compressed and base64url by `link-code`. Pure module, no data: the page
 * passes the roster, and the tests run without it.
 */

export const BOARD = 1000;
export type Team = "blue" | "red";
export const TEAMS: readonly Team[] = ["blue", "red"];

/** Objectives that can be marked, under their `/map` key. */
export const MARKERS = ["turtle", "lord", "purple-buff", "orange-buff"] as const;
export type MarkerKey = (typeof MARKERS)[number];

/** Pen colours, by index in the link. The first one is the default. */
export const COLORS = ["#f5c451", "#eef2fb", "#4da3ff", "#f87171", "#4ade80", "#c084fc"] as const;
export type ColorIndex = number;

export type Element =
  | { kind: "hero"; id: number; slug: string; team: Team; x: number; y: number }
  | { kind: "marker"; id: number; marker: MarkerKey; x: number; y: number }
  | { kind: "text"; id: number; color: ColorIndex; x: number; y: number; text: string }
  | { kind: "arrow"; id: number; color: ColorIndex; from: Point; to: Point }
  | { kind: "line"; id: number; color: ColorIndex; points: Point[] };

export type Point = [x: number, y: number];

export interface Plan {
  elements: Element[];
}

export const EMPTY_PLAN: Plan = { elements: [] };

/** Limits that keep a link short enough to share and a bad link harmless. */
export const LIMITS = { elements: 200, points: 400, text: 40 };
const CODE_MAX = 24_000;
const TEXT_MAX = 80_000;

const clampBoard = (v: number) => Math.max(0, Math.min(BOARD, Math.round(v)));
const nextId = (plan: Plan) => plan.elements.reduce((m, e) => Math.max(m, e.id), 0) + 1;
export const cleanText = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, LIMITS.text);

// -- Operations ---------------------------------------------------------

/** Distributive omit: each element kind keeps its own fields. */
type WithoutId<E> = E extends Element ? Omit<E, "id"> : never;

/** Adds an element; its id is returned with the plan. Past the limit, nothing changes. */
export function add(plan: Plan, element: WithoutId<Element>): { plan: Plan; id: number | null } {
  if (plan.elements.length >= LIMITS.elements) return { plan, id: null };
  const id = nextId(plan);
  return { plan: { elements: [...plan.elements, normalize({ ...element, id } as Element)] }, id };
}

export function remove(plan: Plan, id: number): Plan {
  return { elements: plan.elements.filter((e) => e.id !== id) };
}

/** Moves an element by (dx, dy), kept inside the board. A line or an arrow moves whole. */
export function move(plan: Plan, id: number, dx: number, dy: number): Plan {
  return {
    elements: plan.elements.map((e) => {
      if (e.id !== id) return e;
      if (e.kind === "line") {
        const xs = e.points.map(([x]) => x);
        const ys = e.points.map(([, y]) => y);
        const [mx, my] = boundedShift(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), dx, dy);
        return { ...e, points: e.points.map(([x, y]) => [x + mx, y + my] as Point) };
      }
      if (e.kind === "arrow") {
        const [mx, my] = boundedShift(
          Math.min(e.from[0], e.to[0]),
          Math.max(e.from[0], e.to[0]),
          Math.min(e.from[1], e.to[1]),
          Math.max(e.from[1], e.to[1]),
          dx,
          dy,
        );
        return { ...e, from: [e.from[0] + mx, e.from[1] + my], to: [e.to[0] + mx, e.to[1] + my] };
      }
      return { ...e, x: clampBoard(e.x + dx), y: clampBoard(e.y + dy) };
    }),
  };
}

/** The largest part of (dx, dy) that keeps a box inside the board. */
function boundedShift(minX: number, maxX: number, minY: number, maxY: number, dx: number, dy: number): Point {
  const mx = Math.round(Math.max(-minX, Math.min(BOARD - maxX, dx)));
  const my = Math.round(Math.max(-minY, Math.min(BOARD - maxY, dy)));
  return [mx, my];
}

/** Recolours a drawing or a label; heroes and markers keep theirs. */
export function recolor(plan: Plan, id: number, color: ColorIndex): Plan {
  return {
    elements: plan.elements.map((e) => (e.id === id && "color" in e ? { ...e, color: validColor(color) } : e)),
  };
}

const validColor = (c: number) => (Number.isInteger(c) && c >= 0 && c < COLORS.length ? c : 0);

function normalize(e: Element): Element {
  switch (e.kind) {
    case "line":
      return { ...e, color: validColor(e.color), points: simplify(e.points.map(([x, y]) => [clampBoard(x), clampBoard(y)])) };
    case "arrow":
      return {
        ...e,
        color: validColor(e.color),
        from: [clampBoard(e.from[0]), clampBoard(e.from[1])],
        to: [clampBoard(e.to[0]), clampBoard(e.to[1])],
      };
    case "text":
      return { ...e, color: validColor(e.color), x: clampBoard(e.x), y: clampBoard(e.y), text: cleanText(e.text) };
    default:
      return { ...e, x: clampBoard(e.x), y: clampBoard(e.y) };
  }
}

/**
 * Ramer-Douglas-Peucker: drops the points that stray less than `tolerance`
 * from the stroke, then keeps at most `LIMITS.points`. A finger gives
 * hundreds of points a second; a dozen draw the same curve.
 */
export function simplify(points: Point[], tolerance = 4): Point[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i], points[a], points[b]);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (worst > tolerance && index > 0) {
      keep[index] = true;
      stack.push([a, index], [index, b]);
    }
  }
  const out = points.filter((_, i) => keep[i]);
  if (out.length <= LIMITS.points) return out;
  const step = (out.length - 1) / (LIMITS.points - 1);
  return Array.from({ length: LIMITS.points }, (_, i) => out[Math.round(i * step)]);
}

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// -- History ------------------------------------------------------------

export interface History {
  past: Plan[];
  present: Plan;
  future: Plan[];
}

/** Steps kept for undo: enough for a session, bounded for memory. */
export const HISTORY_MAX = 100;

export const historyOf = (plan: Plan): History => ({ past: [], present: plan, future: [] });

/** Records a new plan; an unchanged plan records nothing, and redo is lost once you edit. */
export function commit(h: History, plan: Plan): History {
  if (plan === h.present) return h;
  return { past: [...h.past, h.present].slice(-HISTORY_MAX), present: plan, future: [] };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

// -- Link ---------------------------------------------------------------

/**
 * One line per element, fields separated by commas:
 * `h,slug,b|r,x,y` · `m,key,x,y` · `t,color,x,y,text` · `a,color,x1,y1,x2,y2`
 * · `l,color,x0,y0,dx1,dy1,…`. The text is percent-encoded, so it carries no
 * comma or line break; the first line is the format version.
 */
const VERSION = "p1";

export function serialize(plan: Plan): string {
  const lines = plan.elements.map((e) => {
    switch (e.kind) {
      case "hero":
        return `h,${e.slug},${e.team[0]},${e.x},${e.y}`;
      case "marker":
        return `m,${e.marker},${e.x},${e.y}`;
      case "text":
        return `t,${e.color},${e.x},${e.y},${encodeURIComponent(e.text)}`;
      case "arrow":
        return `a,${e.color},${e.from[0]},${e.from[1]},${e.to[0]},${e.to[1]}`;
      case "line": {
        const [first, ...rest] = e.points;
        const deltas = rest.map((p, i) => `${p[0] - e.points[i][0]},${p[1] - e.points[i][1]}`);
        return [`l,${e.color},${first[0]},${first[1]}`, ...deltas].join(",");
      }
    }
  });
  return [VERSION, ...lines].join("\n");
}

const int = (s: string | undefined) => (s !== undefined && /^-?\d{1,4}$/.test(s) ? Number(s) : null);

/**
 * Reads a plan back without trusting the link: unknown heroes, markers and
 * kinds dropped, coordinates kept on the board, a hero once per team, sizes
 * capped. Null when the text is not a plan at all.
 */
export function deserialize(text: string, known: Set<string>): Plan | null {
  const [version, ...lines] = text.split("\n");
  if (version !== VERSION) return null;
  let plan: Plan = EMPTY_PLAN;
  const heroes = new Set<string>();
  for (const line of lines.slice(0, LIMITS.elements)) {
    const f = line.split(",");
    let element: WithoutId<Element> | null = null;
    if (f[0] === "h" && f.length === 5) {
      const team: Team | null = f[2] === "b" ? "blue" : f[2] === "r" ? "red" : null;
      const [x, y] = [int(f[3]), int(f[4])];
      if (known.has(f[1]) && team && x !== null && y !== null && !heroes.has(`${team}:${f[1]}`)) {
        heroes.add(`${team}:${f[1]}`);
        element = { kind: "hero", slug: f[1], team, x, y };
      }
    } else if (f[0] === "m" && f.length === 4) {
      const marker = MARKERS.find((m) => m === f[1]);
      const [x, y] = [int(f[2]), int(f[3])];
      if (marker && x !== null && y !== null) element = { kind: "marker", marker, x, y };
    } else if (f[0] === "t" && f.length === 5) {
      const [color, x, y] = [int(f[1]), int(f[2]), int(f[3])];
      let label = "";
      try {
        label = cleanText(decodeURIComponent(f[4]));
      } catch {
        label = "";
      }
      if (color !== null && x !== null && y !== null && label) element = { kind: "text", color, x, y, text: label };
    } else if (f[0] === "a" && f.length === 6) {
      const n = f.slice(1).map(int);
      if (n.every((v) => v !== null)) {
        const [color, x1, y1, x2, y2] = n as number[];
        element = { kind: "arrow", color, from: [x1, y1], to: [x2, y2] };
      }
    } else if (f[0] === "l" && f.length >= 6 && f.length % 2 === 0) {
      const n = f.slice(1, 2 + 2 * LIMITS.points).map(int);
      if (n.every((v) => v !== null)) {
        const [color, x0, y0, ...deltas] = n as number[];
        const points: Point[] = [[x0, y0]];
        for (let i = 0; i + 1 < deltas.length; i += 2) {
          const [px, py] = points[points.length - 1];
          points.push([px + deltas[i], py + deltas[i + 1]]);
        }
        element = { kind: "line", color, points };
      }
    }
    if (element) plan = add(plan, element).plan;
  }
  return plan;
}

/** Fragment parameter of the plan; the rest of the fragment is left alone. */
export const HASH_KEY = "plan";

export async function encodePlan(plan: Plan, compress = true): Promise<string> {
  return encodeText(serialize(plan), compress);
}

export async function decodePlan(code: string, known: Set<string>): Promise<Plan | null> {
  const text = await decodeText(code, { codeMax: CODE_MAX, textMax: TEXT_MAX });
  return text === null ? null : deserialize(text, known);
}

/** The plan's code in a `#plan=…` fragment; null when there is none. */
export function readHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get(HASH_KEY);
}

/** Fragment for a code, the other fragment parameters kept; empty plan, no parameter. */
export function writeHash(hash: string, code: string | null): string {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (code) params.set(HASH_KEY, code);
  else params.delete(HASH_KEY);
  const out = params.toString();
  return out ? `#${out}` : "";
}

// -- Placement ----------------------------------------------------------

/**
 * Where a new hero lands: in front of its team's base, five spots in a row,
 * then a second row. Blue plays from the bottom left corner, as on the
 * player's screen; red from the top right, its mirror across the river.
 */
export function spawnPoint(team: Team, count: number): Point {
  const slot = count % 10;
  const i = slot % 5;
  const row = Math.floor(slot / 5);
  // Along the mid lane out of the base; the second row a step towards the EXP lane.
  const blue: Point = [170 + 60 * i - 70 * row, 860 - 60 * i - 70 * row];
  return team === "blue" ? blue : [blue[1], blue[0]];
}
