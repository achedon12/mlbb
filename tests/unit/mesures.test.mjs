import { describe, expect, it } from "vitest";
import { etalerHistorique } from "@/lib/evolution";
import {
  choisirGuide,
  combosDuHeros,
  compacterHistorique,
  dateDuJour,
  fusionnerHistorique,
  numeroJour,
  pointsDe,
  serieQuotidienne,
} from "../../scripts/mesures.mjs";

const point = (date, winRate) => ({ date, winRate, banRate: winRate / 10, pickRate: winRate / 100 });
/** `n` jours consecutifs a partir de `debut`, le taux montant de 0,1 point par jour. */
const jours = (debut, n, base = 50) =>
  Array.from({ length: n }, (_, k) => point(dateDuJour(numeroJour(debut) + k), Math.round((base + k / 10) * 10) / 10));

describe("serieQuotidienne", () => {
  it("aligne les jours et laisse un trou pour un jour manquant", () => {
    const s = serieQuotidienne([point("2026-09-03", 52), point("2026-09-01", 50)]);
    expect(s.start).toBe("2026-09-01");
    expect(s.winRate).toEqual([50, null, 52]);
    expect(s.banRate).toEqual([5, null, 5.2]);
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
    expect(seconde.aamon.start).toBe("2026-09-01");
    expect(seconde.aamon.winRate).toEqual([50, null, 53]);
  });

  it("remplace un jour deja connu par la mesure la plus recente", () => {
    const ancien = fusionnerHistorique({}, { aamon: { all: serieQuotidienne([point("2026-09-01", 50)]) } });
    const nouveau = fusionnerHistorique(ancien, { aamon: { all: serieQuotidienne([point("2026-09-01", 51)]) } });
    expect(nouveau.aamon.winRate).toEqual([51]);
  });

  it("garde un heros absent de la derniere synchronisation", () => {
    const ancien = fusionnerHistorique({}, { aamon: { all: serieQuotidienne([point("2026-09-01", 50)]) } });
    expect(fusionnerHistorique(ancien, {}).aamon.winRate).toEqual([50]);
  });

  it("lit un fichier d'avant la compaction et le compacte au passage", () => {
    // 120 jours au jour pres, format historique : rien sous `semaines`.
    const ancien = { aamon: serieQuotidienne(jours("2026-05-01", 120)) };
    const tendances = { aamon: { all: serieQuotidienne(jours("2026-08-29", 1, 60)) } };
    const s = fusionnerHistorique(ancien, tendances).aamon;
    expect(s.weeks.start).toBe("2026-04-27");
    expect(s.winRate.at(-1)).toBe(60);
    expect(pointsDe(s).length + 7 * s.weeks.winRate.length).toBeGreaterThanOrEqual(121);
  });

  it("ne remoyenne jamais une semaine deja compactee", () => {
    const une = fusionnerHistorique({}, { aamon: { all: serieQuotidienne(jours("2026-01-05", 120)) } });
    const deux = fusionnerHistorique(une, { aamon: { all: serieQuotidienne(jours("2026-05-05", 20, 55)) } });
    expect(deux.aamon.weeks.winRate.slice(0, une.aamon.weeks.winRate.length)).toEqual(
      une.aamon.weeks.winRate,
    );
  });
});

describe("compacterHistorique", () => {
  it("garde 90 jours au jour pres, a partir d'un lundi, et moyenne les semaines d'avant", () => {
    // 2026-06-01 est un lundi ; 150 jours menent au 2026-10-28.
    const s = compacterHistorique(jours("2026-06-01", 150));
    expect(new Date(`${s.start}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(s.winRate.length).toBeGreaterThanOrEqual(90);
    expect(s.winRate.length).toBeLessThan(97);
    expect(s.winRate.at(-1)).toBe(64.9);
    expect(s.weeks.start).toBe("2026-06-01");
    // Premiere semaine : 50,0 … 50,6, moyenne 50,3.
    expect(s.weeks.winRate[0]).toBe(50.3);
    expect(s.weeks.pickRate[0]).toBe(0.5);
    expect(numeroJour(s.weeks.start) + 7 * s.weeks.winRate.length).toBe(numeroJour(s.start));
  });

  it("ne cree pas de semaines tant que l'historique tient dans la fenetre", () => {
    const s = compacterHistorique(jours("2026-06-01", 60));
    expect(s.weeks).toBeUndefined();
    expect(s.winRate).toHaveLength(60);
  });

  it("laisse un trou pour une semaine sans mesure et moyenne ce qui existe", () => {
    const points = [point("2026-01-05", 50), point("2026-01-07", 52), point("2026-01-20", 49), ...jours("2026-03-01", 100)];
    const s = compacterHistorique(points);
    expect(s.weeks.winRate.slice(0, 3)).toEqual([51, null, 49]);
    expect(s.weeks.banRate[1]).toBeNull();
  });

  it("renvoie null sans aucun point", () => {
    expect(compacterHistorique([])).toBeNull();
  });
});

describe("etalerHistorique", () => {
  it("rend une serie quotidienne continue, les semaines interpolees jusqu'aux jours", () => {
    const stocke = compacterHistorique(jours("2026-06-01", 150));
    const s = etalerHistorique(stocke);
    // Premier point : le jeudi de la premiere semaine, a sa moyenne.
    expect(s.start).toBe("2026-06-04");
    expect(s.winRate[0]).toBe(50.3);
    expect(s.winRate.every((v) => v !== null)).toBe(true);
    expect(s.pickRate.every((v) => v !== null)).toBe(true);
    // La partie recente est rendue telle quelle, a sa date.
    expect(s.winRate.slice(-stocke.winRate.length)).toEqual(stocke.winRate);
    expect(numeroJour(s.start) + s.winRate.length - 1).toBe(numeroJour("2026-10-28"));
    // Une serie lineaire reste lineaire : pas de palier entre deux semaines.
    expect(s.winRate[3]).toBeCloseTo(50.6, 1);
  });

  it("franchit une semaine sans mesure sans laisser de trou", () => {
    const points = [point("2026-01-05", 50), point("2026-01-19", 52), ...jours("2026-03-01", 100)];
    const s = etalerHistorique(compacterHistorique(points));
    expect(s.winRate.slice(0, 15)).not.toContain(null);
    expect(s.winRate[7]).toBe(51);
  });

  it("laisse intact un historique sans semaines", () => {
    const serie = serieQuotidienne([point("2026-09-01", 50), point("2026-09-03", 52)]);
    expect(etalerHistorique(serie)).toEqual(serie);
  });
});

describe("combosDuHeros", () => {
  const skill = (id, name) => ({ id, name, icon: `https://cdn/${id}.png` });
  const fiche = [skill(10940, "Invisible Armor"), skill(10910, "Soul Shards"), skill(10920, "Slayer Shards")];
  const site = [{ name: "Invisible Armor" }, { name: "Soul Shards" }, { name: "Slayer Shards" }];
  const icones = { "Soul Shards": "/visuels/competences/soul-shards.webp" };
  const record = (title, desc, ids) => ({
    data: { title, desc, skill_id: ids.map((skillid) => ({ data: { skillid, skillicon: `https://cdn/${skillid}.png` } })) },
  });

  it("retrouve le nom du site et l'icone locale, sinon garde l'icone distante", () => {
    const [combo] = combosDuHeros([record("LANING COMBOS", "Use  skills\nthen attack.", [10910, 10920])], fiche, site, icones);
    expect(combo).toEqual({
      type: "laning",
      description: "Use skills then attack.",
      skills: [
        { name: "Soul Shards", icon: "/visuels/competences/soul-shards.webp" },
        { name: "Slayer Shards", icon: "https://cdn/10920.png" },
      ],
    });
  });

  it("reconnait l'attaque de base a son identifiant rond", () => {
    const [combo] = combosDuHeros([record("TEAMFIGHT COMBOS", "Go.", [10900])], fiche, site, icones);
    expect(combo.skills[0]).toEqual({ name: null, icon: "https://cdn/10900.png", basicAttack: true });
  });

  it("donne a une forme transformee son icone propre, pas celle de la forme de base", () => {
    const transformee = [...fiche, skill(2010910, "Soul Shards")];
    const [combo] = combosDuHeros([record("LANING COMBOS", "Go.", [2010910])], transformee, site, icones);
    expect(combo.skills[0]).toEqual({ name: "Soul Shards", icon: "https://cdn/2010910.png" });
  });

  it("range la phase de lane avant les combats d'equipe et ecarte les combos vides", () => {
    const combos = combosDuHeros(
      [record("TEAMFIGHT COMBOS", "B.", [10910]), record("LANING COMBOS", "A.", [10920]), record("X", "", [10910])],
      fiche,
      site,
      icones,
    );
    expect(combos.map((c) => c.type)).toEqual(["laning", "teamfight"]);
  });
});

describe("choisirGuide", () => {
  const guide = (authorRank, votes, views = 0) => ({ authorRank, votes, views });

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
