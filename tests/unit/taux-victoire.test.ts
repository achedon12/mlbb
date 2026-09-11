import { describe, expect, it } from "vitest";
import { calculer, lireNombre, partiesAuRythme, victoiresActuelles } from "@/lib/taux-victoire";

/**
 * Les valeurs attendues ont ete confrontees a l'API communautaire
 * (arena.rone.dev/api/addon/win-rate-calculator), qui fait le meme calcul en
 * flottants.
 */
describe("calculer — victoires d'affilee", () => {
  it("rejoint l'API sur les cas courants", () => {
    // API : 25 et 37 victoires.
    expect(calculer({ parties: 100, taux: 50, objectif: 60 })).toEqual({
      etat: "victoires",
      victoires: 25,
      victoiresActuelles: 50,
    });
    expect(calculer({ parties: 250, taux: 48.5, objectif: 55 })).toMatchObject({ etat: "victoires", victoires: 37 });
  });

  it("reste exact la ou les flottants debordent", () => {
    // L'API repond 4991 : 5 + 4990 victoires sur 5000 parties font 99,9 % pile.
    expect(calculer({ parties: 10, taux: 50, objectif: 99.9 })).toMatchObject({ etat: "victoires", victoires: 4990 });
  });

  it("deduit des victoires entieres du taux arrondi du jeu", () => {
    expect(victoiresActuelles(7, 57.14)).toBe(4);
    expect(victoiresActuelles(1234, 52.35)).toBe(646);
  });

  it("declare 100 % inaccessible apres une defaite", () => {
    expect(calculer({ parties: 100, taux: 50, objectif: 100 })).toMatchObject({ etat: "impossible" });
    // Sans defaite, 100 % est deja la.
    expect(calculer({ parties: 12, taux: 100, objectif: 100 })).toMatchObject({ etat: "atteint", marge: 0 });
  });

  it("compte les defaites encaissables quand l'objectif est sous le taux actuel", () => {
    // 60 victoires sur 100 : apres 20 defaites, 60 sur 120 font 50 % tout juste.
    expect(calculer({ parties: 100, taux: 60, objectif: 50 })).toEqual({
      etat: "atteint",
      marge: 20,
      victoiresActuelles: 60,
    });
    expect(calculer({ parties: 100, taux: 60, objectif: 0 })).toMatchObject({ etat: "atteint", marge: null });
  });

  it("refuse une saisie incoherente", () => {
    expect(calculer({ parties: 0, taux: 50, objectif: 60 }).etat).toBe("invalide");
    expect(calculer({ parties: 10.5, taux: 50, objectif: 60 }).etat).toBe("invalide");
    expect(calculer({ parties: 10, taux: 120, objectif: 60 }).etat).toBe("invalide");
    expect(calculer({ parties: 10, taux: 50, objectif: Number.NaN }).etat).toBe("invalide");
  });
});

describe("partiesAuRythme", () => {
  const s = { parties: 100, taux: 50, objectif: 60 };

  it("donne les parties a jouer a un taux soutenu", () => {
    // 10 victoires manquantes, 10 points d'avance par partie a 70 % : 100 parties.
    expect(partiesAuRythme(s, 70)).toBe(100);
    expect(partiesAuRythme(s, 100)).toBe(25);
  });

  it("renvoie null si le rythme n'atteint pas l'objectif", () => {
    expect(partiesAuRythme(s, 60)).toBeNull();
    expect(partiesAuRythme(s, 55)).toBeNull();
  });

  it("renvoie 0 quand l'objectif est deja atteint", () => {
    expect(partiesAuRythme({ parties: 100, taux: 65, objectif: 60 }, 40)).toBe(0);
  });
});

describe("lireNombre", () => {
  it("accepte la virgule, le point et le signe pour cent", () => {
    expect(lireNombre("48,5")).toBe(48.5);
    expect(lireNombre(" 48.5 % ")).toBe(48.5);
    expect(lireNombre("1 250")).toBe(1250);
  });

  it("renvoie null pour une saisie vide ou illisible", () => {
    expect(lireNombre("")).toBeNull();
    expect(lireNombre("abc")).toBeNull();
  });
});
