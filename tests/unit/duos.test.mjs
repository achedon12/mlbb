import { describe, expect, it } from "vitest";
import { duosDuRang, fusionnerDuos, serialiserDuos, TRANCHES_DUO } from "../../scripts/mesures.mjs";

const parId = new Map([
  [109, "aamon"],
  [76, "lolita"],
  [97, "khaleed"],
  [69, "fanny"],
  [39, "gusion"],
]);

/** Partenaire tel que le renvoie l'API : taux entre 0 et 1, tranches de duree a plat. */
const partenaire = (heroid, gain, tranches = {}) => ({ heroid, increase_win_rate: gain, hero_win_rate: 0.5, ...tranches });

describe("duosDuRang", () => {
  const bloc = {
    main_hero_win_rate: 0.51179,
    sub_hero: [
      partenaire(97, 0.013651),
      partenaire(76, 0.024673, {
        min_win_rate6: 0,
        min_win_rate6_8: 0.444444,
        min_win_rate10_12: 0.483221,
        min_win_rate12_14: 0.532258,
        min_win_rate14_16: 0,
        min_win_rate16_18: 0.529126,
        min_win_rate18_20: 0.52381,
        min_win_rate20: 0.534426,
      }),
      partenaire(999, 0.02),
      partenaire(109, 0.05),
    ],
    sub_hero_last: [partenaire(69, -0.070263), partenaire(39, -0.087743)],
  };

  it("convertit les gains en points et trie chaque cote", () => {
    const d = duosDuRang(bloc, parId, "aamon");
    expect(d.winRate).toBe(51.2);
    expect(d.best.map((x) => [x.slug, x.advantage])).toEqual([
      ["lolita", 2.5],
      ["khaleed", 1.4],
    ]);
    expect(d.worst.map((x) => [x.slug, x.advantage])).toEqual([
      ["gusion", -8.8],
      ["fanny", -7],
    ]);
  });

  it("ecarte le heros lui-meme et les identifiants inconnus", () => {
    const d = duosDuRang(bloc, parId, "aamon");
    expect(d.best.some((x) => x.slug === "aamon" || x.slug === undefined)).toBe(false);
  });

  it("garde les tranches de 10 minutes et plus, une tranche vide valant null", () => {
    const d = duosDuRang(bloc, parId, "aamon");
    expect(TRANCHES_DUO).toHaveLength(6);
    expect(d.best[0].phases).toEqual([48.3, 53.2, null, 52.9, 52.4, 53.4]);
    // Sans aucune tranche mesuree, pas de cle `phases` du tout.
    expect(d.best[1]).not.toHaveProperty("phases");
  });

  it("ne garde un partenaire que du bon cote du gain", () => {
    const d = duosDuRang({ sub_hero: [partenaire(76, -0.01)], sub_hero_last: [partenaire(69, 0.01)] }, parId, "aamon");
    expect(d).toBeNull();
  });

  it("borne chaque liste et tolere un bloc absent", () => {
    const beaucoup = { sub_hero: [partenaire(76, 0.03), partenaire(97, 0.02), partenaire(69, 0.01)] };
    expect(duosDuRang(beaucoup, parId, "aamon", 2).best).toHaveLength(2);
    expect(duosDuRang(beaucoup, parId, "aamon").winRate).toBeNull();
    expect(duosDuRang(undefined, parId, "aamon")).toBeNull();
    expect(duosDuRang({ sub_hero: "?" }, parId, "aamon")).toBeNull();
  });
});

describe("fusionnerDuos", () => {
  const rang = (slug, advantage) => ({ winRate: 50, best: [{ slug, advantage }], worst: [] });

  it("remplace les rangs relus et garde les autres", () => {
    const existants = { aamon: { all: rang("lolita", 1), mythic: rang("khaleed", 2) }, fanny: { all: rang("gusion", 3) } };
    const nouveaux = { aamon: { mythic: rang("gusion", 4) }, gusion: { epic: rang("fanny", 1) } };
    const f = fusionnerDuos(existants, nouveaux);
    expect(f.aamon.all.best[0].slug).toBe("lolita");
    expect(f.aamon.mythic.best[0].slug).toBe("gusion");
    expect(Object.keys(f).sort()).toEqual(["aamon", "fanny", "gusion"]);
  });

  it("tolere un fichier absent ou une lecture vide", () => {
    expect(fusionnerDuos(undefined, { aamon: {} })).toEqual({ aamon: {} });
    expect(fusionnerDuos({ aamon: { all: rang("lolita", 1) } }, null).aamon.all.winRate).toBe(50);
  });
});

describe("serialiserDuos", () => {
  it("ecrit un heros par ligne, dans l'ordre des slugs, en JSON valide", () => {
    const texte = serialiserDuos(30, { zilong: { all: null }, aamon: { all: { winRate: 51 } } });
    const lignes = texte.split("\n");
    expect(lignes[1]).toBe('  "days": 30,');
    expect(lignes[3].trim().startsWith('"aamon"')).toBe(true);
    expect(lignes[4].trim().startsWith('"zilong"')).toBe(true);
    expect(JSON.parse(texte).heroes.aamon.all.winRate).toBe(51);
  });

  it("reste valide sans aucun heros", () => {
    expect(JSON.parse(serialiserDuos(30, {}))).toEqual({ days: 30, heroes: {} });
  });
});
