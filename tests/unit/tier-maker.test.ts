import { describe, expect, it } from "vitest";
import {
  addRow,
  changeOfRow,
  colorText,
  shift,
  decodeTier,
  deserialize,
  encodeTier,
  stateDefault,
  MAX_ROWS,
  editRow,
  place,
  prefill,
  serialize,
  deleteRow,
  type StateTier,
} from "@/lib/tier-maker";
import { allHeroes } from "@/lib/data";

const slugs = allHeroes.map((h) => h.slug);
const known = new Set(slugs);

/** Liste complete : les 133 heros repartis sur six rangees, titre et noms accentues. */
function listFull(): StateTier {
  const state = stateDefault("Ma tier list — été 🔥");
  return {
    ...state,
    rows: state.rows.map((r, i) => ({
      ...r,
      name: i === 0 ? "Dieux ✨" : r.name,
      heroes: slugs.filter((_, k) => k % state.rows.length === i),
    })),
  };
}

describe("link sharing", () => {
  it("round-trips, compressed or not", async () => {
    const state = editRow(listFull(), "d2", { color: "#123ABC" });
    for (const compress of [true, false]) {
      const code = await encodeTier(state, compress);
      expect(code).toMatch(/^[12][A-Za-z0-9_-]+$/);
      const reread = await decodeTier(code, known);
      expect(reread && serialize(reread)).toBe(serialize(state));
      expect(reread?.rows[2].color).toBe("#123abc");
    }
  });

  it("fits a full list in under a kilobyte thanks to compression", async () => {
    const code = await encodeTier(listFull());
    expect(code[0]).toBe("2");
    expect(code.length).toBeLessThan(1024);
    expect(code.length).toBeLessThan((await encodeTier(listFull(), false)).length);
  });

  it("always takes the shortest code, raw when compression gains nothing", async () => {
    const lowercase: StateTier = { title: "", rows: [{ id: "x", name: "S", color: "#ff5a5f", heroes: ["aamon"] }] };
    const code = await encodeTier(lowercase);
    expect(code[0]).toBe("1");
    expect((await decodeTier(code, known))?.rows[0]).toMatchObject({ name: "S", heroes: ["aamon"] });
    const defaultCode = await encodeTier(stateDefault());
    expect(defaultCode.length).toBeLessThanOrEqual((await encodeTier(stateDefault(), false)).length);
    expect((await decodeTier(defaultCode, known))?.rows.map((r) => r.name)).toEqual(["S+", "S", "A", "B", "C", "D"]);
  });

  it("rejects an unreadable link without throwing", async () => {
    for (const code of ["", "3abc", "2!!!", "1a", "2AAAA", `1${"A".repeat(20_000)}`]) {
      expect(await decodeTier(code, known)).toBeNull();
    }
    const truncated = (await encodeTier(listFull())).slice(0, 60);
    expect(await decodeTier(truncated, known)).toBeNull();
  });

  it("drops unknown heroes, duplicates and invalid colors, and caps the rows", () => {
    const text = [
      "Titre",
      "S\tzzzzzz\taamon,inconnu,aamon,akai",
      "A\tff0000\takai,alice",
      ...Array.from({ length: 20 }, (_, i) => `R${i}\t00ff00\t`),
    ].join("\n");
    const state = deserialize(text, known)!;
    expect(state.rows).toHaveLength(MAX_ROWS);
    expect(state.rows[0]).toMatchObject({ color: "#94a3b8", heroes: ["aamon", "akai"] });
    expect(state.rows[1].heroes).toEqual(["alice"]);
    expect(deserialize("seulement un titre", known)).toBeNull();
  });
});

describe("operations", () => {
  it("places, inserts before a hero, moves and returns to the pool", () => {
    let state = place(stateDefault(), "aamon", "d0");
    state = place(state, "akai", "d0");
    state = place(state, "alice", "d0", "akai");
    expect(state.rows[0].heroes).toEqual(["aamon", "alice", "akai"]);
    state = place(state, "akai", "d0", "aamon");
    expect(state.rows[0].heroes).toEqual(["akai", "aamon", "alice"]);
    state = shift(state, "akai", 1);
    expect(state.rows[0].heroes).toEqual(["aamon", "akai", "alice"]);
    expect(shift(state, "aamon", -1)).toEqual(state);
    state = changeOfRow(state, "alice", 1);
    expect(state.rows[1].heroes).toEqual(["alice"]);
    state = place(state, "alice", null);
    expect(state.rows.flatMap((r) => r.heroes)).toEqual(["aamon", "akai"]);
  });

  it("deletes a row (its heroes go back to the pool) but never the last one", () => {
    let state = place(stateDefault(), "aamon", "d1");
    state = deleteRow(state, "d1");
    expect(state.rows.map((r) => r.id)).toEqual(["d0", "d2", "d3", "d4", "d5"]);
    expect(state.rows.flatMap((r) => r.heroes)).toEqual([]);
    let single: StateTier = { title: "", rows: [state.rows[0]] };
    single = deleteRow(single, "d0");
    expect(single.rows).toHaveLength(1);
    const full = Array.from({ length: 10 }, (_, i) => i).reduce((e, i) => addRow(e, `n${i}`, "N"), stateDefault());
    expect(full.rows).toHaveLength(MAX_ROWS);
  });

  it("prefills from the computed tiers, D empty", () => {
    const state = prefill(slugs, [[0, 1], [2], [], [3], [4, 999]], "Méta");
    expect(state.title).toBe("Méta");
    expect(state.rows.map((r) => r.heroes)).toEqual([
      [slugs[0], slugs[1]], [slugs[2]], [], [slugs[3]], [slugs[4]], [],
    ]);
  });

  it("picks readable text on each background", () => {
    expect(colorText("#ffd166")).toBe("#0a0e1a");
    expect(colorText("#1c2742")).toBe("#ffffff");
  });
});
