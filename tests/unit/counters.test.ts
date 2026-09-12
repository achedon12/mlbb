import { describe, expect, it } from "vitest";
import { creerTDepuis } from "@/i18n/t";
import {
  agregerContres,
  contresParLane,
  deNom,
  formaterEcart,
  momentsPartie,
  objetsContre,
  phraseSynthese,
  porteVolDeVie,
  rangDeSynthese,
  raisonsContre,
  type ProfilMenace,
} from "@/lib/contrer";
import type { ContresParRang } from "@/lib/donnees";
import type { Lane } from "@/lib/types";

const t = creerTDepuis({
  counters: { pts: "pts" },
  measuredRanks: { mythic: "Mythique", all: "Tous rangs" },
  pages: {
    heroCounters: {
      allRanks: "Tous rangs confondus",
      atRank: "En {rang}",
      overview: "{contexte}, {nom} souffre le plus face à {faibles}, et prend l'avantage sur {forts}.",
      overviewNoStrong: "{contexte}, {nom} souffre le plus face à {faibles}.",
      noMeasure: "Pas encore de counter mesuré pour {nom}.",
    },
  },
});

const mesure = (faible: [string, number][], fort: [string, number][] = []) => ({
  weak: faible.map(([slug, advantage]) => ({ slug, advantage })),
  strong: fort.map(([slug, advantage]) => ({ slug, advantage })),
  winRate: 50,
});

describe("deNom", () => {
  it("elide devant une voyelle, pas devant une consonne, un h ou un y", () => {
    expect(deNom("Aamon")).toBe("d'Aamon");
    expect(deNom("Esmeralda")).toBe("d'Esmeralda");
    expect(deNom("Gusion")).toBe("de Gusion");
    expect(deNom("Hayabusa")).toBe("de Hayabusa");
    expect(deNom("Yve")).toBe("de Yve");
  });
});

describe("agregerContres", () => {
  const parRang: ContresParRang = {
    all: mesure([["gloo", -9]]),
    epic: mesure([["gloo", -2], ["atlas", -4]], [["cici", 3]]),
    mythic: mesure([["gloo", -3], ["lolita", -5]], [["cici", 2], ["marcel", 4]]),
  };

  it("lit les tranches une a une, sans compter `all`, et classe par regularite puis par ecart", () => {
    expect(agregerContres(parRang, "weak")).toEqual([
      { slug: "gloo", rangs: 2, moyenne: -2.5 },
      { slug: "lolita", rangs: 1, moyenne: -5 },
      { slug: "atlas", rangs: 1, moyenne: -4 },
    ]);
    expect(agregerContres(parRang, "strong").map((c) => c.slug)).toEqual(["cici", "marcel"]);
  });

  it("retombe sur `all` quand aucune tranche n'est mesuree", () => {
    expect(agregerContres({ all: mesure([["gloo", -9]]) }, "weak")).toEqual([{ slug: "gloo", rangs: 1, moyenne: -9 }]);
    expect(agregerContres({}, "weak")).toEqual([]);
  });

  it("choisit Mythique pour la synthese, sinon tous rangs, sinon le premier rang mesure", () => {
    expect(rangDeSynthese(parRang)).toBe("mythic");
    expect(rangDeSynthese({ all: mesure([]) })).toBe("all");
    expect(rangDeSynthese({ glory: mesure([]) })).toBe("glory");
    expect(rangDeSynthese({})).toBeNull();
  });
});

describe("phraseSynthese", () => {
  const faible = [
    { nom: "Hayabusa", advantage: -3 },
    { nom: "Gloo", advantage: -4.3 },
    { nom: "Silvanna", advantage: -2.7 },
    { nom: "Lolita", advantage: -2.6 },
  ];
  const fort = [
    { nom: "Marcel", advantage: 3.2 },
    { nom: "Cici", advantage: 3.3 },
    { nom: "Claude", advantage: 2.8 },
  ];

  it("cite trois contres et deux victimes, le premier de chaque avec son ecart", () => {
    const phrase = phraseSynthese("fr", t, { nom: "Aamon", rang: "mythic", faible, fort });
    expect(phrase).toMatch(
      /^En Mythique, Aamon souffre le plus face à Gloo \([-−]4,3 pts\), Hayabusa et Silvanna, et prend l'avantage sur Cici \(\+3,3 pts\) et Marcel\.$/,
    );
  });

  it("dit « tous rangs confondus » et se passe des victimes absentes", () => {
    expect(phraseSynthese("fr", t, { nom: "Aamon", rang: "all", faible: faible.slice(1, 2), fort: [] })).toMatch(
      /^Tous rangs confondus, Aamon souffre le plus face à Gloo \([-−]4,3 pts\)\.$/,
    );
    expect(phraseSynthese("fr", t, { nom: "Aamon", rang: "all", faible: [], fort })).toBe(
      "Pas encore de counter mesuré pour Aamon.",
    );
  });

  it("formate l'ecart signe dans la langue", () => {
    expect(formaterEcart("en", t, 3.25)).toBe("+3.3 pts");
    expect(formaterEcart("fr", t, 2)).toBe("+2,0 pts");
    expect(formaterEcart("fr", t, 0)).toBe("0,0 pts");
  });
});

describe("objets contre un heros", () => {
  const profil = (p: Partial<ProfilMenace>): ProfilMenace => ({
    typeDegats: null,
    roles: [],
    specialites: [],
    volDeVie: false,
    ...p,
  });
  const tous = () => true;

  it("oppose des defenses magiques aux degats magiques, physiques aux degats physiques", () => {
    expect(objetsContre(profil({ typeDegats: "Magic" }), tous).map((o) => o.slug)).toEqual([
      "athena-s-shield",
      "radiant-armor",
      "tough-boots",
    ]);
    // La coquille du wiki compte comme physique.
    expect(raisonsContre(profil({ typeDegats: "Phyiscal" }))).toEqual(["physical"]);
    expect(raisonsContre(profil({ typeDegats: "Mixed" }))).toEqual(["magic", "physical"]);
  });

  it("ajoute les regles de role et de specialite, sans citer deux fois un objet", () => {
    const conseils = objetsContre(
      profil({ typeDegats: "Magic", roles: ["Marksman"], specialites: ["Regen", "Crowd Control"] }),
      tous,
    );
    expect(conseils.filter((c) => c.slug === "tough-boots")).toEqual([{ slug: "tough-boots", raison: "magic" }]);
    expect(new Set(conseils.map((c) => c.raison))).toEqual(new Set(["magic", "attacks", "healing"]));
  });

  it("detecte le vol de vie dans les bonus du build joue, et ecarte les objets absents du catalogue", () => {
    expect(porteVolDeVie(["+60 Physical Attack, +10% Lifesteal", null])).toBe(true);
    expect(porteVolDeVie(["+75 Magic Power, +10% Spell Vamp"])).toBe(true);
    expect(porteVolDeVie(["+60 Physical Attack", null])).toBe(false);
    expect(
      objetsContre(profil({ volDeVie: true }), (s) => s !== "sea-halberd").map((o) => o.slug),
    ).toEqual(["dominance-ice", "necklace-of-durance"]);
  });
});

describe("momentsPartie", () => {
  it("trouve la tranche la plus faible et la plus forte", () => {
    const tranches = [
      { from: 10, to: 12, winRate: 53 },
      { from: 12, to: 14, winRate: 50 },
      { from: 14, to: null, winRate: 48 },
    ];
    const m = momentsPartie(tranches)!;
    expect(m.faible.from).toBe(14);
    expect(m.fort.from).toBe(10);
    expect(m.profil).toBe("debut");
  });

  it("ne dit rien d'une courbe plate ou trop courte", () => {
    expect(momentsPartie([{ from: 10, to: null, winRate: 50 }])).toBeNull();
    expect(momentsPartie([{ from: 10, to: 12, winRate: 50 }, { from: 12, to: null, winRate: 50 }])).toBeNull();
    expect(momentsPartie(undefined)).toBeNull();
  });
});

describe("contresParLane", () => {
  const lanes: Record<string, Lane[]> = { gloo: ["Roam", "Experience"], hayabusa: ["Jungle"], fredrinn: ["Jungle", "Roam"] };
  const contres = ["gloo", "hayabusa", "fredrinn"].map((slug, i) => ({ slug, rangs: 3 - i, moyenne: -3 }));

  it("place la position du heros d'abord et range un contre sous chacune de ses positions", () => {
    const groupes = contresParLane(contres, (s) => lanes[s] ?? [], ["Jungle"], 1);
    expect(groupes.map((g) => [g.lane, g.contres.map((c) => c.slug)])).toEqual([
      ["Jungle", ["hayabusa"]],
      ["Experience", ["gloo"]],
      ["Roam", ["gloo"]],
    ]);
  });
});
