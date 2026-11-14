import { describe, expect, it } from "vitest";
import {
  add,
  BOARD,
  commit,
  decodePlan,
  deserialize,
  EMPTY_PLAN,
  encodePlan,
  historyOf,
  LIMITS,
  move,
  readHash,
  recolor,
  redo,
  remove,
  serialize,
  simplify,
  spawnPoint,
  undo,
  writeHash,
  type Plan,
  type Point,
} from "@/lib/strategy-plan";

const known = new Set(["aamon", "tigreal", "layla"]);

function sample(): Plan {
  let plan = EMPTY_PLAN;
  plan = add(plan, { kind: "hero", slug: "aamon", team: "blue", x: 200, y: 800 }).plan;
  plan = add(plan, { kind: "hero", slug: "aamon", team: "red", x: 800, y: 200 }).plan;
  plan = add(plan, { kind: "marker", marker: "turtle", x: 290, y: 290 }).plan;
  plan = add(plan, { kind: "text", color: 1, x: 500, y: 500, text: "Gank, then turtle; go!" }).plan;
  plan = add(plan, { kind: "arrow", color: 3, from: [100, 900], to: [450, 550] }).plan;
  plan = add(plan, { kind: "line", color: 4, points: [[100, 100], [300, 120], [600, 400]] }).plan;
  return plan;
}

describe("plan operations", () => {
  it("adds elements with increasing ids, keeps them on the board", () => {
    const { plan, id } = add(EMPTY_PLAN, { kind: "marker", marker: "lord", x: -40, y: 1400 });
    expect(id).toBe(1);
    expect(plan.elements[0]).toMatchObject({ x: 0, y: BOARD });
    expect(add(plan, { kind: "marker", marker: "lord", x: 1, y: 1 }).id).toBe(2);
  });

  it("stops at the element limit", () => {
    let plan = EMPTY_PLAN;
    for (let i = 0; i < LIMITS.elements; i++) plan = add(plan, { kind: "marker", marker: "turtle", x: i, y: i }).plan;
    const full = add(plan, { kind: "marker", marker: "turtle", x: 1, y: 1 });
    expect(full.id).toBeNull();
    expect(full.plan).toBe(plan);
  });

  it("moves a token, and a line or an arrow as a whole, without leaving the board", () => {
    const plan = sample();
    expect(move(plan, 1, 50, -900).elements[0]).toMatchObject({ x: 250, y: 0 });
    const arrow = move(plan, 5, -500, 0).elements[4];
    // The arrow's left end stops at the edge; its length is kept.
    expect(arrow).toMatchObject({ from: [0, 900], to: [350, 550] });
    const line = move(plan, 6, 10, 10).elements[5];
    expect(line).toMatchObject({ points: [[110, 110], [310, 130], [610, 410]] });
  });

  it("recolours drawings and labels only, removes by id", () => {
    const plan = sample();
    expect(recolor(plan, 4, 2).elements[3]).toMatchObject({ color: 2 });
    expect(recolor(plan, 1, 2).elements[0]).not.toHaveProperty("color");
    expect(recolor(plan, 4, 99).elements[3]).toMatchObject({ color: 0 });
    expect(remove(plan, 1).elements.map((e) => e.id)).toEqual([2, 3, 4, 5, 6]);
  });

  it("simplifies a stroke and caps its points", () => {
    const straight: Point[] = Array.from({ length: 50 }, (_, i) => [i * 10, i * 10]);
    expect(simplify(straight)).toEqual([[0, 0], [490, 490]]);
    const zigzag: Point[] = Array.from({ length: 2000 }, (_, i) => [i % 1000, i % 2 ? 0 : 1000]);
    expect(simplify(zigzag).length).toBe(LIMITS.points);
  });

  it("places new heroes in front of their base, red mirroring blue", () => {
    const [x, y] = spawnPoint("blue", 0);
    expect(x).toBeLessThan(BOARD / 2);
    expect(y).toBeGreaterThan(BOARD / 2);
    expect(spawnPoint("red", 3)).toEqual([...spawnPoint("blue", 3)].reverse());
    const spots = Array.from({ length: 10 }, (_, i) => spawnPoint("blue", i).join(","));
    expect(new Set(spots).size).toBe(10);
  });
});

describe("history", () => {
  it("undoes and redoes, and a new edit drops the redo branch", () => {
    const a = add(EMPTY_PLAN, { kind: "marker", marker: "lord", x: 1, y: 1 }).plan;
    const b = add(a, { kind: "marker", marker: "turtle", x: 2, y: 2 }).plan;
    let h = commit(commit(historyOf(EMPTY_PLAN), a), b);
    h = undo(h);
    expect(h.present).toBe(a);
    h = redo(h);
    expect(h.present).toBe(b);
    h = commit(undo(h), remove(a, 1));
    expect(h.future).toEqual([]);
    expect(undo(undo(undo(h))).present).toBe(EMPTY_PLAN);
    // Nothing to undo or redo: the history is returned as is.
    const start = historyOf(EMPTY_PLAN);
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
    expect(commit(start, start.present)).toBe(start);
  });
});

describe("link", () => {
  it("round-trips a plan through the text and the compressed code", async () => {
    const plan = sample();
    expect(deserialize(serialize(plan), known)).toEqual(plan);
    const code = await encodePlan(plan);
    expect(code).toMatch(/^[12][A-Za-z0-9_-]+$/);
    expect(await decodePlan(code, known)).toEqual(plan);
    expect(await decodePlan(await encodePlan(plan, false), known)).toEqual(plan);
  });

  it("keeps lines compact: deltas, not absolute points", () => {
    expect(serialize(sample()).split("\n").at(-1)).toBe("l,4,100,100,200,20,300,280");
  });

  it("does not trust the link", async () => {
    const text = [
      "p1",
      "h,ghost,b,1,1",
      "h,aamon,x,1,1",
      "h,layla,b,5,5",
      "h,layla,b,6,6",
      "m,dragon,1,1",
      "a,1,2,3",
      "t,0,1,1,%E0%A4%A",
      `t,0,1,1,${"x".repeat(200)}`,
      "l,0,1,1,abc,2",
      "a,0,-5,9999,3,3",
      "a,0,1,20000,3,3",
    ].join("\n");
    const plan = deserialize(text, known)!;
    expect(plan.elements.map((e) => e.kind)).toEqual(["hero", "text", "arrow"]);
    expect(plan.elements[1]).toMatchObject({ text: "x".repeat(LIMITS.text) });
    expect(plan.elements[2]).toMatchObject({ from: [0, BOARD] });
    expect(deserialize("v9\nh,aamon,b,1,1", known)).toBeNull();
    expect(await decodePlan("2!!!", known)).toBeNull();
    expect(await decodePlan("", known)).toBeNull();
  });

  it("reads and writes its fragment parameter, others kept", () => {
    expect(readHash("#plan=2abc")).toBe("2abc");
    expect(readHash("")).toBeNull();
    expect(writeHash("#x=1", "2abc")).toBe("#x=1&plan=2abc");
    expect(writeHash("#plan=2abc", null)).toBe("");
  });
});
