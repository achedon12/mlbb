import { describe, expect, it } from "vitest";
import { OTHER, periodOf, pivot, relativeChange, stackCommands } from "@/lib/bot/stats";

/** The admin panel's pure helpers: windows as whole buckets, deltas, stacked series. */

const NOW = new Date("2026-11-14T10:42:00Z");

describe("periodOf", () => {
  it("cuts 24 h into the last 24 whole hours, the current one included", () => {
    const p = periodOf("24h", NOW);
    expect(p.bucket).toBe("hour");
    expect(p.keys).toHaveLength(24);
    expect(p.keys[0]).toBe("2026-11-13T11");
    expect(p.keys.at(-1)).toBe("2026-11-14T10");
    expect(p.since.toISOString()).toBe("2026-11-13T11:00:00.000Z");
    expect(p.previousSince.toISOString()).toBe("2026-11-12T11:00:00.000Z");
  });

  it("cuts 7 and 30 days into UTC days ending today, the window before of the same length", () => {
    const week = periodOf("7d", NOW);
    expect(week.keys).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(week.previousSince.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    const month = periodOf("30d", NOW);
    expect(month.keys).toHaveLength(30);
    expect(month.keys[0]).toBe("2026-10-16");
    expect(month.pattern).toBe("YYYY-MM-DD");
  });
});

describe("relativeChange", () => {
  it("is null without a base, signed otherwise", () => {
    expect(relativeChange({ current: 5, previous: 0 })).toBeNull();
    expect(relativeChange({ current: 15, previous: 10 })).toBeCloseTo(0.5);
    expect(relativeChange({ current: 5, previous: 10 })).toBeCloseTo(-0.5);
  });
});

describe("stackCommands", () => {
  it("folds the commands outside the top into one series, every bucket present", () => {
    const rows = [
      { key: "2026-11-13", command: "hero", count: 4, errors: 1 },
      { key: "2026-11-13", command: "quiz", count: 2, errors: 0 },
      { key: "2026-11-13", command: "help", count: 1, errors: 1 },
      { key: "2026-11-01", command: "hero", count: 99, errors: 0 },
    ];
    expect(stackCommands(rows, ["2026-11-12", "2026-11-13"], ["hero"])).toEqual([
      { key: "2026-11-12", values: {}, total: 0, errors: 0 },
      { key: "2026-11-13", values: { hero: 4, [OTHER]: 3 }, total: 7, errors: 2 },
    ]);
  });
});

describe("pivot", () => {
  it("makes one row per key, names as columns", () => {
    expect(pivot([{ key: "a", name: "quiz", value: 2 }, { key: "a", name: "quiz", value: 1 }, { key: "z", name: "x", value: 1 }], ["a", "b"])).toEqual([
      { key: "a", values: { quiz: 3 } },
      { key: "b", values: {} },
    ]);
  });
});
