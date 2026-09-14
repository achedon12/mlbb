import { describe, expect, it } from "vitest";
import { spreadHistory } from "@/lib/evolution";
import { impactPatch } from "@/lib/trends";

/** Historique compacte : trois semaines de moyennes, puis quatorze jours mesures. */
const stored = {
  start: "2026-03-02",
  winRate: Array.from({ length: 14 }, (_, k) => 50 + k / 10),
  banRate: Array(14).fill(3),
  pickRate: Array(14).fill(1),
  weeks: { start: "2026-02-09", winRate: [48, 49, 49.5], banRate: [3, 3, 3], pickRate: [1, 1, 1] },
};

describe("patch impact on a compacted history", () => {
  const series = spreadHistory(stored);

  it("flags where real measurements begin", () => {
    expect(series.measuredSince).toBe("2026-03-02");
    expect(series.start < series.measuredSince!).toBe(true);
  });

  it("does not measure a patch with interpolated days", () => {
    // Patch le 2 mars : les sept jours d'avant ne sont que des semaines etalees.
    expect(impactPatch(series, "2026-03-02")).toBeNull();
  });

  it("measures a patch surrounded by real days", () => {
    const impact = impactPatch(series, "2026-03-08");
    expect(impact).not.toBeNull();
    expect(impact!.daysBefore).toBe(6);
  });
});
