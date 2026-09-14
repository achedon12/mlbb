import { describe, expect, it } from "vitest";
import {
  pathCurve,
  pathStatistics,
  encodeRow,
  encodeList,
  decodeRow,
  decodeList,
  scaleCurve,
  LANES,
  ROLES,
  writeState,
  STATE_DEFAULT,
  filterRows,
  formatterRate,
  heroIcon,
  readState,
  orderInitial,
  POINTS_CURVE,
  sortRows,
  type RowStat,
} from "@/lib/statistics-table";

const row = (slug: string, p: Partial<RowStat> = {}): RowStat => ({
  slug,
  name: slug[0]!.toUpperCase() + slug.slice(1),
  roles: ["Mage"],
  lanes: ["Mid"],
  tier: "A",
  score: 51,
  win: 50,
  ban: 1,
  pick: 1,
  ...p,
});

const ROWS: RowStat[] = [
  row("zilong", {
    roles: ["Fighter", "Assassin"],
    lanes: ["Exp", "Jungle"],
    score: 50.8,
    win: 50.8,
    ban: 0.1,
    pick: 1,
    gap: 0,
    days: 6,
  }),
  row("aamon", {
    roles: ["Assassin"],
    lanes: ["Jungle"],
    tier: "S",
    score: 54,
    win: 52,
    ban: 10,
    pick: 2,
    gap: 0.5,
    days: 7,
  }),
  row("chang-e", { name: "Chang'e", tier: "B", score: 49, win: 49, ban: 0.5, pick: 3, gap: -1.2, days: 7 }),
  row("eudora", { score: 51, win: 51, ban: 0.2, pick: 5 }),
];
const slugs = (l: RowStat[]) => l.map((x) => x.slug);

describe("table sorting", () => {
  it("starts from win rate, highest to lowest", () => {
    expect(slugs(sortRows(ROWS, STATE_DEFAULT.sort, STATE_DEFAULT.order))).toEqual(["aamon", "eudora", "zilong", "chang-e"]);
  });

  it("reverses the direction on request", () => {
    expect(slugs(sortRows(ROWS, "win", "asc"))).toEqual(["chang-e", "zilong", "eudora", "aamon"]);
  });

  it("sorts names alphabetically", () => {
    expect(slugs(sortRows(ROWS, "name", "asc"))).toEqual(["aamon", "chang-e", "eudora", "zilong"]);
    expect(slugs(sortRows(ROWS, "name", "desc"))).toEqual(["zilong", "eudora", "chang-e", "aamon"]);
  });

  it("sorts by tier, then by score within a tier", () => {
    expect(slugs(sortRows(ROWS, "tier", "desc"))).toEqual(["aamon", "eudora", "zilong", "chang-e"]);
  });

  it("sorts ban and pick", () => {
    expect(slugs(sortRows(ROWS, "ban", "desc"))).toEqual(["aamon", "chang-e", "eudora", "zilong"]);
    expect(slugs(sortRows(ROWS, "pick", "desc"))).toEqual(["eudora", "chang-e", "aamon", "zilong"]);
  });

  it("keeps heroes without a measured gap at the end of the list, in both directions", () => {
    expect(slugs(sortRows(ROWS, "trend", "desc"))).toEqual(["aamon", "zilong", "chang-e", "eudora"]);
    expect(slugs(sortRows(ROWS, "trend", "asc"))).toEqual(["chang-e", "zilong", "aamon", "eudora"]);
  });

  it("breaks ties by name, whatever the input order", () => {
    const equal = [row("miya", { win: 50 }), row("layla", { win: 50 })];
    expect(slugs(sortRows(equal, "win", "desc"))).toEqual(["layla", "miya"]);
    expect(slugs(sortRows([...equal].reverse(), "win", "asc"))).toEqual(["layla", "miya"]);
  });

  it("does not modify the rows it receives", () => {
    const before = slugs(ROWS);
    sortRows(ROWS, "name", "desc");
    expect(slugs(ROWS)).toEqual(before);
  });

  it("starts alphabetically for the name, strongest to weakest elsewhere", () => {
    expect(orderInitial("name")).toBe("asc");
    expect(orderInitial("ban")).toBe("desc");
  });
});

describe("table filters", () => {
  const empty = { role: null, lane: null, search: "" };

  it("keeps everything without a filter", () => {
    expect(filterRows(ROWS, empty)).toHaveLength(ROWS.length);
  });

  it("filters by role and by lane, combined", () => {
    expect(slugs(filterRows(ROWS, { ...empty, role: "Assassin" }))).toEqual(["zilong", "aamon"]);
    expect(slugs(filterRows(ROWS, { ...empty, role: "Assassin", lane: "Exp" }))).toEqual(["zilong"]);
  });

  it("searches ignoring case and accents", () => {
    expect(slugs(filterRows(ROWS, { ...empty, search: "  CHANG" }))).toEqual(["chang-e"]);
    expect(slugs(filterRows(ROWS, { ...empty, search: "éudo" }))).toEqual(["eudora"]);
  });
});

describe("state in the URL", () => {
  it("reads a full state", () => {
    expect(readState(new URLSearchParams("tri=ban&ordre=asc&role=Mage&lane=Jungle&q=aa"))).toEqual({
      sort: "ban",
      order: "asc",
      role: "Mage",
      lane: "Jungle",
      search: "aa",
    });
  });

  it("ignores unknown values, and takes the column's first direction", () => {
    expect(readState(new URLSearchParams("tri=bidon&role=Chef&lane=Plage"))).toEqual(STATE_DEFAULT);
    expect(readState(new URLSearchParams("tri=nom")).order).toBe("asc");
  });

  it("does not write default values: the unfiltered table keeps its bare address", () => {
    expect(writeState(STATE_DEFAULT).toString()).toBe("");
    expect(writeState({ ...STATE_DEFAULT, sort: "ban" }).toString()).toBe("tri=ban");
    expect(writeState({ ...STATE_DEFAULT, order: "asc", search: " x " }).toString()).toBe("ordre=asc&q=x");
  });

  it("keeps other parameters and round-trips", () => {
    const state = { sort: "pick", order: "asc", role: "Tank", lane: "Roam", search: "ti" } as const;
    const params = writeState(state, new URLSearchParams("source=menu&role=Mage"));
    expect(params.get("source")).toBe("menu");
    expect(readState(params)).toEqual(state);
  });

  it("gives the address of each rank and the icon of each hero", () => {
    expect(pathStatistics("all")).toBe("/statistics");
    expect(pathStatistics("mythic")).toBe("/statistics/mythic");
    expect(heroIcon("aamon")).toBe("/visuels/heros/aamon/icone.png");
  });
});

describe("sparkline", () => {
  it("draws nothing below two measured points", () => {
    expect(scaleCurve([])).toBeNull();
    expect(scaleCurve([50])).toBeNull();
    expect(scaleCurve([50, 50, null, null], 2)).toBeNull();
  });

  it("sums up thirty days in fifteen points, from the bottom to the top of the frame", () => {
    const values = Array.from({ length: 30 }, (_, i) => 50 + i * 0.1);
    const points = scaleCurve(values)!.split(" ");
    expect(points).toHaveLength(POINTS_CURVE);
    expect(points[0]).toBe("19");
    expect(points.at(-1)).toBe("1");
    expect(points.map(Number)).toEqual([...points.map(Number)].sort((a, b) => b - a));
  });

  it("keeps a stable rate flat, in the middle of the frame", () => {
    expect(scaleCurve(Array(30).fill(50))).toBe(Array(POINTS_CURVE).fill("10").join(" "));
  });

  it("marks a slice without measurements with a dash", () => {
    expect(scaleCurve([48, 48, null, null, 52, 52], 3)).toBe("19 - 1");
  });

  it("draws without 'L' and breaks the line on a dash", () => {
    expect(pathCurve("19 10 1")).toBe("M0 19 1 10 2 1");
    expect(pathCurve("5 - 7 8")).toBe("M0 5M2 7 3 8");
  });
});

describe("compact rows", () => {
  it("encodes roles and lanes as digits, in their order", () => {
    expect(encodeList(["Fighter", "Assassin"], ROLES)).toBe(23);
    expect(decodeList(23, ROLES)).toEqual(["Fighter", "Assassin"]);
    expect(decodeList(encodeList(["Assassin", "Fighter"], ROLES), ROLES)).toEqual(["Assassin", "Fighter"]);
    expect(encodeList([], LANES)).toBe(0);
    expect(decodeList(0, LANES)).toEqual([]);
  });

  it("round-trips a row, missing fields included", () => {
    for (const l of ROWS) expect(decodeRow(encodeRow(l))).toEqual(l);
    const complete = row("miya", { weak: true, curve: "10 9 - 8", start: 50.1, end: 49.8, gap: -0.3, days: 6 });
    expect(decodeRow(encodeRow(complete))).toEqual(complete);
  });
});

describe("rate format", () => {
  it("follows the language", () => {
    expect(formatterRate("en")(52.44)).toBe("52.4%");
    expect(formatterRate("fr")(52.44)).toMatch(/^52,4\s%$/u);
  });
});
