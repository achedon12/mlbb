import { describe, expect, it } from "vitest";
import { etalerHistorique } from "@/lib/evolution";
import { impactPatch } from "@/lib/tendances";

/** Historique compacte : trois semaines de moyennes, puis quatorze jours mesures. */
const stocke = {
  start: "2026-03-02",
  winRate: Array.from({ length: 14 }, (_, k) => 50 + k / 10),
  banRate: Array(14).fill(3),
  pickRate: Array(14).fill(1),
  weeks: { start: "2026-02-09", winRate: [48, 49, 49.5], banRate: [3, 3, 3], pickRate: [1, 1, 1] },
};

describe("impact d'un patch sur un historique compacte", () => {
  const serie = etalerHistorique(stocke);

  it("signale ou commencent les vraies mesures", () => {
    expect(serie.measuredSince).toBe("2026-03-02");
    expect(serie.start < serie.measuredSince!).toBe(true);
  });

  it("ne mesure pas un patch avec des jours interpoles", () => {
    // Patch le 2 mars : les sept jours d'avant ne sont que des semaines etalees.
    expect(impactPatch(serie, "2026-03-02")).toBeNull();
  });

  it("mesure un patch entoure de vrais jours", () => {
    const impact = impactPatch(serie, "2026-03-08");
    expect(impact).not.toBeNull();
    expect(impact!.joursAvant).toBe(6);
  });
});
