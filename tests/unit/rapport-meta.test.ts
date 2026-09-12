import { describe, expect, it } from "vitest";
import { changementsDePalier, grouperAjustements, premiersSelon, type SerieTier } from "@/lib/rapport-meta";
import type { Palier } from "@/lib/types";

/** Regle simplifiee : le score est le taux de victoire, trois paliers. */
const regle = {
  score: (t: { winRate: number; banRate: number }) => t.winRate,
  palier: (s: number): Palier => (s >= 53 ? "S" : s >= 50 ? "A" : "B"),
};

/** Huit jours de mesures, du taux d'il y a sept jours au taux du jour, interpoles. */
const serie = (avant: number, apres: number): SerieTier => ({
  start: "2026-09-04",
  winRate: Array.from({ length: 8 }, (_, k) => Math.round((avant + ((apres - avant) * k) / 7) * 10) / 10),
  banRate: Array.from({ length: 8 }, () => 5),
});

describe("changements de palier", () => {
  it("repere montees et descentes, les plus fortes d'abord", () => {
    const { montees, descentes } = changementsDePalier(
      [
        { slug: "monte", serie: serie(51, 53.5), palierActuel: "S" },
        { slug: "bond", serie: serie(49, 54), palierActuel: "S" },
        { slug: "chute", serie: serie(52, 49), palierActuel: "B" },
        { slug: "stable", serie: serie(51, 52), palierActuel: "A" },
      ],
      regle,
    );
    expect(montees.map((c) => [c.slug, c.avant, c.apres, c.ecart])).toEqual([
      ["bond", "B", "S", 2],
      ["monte", "A", "S", 1],
    ]);
    expect(descentes.map((c) => [c.slug, c.avant, c.apres, c.ecart])).toEqual([["chute", "A", "B", -1]]);
    expect(montees[0].jours).toBe(7);
  });

  it("ecarte un changement que le classement affiche ne confirme pas", () => {
    const { montees } = changementsDePalier([{ slug: "borne", serie: serie(51, 53), palierActuel: "A" }], regle);
    expect(montees).toEqual([]);
  });

  it("ne dit rien sans serie, sans reference a J-7 ou sans ban mesure", () => {
    const courte: SerieTier = { start: "2026-09-09", winRate: [50, 51, 54], banRate: [5, 5, 5] };
    const sansBan: SerieTier = { ...serie(49, 54), banRate: Array.from({ length: 8 }, () => null) };
    const resultat = changementsDePalier(
      [
        { slug: "rien", serie: null, palierActuel: "S" },
        { slug: "courte", serie: courte, palierActuel: "S" },
        { slug: "sans-ban", serie: sansBan, palierActuel: "S" },
      ],
      regle,
    );
    expect(resultat).toEqual({ montees: [], descentes: [] });
  });
});

describe("resume d'un patch", () => {
  it("range les heros par sens, une seule fois chacun, un type inconnu parmi les ajustements", () => {
    const groupes = grouperAjustements([
      { slug: "a", type: "amelioration" },
      { slug: "b", type: "affaiblissement" },
      { slug: "a", type: "ajustement" },
      { slug: "c", type: null },
      { slug: "d", type: "ajustement" },
    ]);
    expect(groupes.amelioration.map((x) => x.slug)).toEqual(["a"]);
    expect(groupes.affaiblissement.map((x) => x.slug)).toEqual(["b"]);
    expect(groupes.ajustement.map((x) => x.slug)).toEqual(["c", "d"]);
  });
});

describe("premiers selon une mesure", () => {
  it("trie du plus haut au plus bas, a egalite par slug, sans toucher a l'entree", () => {
    const entrees = [
      { hero: { slug: "b" }, ban: 10 },
      { hero: { slug: "a" }, ban: 10 },
      { hero: { slug: "c" }, ban: 30 },
    ];
    expect(premiersSelon(entrees, (e) => e.ban, 2).map((e) => e.hero.slug)).toEqual(["c", "a"]);
    expect(entrees[0].hero.slug).toBe("b");
  });
});
