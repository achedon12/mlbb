import { describe, expect, it } from "vitest";
import { createTFrom } from "@/i18n/t";
import {
  alignSeries,
  shiftDate,
  describeGap,
  isNotable,
  formatGap,
  impactPatch,
  heroImpacts,
  impactsOfPatch,
  daysBetween,
  movesWeek,
  plural,
  pointsOf,
  variationWeek,
  verdictImpact,
  type WinStreak,
} from "@/lib/trends";

/** 30-day series starting on 11 August 2026. */
const series = (winRate: (number | null)[], start = "2026-08-11"): WinStreak => ({ start, winRate });
const constant = (v: number, n = 30): (number | null)[] => Array.from({ length: n }, () => v);

describe("dates", () => {
  it("shifts a date across a month change", () => {
    expect(shiftDate("2026-08-30", 3)).toBe("2026-09-02");
    expect(shiftDate("2026-09-02", -3)).toBe("2026-08-30");
  });

  it("counts the days between two dates, both ways", () => {
    expect(daysBetween("2026-08-11", "2026-09-09")).toBe(29);
    expect(daysBetween("2026-09-09", "2026-08-11")).toBe(-29);
  });

  it("dates each point of a series", () => {
    expect(pointsOf("2026-08-31", [50, null])).toEqual([
      { date: "2026-08-31", value: 50 },
      { date: "2026-09-01", value: null },
    ]);
  });
});

describe("variationWeek", () => {
  it("compares the latest measurement with the one from D-7", () => {
    const v = constant(50);
    v[22] = 49.9;
    v[29] = 50.6;
    const r = variationWeek(series(v));
    expect(r).toEqual({ current: 50.6, before: 49.9, gap: 0.7, days: 7, date: "2026-09-09" });
  });

  it("takes D-8 when D-7 is missing, then D-6", () => {
    const v = constant(50);
    v[22] = null;
    v[21] = 49;
    v[23] = 48;
    expect(variationWeek(series(v))).toMatchObject({ before: 49, days: 8 });
    v[21] = null;
    expect(variationWeek(series(v))).toMatchObject({ before: 48, days: 6 });
  });

  it("ignores missing latest days, up to three", () => {
    const v = constant(50);
    v[29] = v[28] = v[27] = null;
    v[26] = 51;
    expect(variationWeek(series(v))).toMatchObject({ current: 51, gap: 1, date: "2026-09-06" });
    v[26] = null;
    expect(variationWeek(series(v))).toBeNull();
  });

  it("refuses a reference too far from D-7", () => {
    const v: (number | null)[] = Array.from({ length: 30 }, () => null);
    v[29] = 51;
    v[28] = 51;
    v[27] = 51;
    v[26] = 51;
    v[19] = 50; // D-10: outside tolerance
    expect(variationWeek(series(v))).toBeNull();
  });

  it("requires at least four measurements between the two bounds", () => {
    const v: (number | null)[] = Array.from({ length: 30 }, () => null);
    v[29] = 51;
    v[25] = 50.5;
    v[22] = 50;
    expect(variationWeek(series(v))).toBeNull();
    v[24] = 50.2;
    expect(variationWeek(series(v))).toMatchObject({ gap: 1 });
  });

  it("returns nothing without a series", () => {
    expect(variationWeek(undefined)).toBeNull();
    expect(variationWeek(null)).toBeNull();
    expect(variationWeek(series([]))).toBeNull();
  });
});

describe("isNotable", () => {
  const withGap = (gap: number) => ({ current: 50, before: 50 - gap, gap, days: 7, date: "2026-09-09" });
  it("filters out rounding noise", () => {
    expect(isNotable(withGap(0.1))).toBe(false);
    expect(isNotable(withGap(-0.1))).toBe(false);
    expect(isNotable(withGap(0.2))).toBe(true);
    expect(isNotable(withGap(-0.2))).toBe(true);
    expect(isNotable(null)).toBe(false);
  });
});

describe("movesWeek", () => {
  const withGap = (gap: number, current = 50) => {
    const v = constant(current - gap);
    v[29] = current;
    return series(v);
  };

  it("sorts rises and drops, and leaves out the rest", () => {
    const r = movesWeek(
      [
        { slug: "a", series: withGap(0.5) },
        { slug: "b", series: withGap(1.2) },
        { slug: "c", series: withGap(-0.8) },
        { slug: "d", series: withGap(0.1) },
        { slug: "e", series: null },
        { slug: "f", series: withGap(-0.3) },
      ],
      5,
    );
    expect(r.rises.map((m) => m.slug)).toEqual(["b", "a"]);
    expect(r.drops.map((m) => m.slug)).toEqual(["c", "f"]);
  });

  it("caps each list and breaks ties", () => {
    const entries = [
      { slug: "zed", series: withGap(0.4, 52) },
      { slug: "ana", series: withGap(0.4, 52) },
      { slug: "bob", series: withGap(0.4, 53) },
      { slug: "cid", series: withGap(0.3) },
    ];
    expect(movesWeek(entries, 3).rises.map((m) => m.slug)).toEqual(["bob", "ana", "zed"]);
    expect(movesWeek([...entries].reverse(), 3).rises.map((m) => m.slug)).toEqual(["bob", "ana", "zed"]);
  });
});

describe("impactPatch", () => {
  // History from 1 to 30 September; patch on the 15th (index 14).
  const beforeAfter = (before: number, after: number, dayPatch = 99) =>
    series(Array.from({ length: 30 }, (_, k) => (k === 14 ? dayPatch : k < 14 ? before : after)), "2026-09-01");

  it("compares the seven-day averages before and after, excluding the patch day", () => {
    const r = impactPatch(beforeAfter(50, 51.2), "2026-09-15");
    expect(r).toEqual({ before: 50, after: 51.2, gap: 1.2, daysBefore: 7, daysAfter: 7 });
  });

  it("only looks at seven days on each side", () => {
    const h = beforeAfter(50, 49);
    h.winRate[0] = 10; // D-14: outside the window
    h.winRate[29] = 90; // D+15: outside the window
    expect(impactPatch(h, "2026-09-15")).toMatchObject({ before: 50, after: 49, gap: -1 });
  });

  it("requires four measured days on each side", () => {
    const h = beforeAfter(50, 51);
    for (const k of [7, 8, 9, 10]) h.winRate[k] = null; // leaves D-3, D-2, D-1
    expect(impactPatch(h, "2026-09-15")).toBeNull();
    h.winRate[10] = 50;
    expect(impactPatch(h, "2026-09-15")).toMatchObject({ daysBefore: 4, gap: 1 });
  });

  it("returns nothing when the history starts after the patch", () => {
    // The current situation: history since 11 August 2026, last patch on 18 June.
    expect(impactPatch(series(constant(50)), "2026-06-18")).toBeNull();
    // Patch too recent: fewer than four measured days after it.
    expect(impactPatch(series(constant(50)), "2026-09-07")).toBeNull();
  });

  it("returns nothing without history or date", () => {
    expect(impactPatch(null, "2026-09-15")).toBeNull();
    expect(impactPatch(beforeAfter(50, 51), null)).toBeNull();
    expect(impactPatch(beforeAfter(50, 51), "pas une date")).toBeNull();
  });
});

describe("verdictImpact", () => {
  it("tells whether the patch worked in the announced direction", () => {
    expect(verdictImpact("nerf", -1.1)).toBe("expected");
    expect(verdictImpact("nerf", 0.8)).toBe("opposite");
    expect(verdictImpact("buff", 0.3)).toBe("expected");
    expect(verdictImpact("buff", -0.5)).toBe("opposite");
    expect(verdictImpact("buff", 0.2)).toBe("neutral");
    expect(verdictImpact("adjust", 2)).toBeNull();
    expect(verdictImpact(null, 2)).toBeNull();
  });
});

describe("heroImpacts and impactsOfPatch", () => {
  const h = series(
    Array.from({ length: 30 }, (_, k) => (k < 14 ? 52 : 50.5)),
    "2026-09-01",
  );

  it("measures a hero's dated patches and ignores the others", () => {
    const r = heroImpacts(h, [
      { version: "2.1.90", date: "2026-09-15", type: "nerf" },
      { version: "2.1.89", date: null, type: "buff" },
      { version: "2.1.88", date: "2026-06-18", type: "buff" },
    ]);
    expect(r).toEqual([
      {
        version: "2.1.90",
        date: "2026-09-15",
        type: "nerf",
        verdict: "expected",
        before: 52,
        after: 50.5,
        gap: -1.5,
        daysBefore: 7,
        daysAfter: 7,
      },
    ]);
  });

  it("annotates a patch hero by hero", () => {
    const patch = {
      version: "2.1.90",
      date: "2026-09-15",
      adjustments: [
        { slug: "chip", type: "nerf" as const },
        { slug: "sans-historique", type: "buff" as const },
      ],
    };
    const r = impactsOfPatch(patch, (slug) => (slug === "chip" ? h : null));
    expect(Object.keys(r)).toEqual(["chip"]);
    expect(r.chip).toMatchObject({ gap: -1.5, verdict: "expected" });
    expect(impactsOfPatch({ ...patch, date: null }, () => h)).toEqual({});
  });
});

describe("alignSeries", () => {
  it("aligns two offset series on the union of their days", () => {
    const r = alignSeries([
      { start: "2026-08-30", values: [1, 2, 3] },
      { start: "2026-08-31", values: [4, null, 6] },
    ]);
    expect(r.dates).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
    expect(r.values).toEqual([
      [1, 2, 3, null],
      [null, 4, null, 6],
    ]);
  });

  it("keeps the slot of an empty series", () => {
    const r = alignSeries([{ start: "2026-09-01", values: [1] }, { start: "2026-01-01", values: [] }]);
    expect(r).toEqual({ dates: ["2026-09-01"], values: [[1], [null]] });
    expect(alignSeries([])).toEqual({ dates: [], values: [] });
  });
});

describe("display", () => {
  it("signs the gap in the language's format", () => {
    expect(formatGap(0.7, "fr")).toBe("+0,7");
    expect(formatGap(-0.3, "en")).toBe("-0.3");
    expect(formatGap(0, "fr")).toBe("0,0");
    expect(formatGap(1.25, "it", 2)).toBe("+1,25");
  });

  it("inflects the unit according to the language", () => {
    expect(plural(0.7, "fr")).toBe("one");
    expect(plural(-1.5, "fr")).toBe("one");
    expect(plural(2, "fr")).toBe("other");
    expect(plural(0.7, "en")).toBe("other");
    expect(plural(0.7, "es")).toBe("other");
  });

  it("describes the gap in words", () => {
    const t = createTFrom({
      trends: {
        rise: "en hausse de {v} {unite} en {n} jours",
        fall: "en baisse de {v} {unite} en {n} jours",
        point: { one: "point", other: "points" },
      },
    });
    expect(describeGap(t, "fr", 0.7, 7)).toBe("en hausse de 0,7 point en 7 jours");
    expect(describeGap(t, "fr", -2.3, 6)).toBe("en baisse de 2,3 points en 6 jours");
  });
});
