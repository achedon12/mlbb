import { describe, expect, it } from "vitest";
import { ECHELLE, REGLES_FAMILLE, apparencePalier } from "@/lib/echelle-rangs";
import { rangLisible } from "@/lib/rangs";

/**
 * L'echelle de la page des rangs et la traduction des profils (`rangs.ts`)
 * reposent sur la meme table officielle : ces tests les empechent de diverger.
 */
describe("echelle des rangs", () => {
  it("couvre les rank_level sans trou ni chevauchement", () => {
    expect(ECHELLE[0].rankLevel.debut).toBe(1);
    for (let i = 1; i < ECHELLE.length; i += 1) {
      expect(ECHELLE[i].rankLevel.debut).toBe(ECHELLE[i - 1].rankLevel.fin! + 1);
    }
    expect(ECHELLE.at(-1)!.rankLevel.fin).toBeNull();
  });

  it("aligne divisions et etoiles sur rangs.ts, de Guerrier a Epique", () => {
    for (const p of ECHELLE.filter((x) => x.divisions.length)) {
      // Plage de chaque division, lue dans rangs.ts.
      const plages = new Map<string, number>();
      for (let n = p.rankLevel.debut; n <= p.rankLevel.fin!; n += 1) {
        const r = rangLisible(n);
        expect(r.cle).toBe(p.cle);
        plages.set(r.division, (plages.get(r.division) ?? 0) + 1);
      }
      expect([...plages.keys()]).toEqual(p.divisions);
      const attendu = p.cle === "guerrier" ? [4, 3, 3] : p.divisions.map(() => p.etoilesMax! + 1);
      expect([...plages.values()]).toEqual(attendu);
    }
  });

  it("aligne les paliers mythiques sur les seuils de points de rangs.ts", () => {
    for (const p of ECHELLE.filter((x) => x.points)) {
      const r = rangLisible(p.rankLevel.debut);
      expect(r.cle).toBe(p.cle);
      expect(r.etoiles).toBe(p.points!.min);
      if (p.rankLevel.fin !== null) expect(rangLisible(p.rankLevel.fin).cle).toBe(p.cle);
    }
  });

  it("donne une regle a chaque famille et un embleme a chaque palier", () => {
    for (const p of ECHELLE) {
      expect(REGLES_FAMILLE[p.famille]).toBeDefined();
      expect(apparencePalier(p).image).not.toBeNull();
    }
  });
});
