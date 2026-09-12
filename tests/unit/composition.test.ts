import { describe, expect, it } from "vitest";
import {
  affecterLanes,
  alertes,
  analyserEquipe,
  courbeEquipe,
  ecrireParametres,
  lireParametres,
  menaces,
  profilDuree,
  profilNotes,
  repartitionDegats,
  synergiesInternes,
  type HerosEquipe,
  type MesuresRang,
} from "@/lib/composition";
import { RANGS_MESURE } from "@/lib/rangs-mesure";

const heros = (slug: string, o: Partial<HerosEquipe> = {}): HerosEquipe => ({
  slug,
  nom: slug.toUpperCase(),
  lanes: ["Or"],
  roles: ["Marksman"],
  icone: null,
  synergies: [],
  degats: "physical",
  notes: { offense: 5, durability: 5, abilityEffects: 5, difficulty: 5 },
  ...o,
});

const mesures = (o: Partial<MesuresRang> = {}): MesuresRang => ({
  rang: "all",
  stats: {},
  tranches: [
    { from: 10, to: 12 },
    { from: 12, to: 14 },
    { from: 14, to: null },
  ],
  duree: {},
  coequipiers: {},
  faible: {},
  ...o,
});

/** Une composition sans faiblesse : une lane chacun, degats et notes varies. */
const equilibree = [
  heros("tank", { lanes: ["Roam"], roles: ["Tank"], notes: { offense: 3, durability: 9, abilityEffects: 8, difficulty: 4 } }),
  heros("jungle", { lanes: ["Jungle"], roles: ["Assassin"], notes: { offense: 8, durability: 3, abilityEffects: 3, difficulty: 5 } }),
  heros("mage", { lanes: ["Milieu"], roles: ["Mage"], degats: "magic", notes: { offense: 8, durability: 2, abilityEffects: 7, difficulty: 5 } }),
  heros("tireur", { lanes: ["Or"], notes: { offense: 8, durability: 2, abilityEffects: 2, difficulty: 4 } }),
  heros("combattant", { lanes: ["Experience"], roles: ["Fighter"], degats: "magic", notes: { offense: 6, durability: 7, abilityEffects: 5, difficulty: 5 } }),
];

describe("affecterLanes", () => {
  it("deplace un heros polyvalent pour faire place a un autre", () => {
    const a = affecterLanes([heros("b", { lanes: ["Or", "Jungle"] }), heros("a", { lanes: ["Or"] })]);
    expect(a.lanes).toEqual({ Or: "a", Jungle: "b" });
    expect(a.enTrop).toEqual([]);
    expect(a.manquantes).toEqual(["Milieu", "Experience", "Roam"]);
  });

  it("garde chacun sur sa position principale quand c'est possible", () => {
    const a = affecterLanes([heros("c", { lanes: ["Jungle", "Roam"] }), heros("d", { lanes: ["Roam", "Jungle"] })]);
    expect(a.lanes).toEqual({ Jungle: "c", Roam: "d" });
  });

  it("signale le heros qui n'a plus de lane libre", () => {
    const a = affecterLanes([heros("a"), heros("b")]);
    expect(a.lanes).toEqual({ Or: "a" });
    expect(a.enTrop).toEqual(["b"]);
  });
});

describe("profil de l'equipe", () => {
  it("compte les degats, un heros mixte pour moitie", () => {
    const d = repartitionDegats([
      heros("a"),
      heros("b"),
      heros("c", { degats: "magic" }),
      heros("d", { degats: "mixed" }),
      heros("e", { degats: null }),
    ]);
    expect(d).toMatchObject({ physical: 2, magic: 1, mixed: 1 });
    expect(d.partPhysique).toBeCloseTo(0.625);
    expect(repartitionDegats([heros("x", { degats: null })]).partPhysique).toBeNull();
  });

  it("moyenne les notes en ignorant celles qui manquent", () => {
    expect(
      profilNotes([
        heros("a", { notes: { offense: 6, durability: 4, abilityEffects: 3, difficulty: null } }),
        heros("b", { notes: { offense: 8, durability: 5, abilityEffects: 4, difficulty: 6 } }),
      ]),
    ).toEqual({ offense: 7, durability: 4.5, abilityEffects: 3.5, difficulty: 6 });
  });
});

describe("duree de partie", () => {
  it("dit si une courbe monte, descend ou reste plate", () => {
    expect(profilDuree([50, 50, 50, 52, 53])).toBe("fin");
    expect(profilDuree([53, 52, 50, 50])).toBe("debut");
    expect(profilDuree([50, 50.5, 50])).toBe("stable");
  });

  it("moyenne les heros mesures, tranche par tranche", () => {
    const courbe = courbeEquipe(
      ["a", "b", "c", "d"],
      // c est decoupe autrement, d n'est pas mesure : tous deux sont ecartes.
      mesures({ duree: { a: [49, 51, 54], b: [53, 51, 49], c: [50, 50] } }),
    );
    expect(courbe?.victoire).toEqual([51, 51, 51.5]);
    expect(courbe?.profil).toBe("stable");
    expect(courbe?.pic).toBe(2);
    expect(courbe?.parHeros).toEqual([
      { slug: "a", profil: "fin" },
      { slug: "b", profil: "debut" },
    ]);
    expect(courbeEquipe(["d"], mesures())).toBeNull();
  });
});

describe("synergies et menaces", () => {
  it("lit les deux sens d'une mesure et garde les synergies connues sans chiffre", () => {
    const paires = synergiesInternes(
      [heros("a", { synergies: ["d"] }), heros("b"), heros("c"), heros("d")],
      mesures({
        coequipiers: {
          a: [["b", 1.2]],
          b: [
            ["a", 2.1],
            ["c", -0.5],
          ],
          c: [["d", 0.8]],
        },
      }),
    );
    expect(paires).toEqual([
      { a: "a", b: "b", points: 2.1 },
      { a: "c", b: "d", points: 0.8 },
      { a: "a", b: "d", points: null },
    ]);
  });

  it("ne retient que les adversaires qui genent plusieurs heros de l'equipe", () => {
    const liste = menaces(
      ["a", "b", "c"],
      mesures({
        faible: {
          a: [
            ["x", -3],
            ["y", -2],
            ["c", -4],
          ],
          b: [
            ["x", -1.5],
            ["z", -2],
          ],
          c: [
            ["z", -1],
            ["w", 1],
          ],
        },
      }),
    );
    expect(liste).toEqual([
      {
        slug: "x",
        cibles: [
          ["a", -3],
          ["b", -1.5],
        ],
        total: -4.5,
      },
      {
        slug: "z",
        cibles: [
          ["b", -2],
          ["c", -1],
        ],
        total: -3,
      },
    ]);
  });
});

describe("alertes", () => {
  it("signale lanes en double, absence de tank, degats uniformes et notes faibles", () => {
    const equipe = ["a", "b", "c", "d", "e"].map((s) =>
      heros(s, { notes: { offense: 8, durability: 3, abilityEffects: 2, difficulty: 7 } }),
    );
    const liste = alertes(equipe, affecterLanes(equipe));
    expect(liste.map((a) => a.type)).toEqual(["lanes", "tank", "degats", "controle", "fragile", "difficile"]);
    expect(liste[0]).toEqual({ type: "lanes", lanes: ["Jungle", "Milieu", "Experience", "Roam"], enTrop: ["b", "c", "d", "e"] });
    expect(liste[2]).toEqual({ type: "degats", dominant: "physical" });
  });

  it("ne dit rien d'une composition equilibree, ni d'une equipe trop courte pour etre jugee", () => {
    expect(alertes(equilibree, affecterLanes(equilibree))).toEqual([]);
    const duo = [heros("a"), heros("b", { lanes: ["Jungle"] })];
    expect(alertes(duo, affecterLanes(duo))).toEqual([]);
  });
});

describe("analyserEquipe", () => {
  const catalogue = [
    heros("o"),
    heros("j1", { lanes: ["Jungle"] }),
    heros("j2", { lanes: ["Jungle"] }),
    heros("j3", { lanes: ["Jungle"], synergies: ["o"] }),
  ];
  const rang = mesures({
    stats: { o: [52, "A"], j1: [55, "S"], j2: [45, "C"], j3: [50, "B"] },
    coequipiers: { j2: [["o", 2]] },
  });

  it("propose des picks pour les seules lanes libres, departages par le taux du rang", () => {
    const analyse = analyserEquipe({ catalogue, slugs: ["o"], mesures: rang });
    expect(analyse.victoire).toBe(52);
    expect(analyse.suggestions.map((s) => s.lane)).toEqual(["Jungle", "Milieu", "Experience", "Roam"]);
    const jungle = analyse.suggestions[0].picks;
    expect(jungle.map((p) => p.heros.slug)).toEqual(["j1", "j3", "j2"]);
    // Un coequipier mesure au rang compte comme une synergie.
    expect(jungle[2].raisons.map((r) => r.type)).toContain("combine");
  });

  it("ignore les heros inconnus et ne propose rien a une equipe complete", () => {
    const analyse = analyserEquipe({ catalogue: equilibree, slugs: [...equilibree.map((h) => h.slug), "inconnu"], mesures: null });
    expect(analyse.equipe).toHaveLength(5);
    expect(analyse.suggestions).toEqual([]);
    expect(analyse.affectation.manquantes).toEqual([]);
    // Sans les mesures du rang, ce qui en depend reste vide.
    expect(analyse.victoire).toBeNull();
    expect(analyse.courbe).toBeNull();
    expect(analyse.menaces).toEqual([]);
  });
});

describe("adresse partageable", () => {
  const connus = new Set(["a", "b", "c", "d", "e", "f"]);

  it("lit l'equipe et le rang en ecartant l'inconnu, les doublons et le surplus", () => {
    expect(lireParametres("?h=a,zz,b,a,c,d,e,f&rang=mythic", connus, RANGS_MESURE)).toEqual({
      slugs: ["a", "b", "c", "d", "e"],
      rang: "mythic",
    });
    expect(lireParametres("?rang=inexistant", connus, RANGS_MESURE)).toEqual({ slugs: [], rang: null });
  });

  it("ecrit une adresse lisible et garde les autres parametres", () => {
    expect(ecrireParametres("?utm=1&h=old&rang=epic", ["a", "b"], "mythic")).toBe("h=a,b&utm=1&rang=mythic");
    expect(ecrireParametres("?h=a", [], "all")).toBe("");
  });
});
