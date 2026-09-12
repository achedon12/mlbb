import { describe, expect, it } from "vitest";
import { normaliser, valeursRadar } from "@/components/radar-heros";
import type { ContresParRang } from "@/lib/donnees";
import type { DuosParRang } from "@/lib/duos";
import {
  adversairesMesures,
  cheminPaire,
  duelDeReference,
  duelParRang,
  duosCommeContres,
  lecturePhases,
  liensEquipe,
  lirePaire,
  meilleursParPhase,
  pairesMesurees,
  phaseDe,
  phasesDuel,
  phasesDuo,
  rangsGagnes,
  segmentPaire,
  tauxParPhase,
} from "@/lib/paires";

const rang = (fort: [string, number][], faible: [string, number][] = []) => ({
  strong: fort.map(([slug, advantage]) => ({ slug, advantage })),
  weak: faible.map(([slug, advantage]) => ({ slug, advantage })),
  winRate: 50,
});

const contres: Record<string, ContresParRang> = {
  aamon: { all: rang([["fanny", 2]], [["gusion", -3]]), mythic: rang([["fanny", 1.5]]) },
  fanny: { mythic: rang([], [["aamon", -1.1]]), epic: rang([["x-borg", 0.4]]) },
  "x-borg": { all: rang([["aamon", 0.2], ["fantome", 5]]) },
};
const existe = (s: string) => s !== "fantome";

describe("adresse d'une paire", () => {
  it("met les slugs dans l'ordre alphabetique", () => {
    expect(segmentPaire("fanny", "aamon")).toBe("aamon-vs-fanny");
    expect(cheminPaire("yi-sun-shin", "x-borg")).toBe("/compare/x-borg-vs-yi-sun-shin");
  });

  it("relit un segment, tirets des slugs compris", () => {
    expect(lirePaire("x-borg-vs-yi-sun-shin")).toEqual({ a: "x-borg", b: "yi-sun-shin", canonique: true });
    expect(lirePaire("fanny-vs-aamon")).toEqual({ a: "fanny", b: "aamon", canonique: false });
  });

  it("refuse un segment mal forme ou un heros contre lui-meme", () => {
    for (const s of ["aamon", "-vs-aamon", "aamon-vs-", "aamon-vs-aamon", "a-vs-b-vs-c"]) expect(lirePaire(s)).toBeNull();
  });
});

describe("pairesMesurees", () => {
  it("garde chaque paire une fois, dans un sens ou dans l'autre, sans heros inconnu", () => {
    expect(pairesMesurees(contres, existe)).toEqual(["aamon-vs-fanny", "aamon-vs-gusion", "aamon-vs-x-borg", "fanny-vs-x-borg"]);
  });
});

describe("adversairesMesures", () => {
  it("retient l'ecart le plus marque, dans les deux sens, du plus tranche au plus serre", () => {
    expect(adversairesMesures(contres, "aamon")).toEqual([
      { slug: "gusion", ecart: 3 },
      { slug: "fanny", ecart: 2 },
      { slug: "x-borg", ecart: 0.2 },
    ]);
  });
});

describe("duelParRang", () => {
  it("moyenne les deux points de vue quand ils existent", () => {
    const duels = duelParRang(contres, "aamon", "fanny");
    expect(duels).toEqual([
      { rang: "all", aContreB: 2, bContreA: null, avantage: 2 },
      { rang: "mythic", aContreB: 1.5, bContreA: -1.1, avantage: 1.3 },
    ]);
    expect(duelDeReference(duels)?.rang).toBe("mythic");
  });

  it("donne l'avantage du point de vue du premier heros", () => {
    const duels = duelParRang(contres, "fanny", "aamon");
    expect(duels.find((d) => d.rang === "mythic")?.avantage).toBe(-1.3);
    expect(duelDeReference([])).toBeNull();
  });

  it("compte les rangs de tranche gagnes, hors tous rangs et hors equilibre", () => {
    const duels = [
      { rang: "all" as const, aContreB: 1, bContreA: null, avantage: 1 },
      { rang: "epic" as const, aContreB: 1, bContreA: null, avantage: 1 },
      { rang: "legend" as const, aContreB: -2, bContreA: null, avantage: -2 },
      { rang: "glory" as const, aContreB: 0.1, bContreA: null, avantage: 0.1 },
    ];
    expect(rangsGagnes(duels)).toEqual({ a: 1, b: 1, total: 3 });
  });
});

describe("phases de partie", () => {
  const seul = [
    { from: 10, to: 12, winRate: 50 },
    { from: 12, to: 14, winRate: 51 },
    { from: 14, to: 16, winRate: 50 },
    { from: 16, to: 18, winRate: 50 },
    { from: 18, to: 20, winRate: 49 },
    { from: 20, to: null, winRate: 48 },
  ];

  it("range les minutes en debut, milieu et fin", () => {
    expect([10, 13, 14, 17, 18, 20].map(phaseDe)).toEqual(["debut", "debut", "milieu", "milieu", "fin", "fin"]);
    expect(tauxParPhase(seul)).toEqual({ debut: 50.5, milieu: 50, fin: 48.5 });
    expect(tauxParPhase(undefined)).toEqual({ debut: null, milieu: null, fin: null });
  });

  it("mesure le gain du duo sur le heros seul, tranche par tranche", () => {
    const p = phasesDuo([52, 53, null, 51, 50, 52], seul);
    expect(p).toEqual([
      { phase: "debut", victoire: 52.5, gain: 2 },
      { phase: "milieu", victoire: 51, gain: 1 },
      { phase: "fin", victoire: 51, gain: 2.5 },
    ]);
    // Sans courbe du heros seul, le taux du duo reste, sans gain.
    expect(phasesDuo([52, null, null, null, null, null], undefined)).toEqual([{ phase: "debut", victoire: 52, gain: null }]);
  });

  it("choisit le meilleur partenaire de chaque phase", () => {
    const duos = [
      { slug: "marcel", advantage: 1, phases: [60, 58, 52, 51, 49, 48] },
      { slug: "grock", advantage: 1, phases: [47, 48, 53, 53, 52, 53] },
    ];
    expect(meilleursParPhase(duos, seul).map((p) => [p.phase, p.slug])).toEqual([
      ["debut", "marcel"],
      ["milieu", "grock"],
      ["fin", "grock"],
    ]);
    expect(meilleursParPhase([{ slug: "akai", advantage: 1 }], seul)).toEqual([]);
  });

  it("lit qui mene selon la duree entre deux heros", () => {
    const autre = seul.map((x) => ({ ...x, winRate: x.from < 14 ? 49 : 51 }));
    const duel = phasesDuel(seul, autre);
    expect(duel.map((x) => x.ecart)).toEqual([1.5, -1, -2.5]);
    expect(lecturePhases(duel)).toEqual({ a: "debut", b: "fin" });
    expect(lecturePhases(phasesDuel(undefined, autre))).toEqual({ a: null, b: null });
  });
});

describe("meme equipe", () => {
  const duos: Record<string, DuosParRang> = {
    aamon: { mythic: { winRate: 51, best: [{ slug: "fanny", advantage: 1.2 }], worst: [] } },
    fanny: { all: { winRate: 50, best: [], worst: [{ slug: "aamon", advantage: -6.1 }] } },
  };

  it("lit les duos au format des contres", () => {
    expect(duosCommeContres(duos.aamon).mythic?.strong[0]).toEqual({ slug: "fanny", advantage: 1.2 });
  });

  it("prend les duos d'abord, les coequipiers de l'academie a defaut", () => {
    const coequipiers = { aamon: { all: [{ slug: "fanny", advantage: 0.8 }], mythic: [{ slug: "fanny", advantage: 9 }] } };
    expect(liensEquipe(duos, coequipiers, "aamon", "fanny")).toEqual([
      { rang: "all", de: "aamon", avec: "fanny", avantage: 0.8, source: "coequipiers" },
      { rang: "all", de: "fanny", avec: "aamon", avantage: -6.1, source: "duos" },
      { rang: "mythic", de: "aamon", avec: "fanny", avantage: 1.2, source: "duos" },
    ]);
  });
});

describe("radar", () => {
  it("ramene un taux sur l'etendue du rang, le plus bas restant visible", () => {
    expect(normaliser(45, [45, 55])).toBe(0.1);
    expect(normaliser(55, [45, 55])).toBe(1);
    expect(normaliser(60, [45, 55])).toBe(1);
    expect(normaliser(50, [50, 50])).toBe(0.55);
    expect(normaliser(null, [45, 55])).toBeNull();
  });

  it("donne six valeurs : quatre notes sur 10, puis victoire et ban", () => {
    const notes = { offense: 7, durability: 3, abilityEffects: null, difficulty: 12 };
    expect(valeursRadar(notes, { victoire: 55, ban: 0 }, { victoire: [45, 55], ban: [0, 50] })).toEqual([
      0.7, 0.3, null, 1, 1, 0.1,
    ]);
    expect(valeursRadar(notes, null, null).slice(4)).toEqual([null, null]);
  });
});
