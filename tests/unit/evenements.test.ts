import { describe, expect, it } from "vitest";
import type { SkinCatalogue } from "@/lib/catalogue-skins";
import { assemblerMois, decalerMois, estMois, modeObtention, moisDeSortie, statutMois, voisins } from "@/lib/evenements";
import { cleNom, lireGalerie, rattacherHeros, sectionNiveau2, trierEntrees } from "../../scripts/evenements.mjs";

const skin = (o: Partial<SkinCatalogue>): SkinCatalogue => ({
  id: "1",
  nom: "Skin",
  heros: "miya",
  rarete: 3,
  serie: null,
  sortie: "2025-05-01",
  dispo: "Limited",
  prix: {},
  obtention: null,
  image: null,
  ancre: "skin-skin",
  ...o,
});

describe("modeObtention", () => {
  it("reconnait StarLight par l'etiquette ou par le texte d'obtention", () => {
    expect(modeObtention(skin({ serie: "StarLight" }))).toBe("starlight");
    expect(modeObtention(skin({ obtention: "2025/05 StarLight Member" }))).toBe("starlight");
  });
  it("classe Collector, passes, boutique et evenements", () => {
    expect(modeObtention(skin({ serie: "Collector" }))).toBe("collector");
    expect(modeObtention(skin({ obtention: "M5 Pass" }))).toBe("passe");
    expect(modeObtention(skin({ obtention: "S36 First Recharge", prix: { dm: 50 } }))).toBe("passe");
    expect(modeObtention(skin({ serie: "S37" }))).toBe("passe");
    expect(modeObtention(skin({ prix: { dm: 899 } }))).toBe("boutique");
    expect(modeObtention(skin({ serie: "Legend", prix: { mc: 200 } }))).toBe("evenement");
    expect(modeObtention(skin({ serie: "Naruto" }))).toBe("evenement");
  });
  it("ne prend pas l'Annual StarLight pour le StarLight du mois", () => {
    expect(modeObtention(skin({ serie: "Annual StarLight" }))).toBe("evenement");
  });
});

describe("mois", () => {
  it("valide et decale les mois a travers les annees", () => {
    expect(estMois("2026-09")).toBe(true);
    expect(estMois("2026-13")).toBe(false);
    expect(estMois("2026-9")).toBe(false);
    expect(decalerMois("2026-12", 1)).toBe("2027-01");
    expect(decalerMois("2026-01", -1)).toBe("2025-12");
    expect(decalerMois("2026-09", 0)).toBe("2026-09");
  });
  it("lit le mois d'une date du wiki, pas celui d'une annee seule", () => {
    expect(moisDeSortie("2025-05-01")).toBe("2025-05");
    expect(moisDeSortie("2025-05")).toBe("2025-05");
    expect(moisDeSortie("2025")).toBeNull();
    expect(moisDeSortie("202X")).toBeNull();
  });
  it("situe un mois par rapport a la date des donnees", () => {
    expect(statutMois("2026-09", "2026-09-11")).toBe("courant");
    expect(statutMois("2026-10", "2026-09-11")).toBe("annonce");
    expect(statutMois("2026-08", "2026-09-11")).toBe("passe");
  });
  it("trouve les mois voisins dans une liste du plus recent au plus ancien", () => {
    const liste = ["2026-08", "2026-07", "2026-05"];
    expect(voisins(liste, "2026-07")).toEqual({ precedent: "2026-05", suivant: "2026-08" });
    expect(voisins(liste, "2026-08")).toEqual({ precedent: "2026-07", suivant: null });
    expect(voisins(liste, "2020-01")).toEqual({ precedent: null, suivant: null });
  });
});

describe("assemblerMois", () => {
  const chic = skin({ id: "106011", nom: "Chic Glamour", heros: "hanabi", serie: "StarLight", sortie: "2025-01" });
  const gaara = skin({ id: "2", nom: "Gaara", heros: "vale", serie: "Naruto", sortie: "2025-05-02" });
  const epic = skin({ id: "3", nom: "Epic", heros: "vale", sortie: "2025-05-10", prix: { dm: 899 } });
  const ancien = skin({ id: "4", nom: "Vieux", sortie: "2022" });

  const mois = assemblerMois({
    sortis: [chic, gaara, epic, ancien],
    listes: [{ mode: "starlight", mois: "2025-09", skin: chic }],
    sansCollector: ["2025-09", "2025-06"],
  });

  it("place un skin de liste au mois de la liste, pas a celui du module", () => {
    expect(mois.map((m) => m.mois)).toEqual(["2025-09", "2025-05"]);
    expect(mois[0].starlight.map((s) => s.nom)).toEqual(["Chic Glamour"]);
  });
  it("range les autres sorties par mode et compte le total", () => {
    expect(mois[1].autres.evenement.map((s) => s.nom)).toEqual(["Gaara"]);
    expect(mois[1].autres.boutique.map((s) => s.nom)).toEqual(["Epic"]);
    expect(mois[1].total).toBe(2);
  });
  it("note l'absence de Collector sans creer de mois vide", () => {
    expect(mois[0].sansCollector).toBe(true);
    expect(mois.some((m) => m.mois === "2025-06")).toBe(false);
  });
});

describe("script : listes mensuelles du wiki", () => {
  const texte = [
    "== Rules ==",
    "Hero408-portrait.png|Karrie \"Neon Lightwheel\"<br>{{SL Gems|10}}",
    "==Starlight Member Skins==",
    "===2025===",
    "<gallery>",
    "File:Hero106011-portrait.png|'''Hanabi - Chic Glamour'''<br>September 2025",
    "Hero804-portrait.png|'''Guinevere - Lotus''' <br>September 2019",
    "Hero177-portrait.png|'''[[Fanny]] - Lightborn - Ranger'''<br> October 2019",
    "File:Hero000-portrait.png|'''No Collector Skin Released'''<br>May 2025",
    "</gallery>",
    "== Shop ==",
    "Hero215-portrait.png|'''Hayabusa - Experiment 21'''<br>2018",
  ].join("\n");

  it("isole la section de niveau 2 et ses sous-sections", () => {
    const corps = sectionNiveau2(texte, "Starlight Member Skins");
    expect(corps).toContain("Chic Glamour");
    expect(corps).not.toContain("Experiment 21");
    expect(corps).not.toContain("Neon Lightwheel");
    expect(sectionNiveau2(texte, "Absente")).toBeNull();
  });

  it("lit heros, skin, identifiant et mois, et les mois sans sortie", () => {
    const entrees = lireGalerie(sectionNiveau2(texte, "Starlight Member Skins"));
    expect(entrees).toEqual([
      { mois: "2025-09", nomHeros: "Hanabi", skin: "Chic Glamour", id: "106011" },
      { mois: "2019-09", nomHeros: "Guinevere", skin: "Lotus", id: "804" },
      { mois: "2019-10", nomHeros: "Fanny", skin: "Lightborn - Ranger", id: "177" },
      { mois: "2025-05", aucun: true },
    ]);
  });

  it("rattache les heros par nom, sans casse ni ponctuation, et trie par mois", () => {
    const heros = [
      { slug: "yi-sun-shin", nom: "Yi Sun-shin" },
      { slug: "hanabi", nom: "Hanabi" },
    ];
    const rattachees = rattacherHeros(
      [
        { mois: "2025-09", nomHeros: "Hanabi", skin: "Chic Glamour", id: "106011" },
        { mois: "2021-05", nomHeros: "Yi Sun-Shin", skin: "Azure Sentry", id: "306" },
        { mois: "2021-06", nomHeros: "Inconnu", skin: "X", id: null },
      ],
      heros,
    );
    expect(rattachees.map((e: { heros: string | null }) => e.heros)).toEqual(["hanabi", "yi-sun-shin", null]);
    expect(trierEntrees(rattachees).map((e: { mois: string }) => e.mois)).toEqual(["2021-05", "2021-06", "2025-09"]);
    expect(cleNom("Chang'e")).toBe("change");
  });
});
