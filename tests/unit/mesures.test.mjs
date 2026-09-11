import { describe, expect, it } from "vitest";
import { choisirGuide, fusionnerHistorique, pointsDe, serieQuotidienne } from "../../scripts/mesures.mjs";

const point = (date, victoire) => ({ date, victoire, ban: victoire / 10, selection: victoire / 100 });

describe("serieQuotidienne", () => {
  it("aligne les jours et laisse un trou pour un jour manquant", () => {
    const s = serieQuotidienne([point("2026-09-03", 52), point("2026-09-01", 50)]);
    expect(s.debut).toBe("2026-09-01");
    expect(s.victoire).toEqual([50, null, 52]);
    expect(s.ban).toEqual([5, null, 5.2]);
  });

  it("renvoie null sans aucun point", () => {
    expect(serieQuotidienne([])).toBeNull();
  });

  it("se relit en points dates", () => {
    const s = serieQuotidienne([point("2026-08-31", 49), point("2026-09-01", 50)]);
    expect(pointsDe(s).map((p) => p.date)).toEqual(["2026-08-31", "2026-09-01"]);
    expect(pointsDe(null)).toEqual([]);
  });
});

describe("fusionnerHistorique", () => {
  it("cumule les jours de synchronisations successives", () => {
    const premiere = fusionnerHistorique({}, { aamon: { all: serieQuotidienne([point("2026-09-01", 50)]) } });
    const seconde = fusionnerHistorique(premiere, { aamon: { all: serieQuotidienne([point("2026-09-03", 53)]) } });
    expect(seconde.aamon.debut).toBe("2026-09-01");
    expect(seconde.aamon.victoire).toEqual([50, null, 53]);
  });

  it("remplace un jour deja connu par la mesure la plus recente", () => {
    const ancien = fusionnerHistorique({}, { aamon: { all: serieQuotidienne([point("2026-09-01", 50)]) } });
    const nouveau = fusionnerHistorique(ancien, { aamon: { all: serieQuotidienne([point("2026-09-01", 51)]) } });
    expect(nouveau.aamon.victoire).toEqual([51]);
  });

  it("garde un heros absent de la derniere synchronisation", () => {
    const ancien = fusionnerHistorique({}, { aamon: { all: serieQuotidienne([point("2026-09-01", 50)]) } });
    expect(fusionnerHistorique(ancien, {}).aamon.victoire).toEqual([50]);
  });
});

describe("choisirGuide", () => {
  const guide = (rangAuteur, votes, vues = 0) => ({ rangAuteur, votes, vues });

  it("prend le plus vote parmi les auteurs du rang", () => {
    const candidats = [guide(140, 3), guide(150, 9), guide(190, 50)];
    expect(choisirGuide(candidats, "mythic")).toEqual(guide(150, 9));
  });

  it("se rabat sur un auteur de rang superieur", () => {
    expect(choisirGuide([guide(170, 2), guide(90, 40)], "legend")).toEqual(guide(170, 2));
  });

  it("n'accepte jamais un auteur de rang inferieur", () => {
    expect(choisirGuide([guide(90, 40)], "glory")).toBeNull();
  });

  it("departage les votes par les vues", () => {
    expect(choisirGuide([guide(100, 5, 10), guide(100, 5, 99)], "all")).toEqual(guide(100, 5, 99));
  });
});
