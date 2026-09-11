import { describe, expect, it } from "vitest";
import { creerTDepuis } from "@/i18n/t";
import {
  alignerSeries,
  decalerDate,
  decrireEcart,
  estNotable,
  formaterEcart,
  impactPatch,
  impactsDuHeros,
  impactsDuPatch,
  joursEntre,
  mouvementsSemaine,
  pluriel,
  pointsDe,
  variationSemaine,
  verdictImpact,
  type SerieVictoire,
} from "@/lib/tendances";

/** Serie de 30 jours a partir du 11 aout 2026. */
const serie = (victoire: (number | null)[], debut = "2026-08-11"): SerieVictoire => ({ debut, victoire });
const constante = (v: number, n = 30): (number | null)[] => Array.from({ length: n }, () => v);

describe("dates", () => {
  it("decale une date par-dessus un changement de mois", () => {
    expect(decalerDate("2026-08-30", 3)).toBe("2026-09-02");
    expect(decalerDate("2026-09-02", -3)).toBe("2026-08-30");
  });

  it("compte les jours entre deux dates, dans les deux sens", () => {
    expect(joursEntre("2026-08-11", "2026-09-09")).toBe(29);
    expect(joursEntre("2026-09-09", "2026-08-11")).toBe(-29);
  });

  it("date chaque point d'une serie", () => {
    expect(pointsDe("2026-08-31", [50, null])).toEqual([
      { date: "2026-08-31", valeur: 50 },
      { date: "2026-09-01", valeur: null },
    ]);
  });
});

describe("variationSemaine", () => {
  it("compare la derniere mesure a celle de J-7", () => {
    const v = constante(50);
    v[22] = 49.9;
    v[29] = 50.6;
    const r = variationSemaine(serie(v));
    expect(r).toEqual({ actuel: 50.6, avant: 49.9, ecart: 0.7, jours: 7, date: "2026-09-09" });
  });

  it("prend J-8 quand J-7 manque, puis J-6", () => {
    const v = constante(50);
    v[22] = null;
    v[21] = 49;
    v[23] = 48;
    expect(variationSemaine(serie(v))).toMatchObject({ avant: 49, jours: 8 });
    v[21] = null;
    expect(variationSemaine(serie(v))).toMatchObject({ avant: 48, jours: 6 });
  });

  it("ignore les derniers jours manquants, dans la limite de trois", () => {
    const v = constante(50);
    v[29] = v[28] = v[27] = null;
    v[26] = 51;
    expect(variationSemaine(serie(v))).toMatchObject({ actuel: 51, ecart: 1, date: "2026-09-06" });
    v[26] = null;
    expect(variationSemaine(serie(v))).toBeNull();
  });

  it("refuse une reference trop eloignee de J-7", () => {
    const v: (number | null)[] = Array.from({ length: 30 }, () => null);
    v[29] = 51;
    v[28] = 51;
    v[27] = 51;
    v[26] = 51;
    v[19] = 50; // J-10 : hors tolerance
    expect(variationSemaine(serie(v))).toBeNull();
  });

  it("exige au moins quatre mesures entre les deux bornes", () => {
    const v: (number | null)[] = Array.from({ length: 30 }, () => null);
    v[29] = 51;
    v[25] = 50.5;
    v[22] = 50;
    expect(variationSemaine(serie(v))).toBeNull();
    v[24] = 50.2;
    expect(variationSemaine(serie(v))).toMatchObject({ ecart: 1 });
  });

  it("ne rend rien sans serie", () => {
    expect(variationSemaine(undefined)).toBeNull();
    expect(variationSemaine(null)).toBeNull();
    expect(variationSemaine(serie([]))).toBeNull();
  });
});

describe("estNotable", () => {
  const avec = (ecart: number) => ({ actuel: 50, avant: 50 - ecart, ecart, jours: 7, date: "2026-09-09" });
  it("ecarte le bruit de l'arrondi", () => {
    expect(estNotable(avec(0.1))).toBe(false);
    expect(estNotable(avec(-0.1))).toBe(false);
    expect(estNotable(avec(0.2))).toBe(true);
    expect(estNotable(avec(-0.2))).toBe(true);
    expect(estNotable(null)).toBe(false);
  });
});

describe("mouvementsSemaine", () => {
  const avecEcart = (ecart: number, actuel = 50) => {
    const v = constante(actuel - ecart);
    v[29] = actuel;
    return serie(v);
  };

  it("classe les hausses et les baisses, et ecarte le reste", () => {
    const r = mouvementsSemaine(
      [
        { slug: "a", serie: avecEcart(0.5) },
        { slug: "b", serie: avecEcart(1.2) },
        { slug: "c", serie: avecEcart(-0.8) },
        { slug: "d", serie: avecEcart(0.1) },
        { slug: "e", serie: null },
        { slug: "f", serie: avecEcart(-0.3) },
      ],
      5,
    );
    expect(r.hausses.map((m) => m.slug)).toEqual(["b", "a"]);
    expect(r.baisses.map((m) => m.slug)).toEqual(["c", "f"]);
  });

  it("limite chaque liste et departage les ex aequo", () => {
    const entrees = [
      { slug: "zed", serie: avecEcart(0.4, 52) },
      { slug: "ana", serie: avecEcart(0.4, 52) },
      { slug: "bob", serie: avecEcart(0.4, 53) },
      { slug: "cid", serie: avecEcart(0.3) },
    ];
    expect(mouvementsSemaine(entrees, 3).hausses.map((m) => m.slug)).toEqual(["bob", "ana", "zed"]);
    expect(mouvementsSemaine([...entrees].reverse(), 3).hausses.map((m) => m.slug)).toEqual(["bob", "ana", "zed"]);
  });
});

describe("impactPatch", () => {
  // Historique du 1er au 30 septembre ; patch le 15 (indice 14).
  const avantApres = (avant: number, apres: number, jourPatch = 99) =>
    serie(Array.from({ length: 30 }, (_, k) => (k === 14 ? jourPatch : k < 14 ? avant : apres)), "2026-09-01");

  it("compare les moyennes des sept jours avant et apres, sans le jour du patch", () => {
    const r = impactPatch(avantApres(50, 51.2), "2026-09-15");
    expect(r).toEqual({ avant: 50, apres: 51.2, ecart: 1.2, joursAvant: 7, joursApres: 7 });
  });

  it("ne regarde que sept jours de chaque cote", () => {
    const h = avantApres(50, 49);
    h.victoire[0] = 10; // J-14 : hors fenetre
    h.victoire[29] = 90; // J+15 : hors fenetre
    expect(impactPatch(h, "2026-09-15")).toMatchObject({ avant: 50, apres: 49, ecart: -1 });
  });

  it("exige quatre jours mesures de chaque cote", () => {
    const h = avantApres(50, 51);
    for (const k of [7, 8, 9, 10]) h.victoire[k] = null; // reste J-3, J-2, J-1
    expect(impactPatch(h, "2026-09-15")).toBeNull();
    h.victoire[10] = 50;
    expect(impactPatch(h, "2026-09-15")).toMatchObject({ joursAvant: 4, ecart: 1 });
  });

  it("ne rend rien quand l'historique commence apres le patch", () => {
    // La situation actuelle : historique depuis le 11 aout 2026, dernier patch le 18 juin.
    expect(impactPatch(serie(constante(50)), "2026-06-18")).toBeNull();
    // Patch trop recent : moins de quatre jours mesures apres.
    expect(impactPatch(serie(constante(50)), "2026-09-07")).toBeNull();
  });

  it("ne rend rien sans historique ni date", () => {
    expect(impactPatch(null, "2026-09-15")).toBeNull();
    expect(impactPatch(avantApres(50, 51), null)).toBeNull();
    expect(impactPatch(avantApres(50, 51), "pas une date")).toBeNull();
  });
});

describe("verdictImpact", () => {
  it("dit si le patch a porte dans le sens annonce", () => {
    expect(verdictImpact("affaiblissement", -1.1)).toBe("attendu");
    expect(verdictImpact("affaiblissement", 0.8)).toBe("inverse");
    expect(verdictImpact("amelioration", 0.3)).toBe("attendu");
    expect(verdictImpact("amelioration", -0.5)).toBe("inverse");
    expect(verdictImpact("amelioration", 0.2)).toBe("neutre");
    expect(verdictImpact("ajustement", 2)).toBeNull();
    expect(verdictImpact(null, 2)).toBeNull();
  });
});

describe("impactsDuHeros et impactsDuPatch", () => {
  const h = serie(
    Array.from({ length: 30 }, (_, k) => (k < 14 ? 52 : 50.5)),
    "2026-09-01",
  );

  it("mesure les patchs dates d'un heros et ignore les autres", () => {
    const r = impactsDuHeros(h, [
      { version: "2.1.90", date: "2026-09-15", type: "affaiblissement" },
      { version: "2.1.89", date: null, type: "amelioration" },
      { version: "2.1.88", date: "2026-06-18", type: "amelioration" },
    ]);
    expect(r).toEqual([
      {
        version: "2.1.90",
        date: "2026-09-15",
        type: "affaiblissement",
        verdict: "attendu",
        avant: 52,
        apres: 50.5,
        ecart: -1.5,
        joursAvant: 7,
        joursApres: 7,
      },
    ]);
  });

  it("annote un patch heros par heros", () => {
    const patch = {
      version: "2.1.90",
      date: "2026-09-15",
      ajustements: [
        { slug: "chip", type: "affaiblissement" as const },
        { slug: "sans-historique", type: "amelioration" as const },
      ],
    };
    const r = impactsDuPatch(patch, (slug) => (slug === "chip" ? h : null));
    expect(Object.keys(r)).toEqual(["chip"]);
    expect(r.chip).toMatchObject({ ecart: -1.5, verdict: "attendu" });
    expect(impactsDuPatch({ ...patch, date: null }, () => h)).toEqual({});
  });
});

describe("alignerSeries", () => {
  it("aligne deux series decalees sur l'union de leurs jours", () => {
    const r = alignerSeries([
      { debut: "2026-08-30", valeurs: [1, 2, 3] },
      { debut: "2026-08-31", valeurs: [4, null, 6] },
    ]);
    expect(r.dates).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
    expect(r.valeurs).toEqual([
      [1, 2, 3, null],
      [null, 4, null, 6],
    ]);
  });

  it("garde la place d'une serie vide", () => {
    const r = alignerSeries([{ debut: "2026-09-01", valeurs: [1] }, { debut: "2026-01-01", valeurs: [] }]);
    expect(r).toEqual({ dates: ["2026-09-01"], valeurs: [[1], [null]] });
    expect(alignerSeries([])).toEqual({ dates: [], valeurs: [] });
  });
});

describe("affichage", () => {
  it("signe l'ecart au format de la langue", () => {
    expect(formaterEcart(0.7, "fr")).toBe("+0,7");
    expect(formaterEcart(-0.3, "en")).toBe("-0.3");
    expect(formaterEcart(0, "fr")).toBe("0,0");
    expect(formaterEcart(1.25, "it", 2)).toBe("+1,25");
  });

  it("accorde l'unite selon la langue", () => {
    expect(pluriel(0.7, "fr")).toBe("one");
    expect(pluriel(-1.5, "fr")).toBe("one");
    expect(pluriel(2, "fr")).toBe("other");
    expect(pluriel(0.7, "en")).toBe("other");
    expect(pluriel(0.7, "es")).toBe("other");
  });

  it("decrit l'ecart en toutes lettres", () => {
    const t = creerTDepuis({
      tendances: {
        hausse: "en hausse de {v} {unite} en {n} jours",
        baisse: "en baisse de {v} {unite} en {n} jours",
        point: { one: "point", other: "points" },
      },
    });
    expect(decrireEcart(t, "fr", 0.7, 7)).toBe("en hausse de 0,7 point en 7 jours");
    expect(decrireEcart(t, "fr", -2.3, 6)).toBe("en baisse de 2,3 points en 6 jours");
  });
});
