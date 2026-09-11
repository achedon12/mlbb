import { describe, expect, it } from "vitest";
import {
  PREREGLAGES,
  analyser,
  courbe,
  diamantsPour,
  erreursTirage,
  lireEntier,
  lirePourcent,
  lotsDeDixEsperes,
  probabiliteEn,
  tiragesAvecBudget,
  tiragesEsperes,
  tiragesPour,
  type Tirage,
} from "@/lib/tirages";

const aurora: Tirage = { cout: 50, coutDix: 450, probabilite: 1, garantie: 10 };
const simple = (probabilite: number, garantie: number | null = null): Tirage => ({
  cout: 10,
  coutDix: null,
  probabilite,
  garantie,
});

/** Loi de T calculee terme a terme, sans formule fermee : la reference des tests. */
function loi(t: Tirage, max = 200_000): number[] {
  const p = t.probabilite / 100;
  const probas: number[] = [];
  let survie = 1;
  for (let k = 1; k <= max && survie > 1e-15; k++) {
    const pk = t.garantie !== null && k >= t.garantie ? survie : survie * p;
    probas[k] = pk;
    survie -= pk;
  }
  return probas;
}

describe("lecture des saisies", () => {
  it("lit les entiers avec les separateurs de milliers de chaque langue", () => {
    expect(lireEntier("3000")).toBe(3000);
    expect(lireEntier("3,000")).toBe(3000);
    expect(lireEntier("3.000")).toBe(3000);
    expect(lireEntier("3 000")).toBe(3000);
    expect(lireEntier("3\u202f000")).toBe(3000);
    for (const s of ["", "abc", "-5", "1e3", "12a"]) expect(lireEntier(s), s).toBeNull();
  });

  it("lit les pourcentages avec virgule ou point", () => {
    expect(lirePourcent("1,38")).toBe(1.38);
    expect(lirePourcent("1.38 %")).toBe(1.38);
    expect(lirePourcent(".5")).toBe(0.5);
    for (const s of ["", "abc", "1,2,3", "-1", "NaN", "Infinity"]) expect(lirePourcent(s), s).toBeNull();
  });
});

describe("probabilites", () => {
  it("suit 1 − (1 − p)^n puis vaut 1 a la garantie", () => {
    expect(probabiliteEn(1, simple(50))).toBeCloseTo(0.5, 15);
    expect(probabiliteEn(2, simple(50))).toBeCloseTo(0.75, 15);
    expect(probabiliteEn(9, aurora)).toBeCloseTo(1 - 0.99 ** 9, 15);
    expect(probabiliteEn(10, aurora)).toBe(1);
    expect(probabiliteEn(0, aurora)).toBe(0);
    expect(probabiliteEn(1, simple(100))).toBe(1);
  });

  it("reste precise pour une probabilite minuscule", () => {
    // 1 − (1 − 1e-6)^1 doit rendre 1e-6, pas un residu d'arrondi.
    expect(probabiliteEn(1, simple(0.0001))).toBeCloseTo(1e-6, 18);
  });

  it("donne l'esperance du nombre de tirages, garantie comprise", () => {
    expect(tiragesEsperes(simple(1))).toBeCloseTo(100, 10);
    expect(tiragesEsperes(simple(100))).toBe(1);
    for (const t of [aurora, simple(1.38, 160), simple(7, 25), simple(0.5, 3)]) {
      const reference = loi(t).reduce((s, pk, k) => s + k * pk, 0);
      expect(tiragesEsperes(t)).toBeCloseTo(reference, 9);
    }
  });

  it("donne le nombre moyen de tirages x10", () => {
    for (const t of [aurora, simple(1.38, 160), simple(2), simple(1, 15)]) {
      const reference = loi(t).reduce((s, pk, k) => s + Math.ceil(k / 10) * pk, 0);
      expect(lotsDeDixEsperes(t)).toBeCloseTo(reference, 8);
    }
  });

  it("trouve le plus petit nombre de tirages pour chaque palier", () => {
    expect(tiragesPour(0.5, simple(50))).toBe(1);
    expect(tiragesPour(0.75, simple(50))).toBe(2);
    expect(tiragesPour(0.9, simple(50))).toBe(4);
    expect(tiragesPour(0.99, aurora)).toBe(10);
    expect(tiragesPour(0.5, simple(0.0001))).toBe(693_147);
    for (const t of [simple(1), simple(1.38, 160), simple(0.3), simple(33.3), simple(12, 8)]) {
      for (const cible of [0.5, 0.9, 0.99]) {
        let n = 1;
        while (probabiliteEn(n, t) < cible - 1e-12) n++;
        expect(tiragesPour(cible, t), `${t.probabilite} % a ${cible}`).toBe(n);
      }
    }
  });
});

describe("diamants", () => {
  it("combine tirages x10 et simples au meilleur prix", () => {
    expect(diamantsPour(8, aurora)).toBe(400);
    // Neuf tirages simples coutent autant qu'un x10 : on garde le moins cher des deux.
    expect(diamantsPour(9, aurora)).toBe(450);
    expect(diamantsPour(10, aurora)).toBe(450);
    expect(diamantsPour(11, aurora)).toBe(500);
    expect(diamantsPour(19, aurora)).toBe(900);
    expect(diamantsPour(0, aurora)).toBe(0);
  });

  it("ignore un tirage x10 qui ne fait pas economiser", () => {
    const sansRemise: Tirage = { ...aurora, coutDix: 500 };
    expect(diamantsPour(10, sansRemise)).toBe(500);
    expect(tiragesAvecBudget(1000, sansRemise)).toBe(20);
  });

  it("maximise les tirages d'un budget", () => {
    expect(tiragesAvecBudget(1000, aurora)).toBe(22);
    expect(tiragesAvecBudget(449, aurora)).toBe(8);
    expect(tiragesAvecBudget(0, aurora)).toBe(0);
    // Verification exhaustive : aucun melange ne donne plus de tirages.
    for (let budget = 0; budget <= 3000; budget += 7) {
      let meilleur = 0;
      for (let dix = 0; dix * 450 <= budget; dix++) meilleur = Math.max(meilleur, dix * 10 + Math.floor((budget - dix * 450) / 50));
      expect(tiragesAvecBudget(budget, aurora), String(budget)).toBe(meilleur);
    }
  });
});

describe("analyser", () => {
  it("signale chaque champ invalide", () => {
    const r = analyser({ cout: 0, coutDix: -1, probabilite: Number.NaN, garantie: 1.5 }, { type: "budget", diamants: -3 });
    expect(r).toEqual({ etat: "invalide", erreurs: ["cout", "coutDix", "probabilite", "garantie", "budget"] });
    expect(analyser(simple(101), { type: "tirages", nombre: 0 })).toEqual({
      etat: "invalide",
      erreurs: ["probabilite", "tirages"],
    });
  });

  it("assemble le bilan d'un budget", () => {
    const r = analyser(aurora, { type: "budget", diamants: 1000 });
    expect(r).toMatchObject({ etat: "ok", tirages: 22, diamants: 1000, probabilite: 1 });
    if (r.etat !== "ok") throw new Error();
    expect(r.paliers.map((p) => p.tirages)).toEqual([10, 10, 10]);
    expect(r.paliers[0].diamants).toBe(450);
    expect(r.diamantsEsperesUnParUn).toBeCloseTo(tiragesEsperes(aurora) * 50, 10);
    expect(r.diamantsEsperesParDix).toBeCloseTo(450, 10);
  });

  it("assemble le bilan d'un nombre de tirages, sans x10", () => {
    const r = analyser(simple(1), { type: "tirages", nombre: 69 });
    expect(r).toMatchObject({ etat: "ok", tirages: 69, diamants: 690, diamantsEsperesParDix: null });
    if (r.etat !== "ok") throw new Error();
    expect(r.probabilite).toBeCloseTo(1 - 0.99 ** 69, 12);
    expect(r.paliers.map((p) => p.tirages)).toEqual([69, 230, 459]);
  });
});

describe("courbe", () => {
  it("croit, finit au bout de l'axe et marque la marche de la garantie", () => {
    const pts = courbe(simple(1.38, 160), 200, 40);
    expect(pts[0]).toEqual({ n: 0, p: 0 });
    expect(pts.at(-1)!.n).toBe(200);
    expect(pts.map((x) => x.n)).toEqual(expect.arrayContaining([159, 160]));
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].n).toBeGreaterThan(pts[i - 1].n);
      expect(pts[i].p).toBeGreaterThanOrEqual(pts[i - 1].p);
    }
    expect(pts.length).toBeLessThanOrEqual(43);
  });
});

describe("prereglages", () => {
  it("sont des evenements valides, sources et dates", () => {
    for (const p of PREREGLAGES) {
      expect(erreursTirage(p.tirage), p.cle).toEqual([]);
      expect(p.source).toMatch(/^https:\/\/mobilelegends\.fandom\.com\/wiki\//);
      expect(p.releve).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
