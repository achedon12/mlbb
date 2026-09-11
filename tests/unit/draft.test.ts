import { describe, expect, it } from "vitest";
import { suggerer, type HerosDraft } from "@/lib/draft";

const heros = (slug: string, o: Partial<HerosDraft> = {}): HerosDraft => ({
  slug,
  nom: slug.toUpperCase(),
  lanes: ["Or"],
  roles: ["Marksman"],
  icone: null,
  victoire: 50,
  fortContre: [],
  faibleContre: [],
  synergies: [],
  ...o,
});

describe("suggerer", () => {
  const candidats = [
    heros("contre", { fortContre: ["ennemi"], synergies: ["allie"], victoire: 55 }),
    heros("subit", { faibleContre: ["ennemi"], victoire: 45 }),
    heros("neutre"),
    heros("ennemi", { lanes: ["Jungle"] }),
    heros("allie", { lanes: ["Roam"] }),
  ];
  const resultat = suggerer({ candidats, lane: "Or", ennemis: ["ennemi"], allies: ["allie"] });

  it("classe d'abord le heros qui contre l'adversaire", () => {
    expect(resultat[0].heros.slug).toBe("contre");
    expect(resultat.at(-1)?.heros.slug).toBe("subit");
  });

  it("donne des arguments types, traduits a l'affichage", () => {
    expect(resultat[0].raisons).toEqual([
      { type: "contre", detail: "ENNEMI", favorable: true },
      { type: "combine", detail: "ALLIE", favorable: true },
      { type: "victoire", detail: "55.0", favorable: true },
    ]);
    expect(resultat.at(-1)?.raisons.map((r) => r.type)).toEqual(["subi", "victoire"]);
  });

  it("lit une relation declaree d'un seul cote", () => {
    const [premier] = suggerer({
      candidats: [heros("a"), heros("b"), heros("ennemi", { lanes: ["Jungle"], faibleContre: ["b"] })],
      lane: "Or",
      ennemis: ["ennemi"],
      allies: [],
    });
    expect(premier.heros.slug).toBe("b");
  });
});
