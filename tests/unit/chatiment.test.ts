import { describe, expect, it } from "vitest";
import {
  CLES_OBJECTIFS,
  DIFFICULTES_ORDRE,
  RECORDS_VIDES,
  apresManche,
  apresSerie,
  bilanSerie,
  coupSuivant,
  creerAlea,
  degatsChatiment,
  evaluerFrappe,
  lireRecords,
  pointsFrappe,
  preparerManche,
  resultatVole,
} from "@/lib/chatiment";

describe("degats du Chatiment", () => {
  it("suit 520 + 80 x niveau, de 600 a 1720", () => {
    expect(degatsChatiment(1)).toBe(600);
    expect(degatsChatiment(9)).toBe(1240);
    expect(degatsChatiment(15)).toBe(1720);
  });

  it("borne le niveau entre 1 et 15", () => {
    expect(degatsChatiment(0)).toBe(600);
    expect(degatsChatiment(30)).toBe(1720);
  });
});

describe("verdict d'une frappe", () => {
  it("juge trop tot une frappe au-dessus du seuil, avec les PV restants", () => {
    const r = evaluerFrappe({ pv: 2000, seuil: 1240, pvFranchissement: null, reaction: null });
    expect(r.issue).toBe("tropTot");
    expect(r.points).toBe(0);
    expect(r.reste).toBe(760);
  });

  it("donne 1000 points a une frappe immediate, avant tout nouveau coup", () => {
    const r = evaluerFrappe({ pv: 1100, seuil: 1240, pvFranchissement: 1100, reaction: 120 });
    expect(r.issue).toBe("securise");
    expect(r.precision).toBe(1);
    expect(r.points).toBe(1000);
  });

  it("retire des points a qui attend : moins de PV gardes, reaction plus lente", () => {
    expect(pointsFrappe(0.5, 150)).toBeLessThan(pointsFrappe(1, 150));
    expect(pointsFrappe(1, 600)).toBeLessThan(pointsFrappe(1, 200));
    expect(pointsFrappe(1, 5000)).toBe(700);
    expect(pointsFrappe(0, 5000)).toBe(0);
  });
});

describe("tirage des coups", () => {
  it("rejoue une manche a l'identique avec la meme graine", () => {
    const jouer = (graine: number) => {
      const alea = creerAlea(graine);
      const manche = preparerManche("seigneur", "difficile", 9, alea);
      const pvs = [manche.pvDepart];
      for (let i = 0; i < 20; i += 1) pvs.push(coupSuivant(pvs.at(-1)!, manche, "difficile", alea).pvApres);
      return pvs;
    };
    expect(jouer(42)).toEqual(jouer(42));
    expect(jouer(42)).not.toEqual(jouer(43));
  });

  it("commence au-dessus du seuil, sans depasser les PV du monstre", () => {
    for (const objectif of CLES_OBJECTIFS) {
      for (const difficulte of DIFFICULTES_ORDRE) {
        const m = preparerManche(objectif, difficulte, 15, creerAlea(7));
        expect(m.pvDepart).toBeGreaterThan(m.seuil);
        expect(m.pvDepart).toBeLessThanOrEqual(m.pvMax);
      }
    }
  });

  it("laisse toujours une fenetre de tir au franchissement du seuil", () => {
    for (const difficulte of DIFFICULTES_ORDRE) {
      const alea = creerAlea(1234);
      for (let essai = 0; essai < 500; essai += 1) {
        const manche = preparerManche("tortue", difficulte, 4, alea);
        let pv = manche.pvDepart;
        while (pv > manche.seuil) {
          const coup = coupSuivant(pv, manche, difficulte, alea);
          if (coup.pvApres <= manche.seuil) {
            expect(coup.pvApres).toBeGreaterThanOrEqual(Math.floor(manche.seuil * 0.3));
            expect(coup.degats).toBe(pv - coup.pvApres);
          }
          pv = coup.pvApres;
        }
      }
    }
  });
});

describe("serie et records", () => {
  const reussi = (points: number, reaction: number, precision: number) => ({
    issue: "securise" as const,
    points,
    precision,
    reaction,
    reste: null,
    reactionAdverse: null,
  });

  it("fait le bilan d'une serie", () => {
    const b = bilanSerie([reussi(900, 210, 1), resultatVole(400), reussi(700, 350, 0.5)]);
    expect(b).toEqual({ total: 1600, securises: 2, manches: 3, meilleureReaction: 210, precisionMoyenne: 0.75 });
  });

  it("compte les frappes reussies d'affilee et garde la meilleure suite", () => {
    let r = RECORDS_VIDES;
    for (const issue of ["securise", "securise", "vole", "securise"] as const) r = apresManche(r, issue);
    expect(r.enCours).toBe(1);
    expect(r.meilleureSuite).toBe(2);
  });

  it("n'ecrase un record que s'il est battu", () => {
    const bilan = bilanSerie([reussi(900, 210, 1)]);
    const premier = apresSerie(RECORDS_VIDES, "seigneur:pro", bilan, "2026-09-11");
    expect(premier.nouveau).toBe(true);
    const second = apresSerie(premier.records, "seigneur:pro", bilanSerie([reussi(500, 400, 1)]), "2026-09-12");
    expect(second.nouveau).toBe(false);
    expect(second.records.series["seigneur:pro"].total).toBe(900);
  });

  it("ignore des records stockes illisibles ou mal formes", () => {
    expect(lireRecords("{pas du json")).toEqual(RECORDS_VIDES);
    expect(lireRecords(JSON.stringify({ enCours: -3, meilleureSuite: "x", series: { a: { total: "1" } } }))).toEqual(
      RECORDS_VIDES,
    );
    expect(lireRecords(JSON.stringify({ enCours: 2, meilleureSuite: 5, series: {} })).meilleureSuite).toBe(5);
  });
});
