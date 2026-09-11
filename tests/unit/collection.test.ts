import { describe, expect, it } from "vitest";
import type { Catalogue, SkinCatalogue } from "@/lib/catalogue-skins";
import {
  bilanCollection,
  comparerRarete,
  couverturePrix,
  ecrirePossession,
  lirePossession,
  skinsCollectionnables,
} from "@/lib/collection";

const skin = (p: Partial<SkinCatalogue> & { id: string; heros: string }): SkinCatalogue => ({
  nom: `Skin ${p.id}`,
  rarete: 1,
  serie: null,
  sortie: "2024-01-01",
  dispo: "Available",
  prix: {},
  obtention: null,
  image: null,
  ancre: "",
  ...p,
});

/** Deux heros : l'un vendu en diamants et en points de bataille, l'autre en points de bataille seulement. */
const catalogue: Catalogue = {
  maj: "2026-09-11",
  heros: [
    { slug: "miya", nom: "Miya", roles: ["Marksman"], icone: null },
    { slug: "balmond", nom: "Balmond", roles: ["Fighter"], icone: null },
  ],
  skins: [
    skin({ id: "m0", heros: "miya", rarete: 0, prix: { dm: 599, bp: 32000 } }),
    skin({ id: "m1", heros: "miya", rarete: 6, serie: "Legend", prix: { mc: 200 } }),
    skin({ id: "m2", heros: "miya", rarete: 4, serie: "Epic", prix: { dm: 899 } }),
    skin({ id: "m3", heros: "miya", rarete: 1, prix: { dm: 269 } }),
    skin({ id: "b0", heros: "balmond", rarete: 0, prix: { bp: 6500 } }),
    skin({ id: "b1", heros: "balmond", rarete: 3, serie: "StarLight", dispo: "Limited", obtention: "2019/02 StarLight Member" }),
    skin({ id: "b2", heros: "balmond", rarete: 4, serie: "Epic", dispo: "Upcoming", sortie: "202X" }),
  ],
};

const possession = (heros: string[], skins: string[]) => ({ heros: new Set(heros), skins: new Set(skins) });

describe("bilanCollection", () => {
  it("ne compte que les skins collectionnables : ni origine, ni skin annonce", () => {
    expect(skinsCollectionnables(catalogue).map((s) => s.id)).toEqual(["m1", "m2", "m3", "b1"]);
    const b = bilanCollection(catalogue, possession([], []));
    expect(b.heros).toMatchObject({ possedes: 0, total: 2, diamants: 0 });
    expect(b.skins).toMatchObject({ possedes: 0, total: 4, diamants: 0 });
    expect(b.diamants).toBe(0);
    expect(b.plusRares).toEqual([]);
  });

  it("additionne les diamants, et met a part points de bataille et autres monnaies", () => {
    const b = bilanCollection(catalogue, possession(["miya", "balmond"], ["m1", "m2", "m3", "b1"]));
    expect(b.heros).toMatchObject({ possedes: 2, diamants: 599, pointsBataille: 38500, sansDiamant: 1 });
    expect(b.skins).toMatchObject({ possedes: 4, diamants: 1168, sansDiamant: 2, autres: { mc: 200 } });
    expect(b.diamants).toBe(1767);
  });

  it("detaille par rarete, du plus rare au plus commun", () => {
    const b = bilanCollection(catalogue, possession([], ["m2", "m3"]));
    expect(b.parRarete.map((r) => [r.rang, r.possedes, r.total, r.diamants])).toEqual([
      [6, 0, 1, 0],
      [4, 1, 1, 899],
      [3, 0, 1, 0],
      [1, 1, 1, 269],
    ]);
  });

  it("place les series entamees en tete, par taux de completion", () => {
    const b = bilanCollection(catalogue, possession([], ["b1"]));
    expect(b.parSerie.map((s) => [s.serie, s.possedes, s.total])).toEqual([
      ["StarLight", 1, 1],
      ["Epic", 0, 1],
      ["Legend", 0, 1],
    ]);
  });

  it("met la piece la plus rare en premier", () => {
    const b = bilanCollection(catalogue, possession([], ["m3", "b1", "m1"]));
    expect(b.plusRares.map((s) => s.id)).toEqual(["m1", "b1", "m3"]);
  });

  it("ignore un identifiant inconnu, reste d'une ancienne synchronisation", () => {
    expect(bilanCollection(catalogue, possession(["inconnu"], ["zzz"])).diamants).toBe(0);
  });
});

describe("comparerRarete", () => {
  it("prefere, a rarete egale, l'edition limitee puis la plus petite serie puis la plus ancienne", () => {
    const tailles = new Map([
      ["Grande", 50],
      ["Petite", 3],
    ]);
    const liste = [
      skin({ id: "dispo", heros: "x", rarete: 3, serie: "Petite" }),
      skin({ id: "grande", heros: "x", rarete: 3, dispo: "Limited", serie: "Grande" }),
      skin({ id: "petite", heros: "x", rarete: 3, dispo: "Limited", serie: "Petite", sortie: "2020" }),
      skin({ id: "ancienne", heros: "x", rarete: 3, dispo: "Limited", serie: "Petite", sortie: "2018-02" }),
    ];
    expect(liste.sort(comparerRarete(tailles)).map((s) => s.id)).toEqual(["ancienne", "petite", "grande", "dispo"]);
  });
});

describe("couverturePrix", () => {
  it("compte heros et skins chiffres en diamants, et ceux d'une autre monnaie", () => {
    expect(couverturePrix(catalogue)).toEqual({
      heros: 2,
      herosDiamants: 1,
      skins: 4,
      skinsDiamants: 2,
      skinsAutreMonnaie: 1,
    });
  });
});

describe("sauvegarde", () => {
  it("relit une sauvegarde et ecarte ce qui n'est pas du texte", () => {
    expect(lirePossession('{"heros":["miya",3],"skins":["m1"]}')).toEqual({ heros: ["miya"], skins: ["m1"] });
  });

  it("repart de zero sur une valeur absente, abimee ou d'un autre format", () => {
    const vide = { heros: [], skins: [] };
    expect(lirePossession(null)).toEqual(vide);
    expect(lirePossession("{abime")).toEqual(vide);
    expect(lirePossession("[1,2]")).toEqual(vide);
    expect(lirePossession('"texte"')).toEqual(vide);
  });

  it("ecrit une sauvegarde triee, relue a l'identique", () => {
    const brut = ecrirePossession(possession(["miya", "balmond"], ["m3", "m1"]));
    expect(brut).toBe('{"heros":["balmond","miya"],"skins":["m1","m3"]}');
    expect(lirePossession(brut)).toEqual({ heros: ["balmond", "miya"], skins: ["m1", "m3"] });
  });
});
