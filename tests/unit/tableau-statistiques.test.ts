import { describe, expect, it } from "vitest";
import {
  cheminCourbe,
  cheminStatistiques,
  coderLigne,
  coderListe,
  decoderLigne,
  decoderListe,
  echelonnerCourbe,
  LANES,
  ROLES,
  ecrireEtat,
  ETAT_DEFAUT,
  filtrerLignes,
  formateurTaux,
  iconeHeros,
  lireEtat,
  ordreInitial,
  POINTS_COURBE,
  trierLignes,
  type LigneStat,
} from "@/lib/tableau-statistiques";

const ligne = (slug: string, p: Partial<LigneStat> = {}): LigneStat => ({
  slug,
  nom: slug[0]!.toUpperCase() + slug.slice(1),
  roles: ["Mage"],
  lanes: ["Milieu"],
  palier: "A",
  score: 51,
  victoire: 50,
  ban: 1,
  selection: 1,
  ...p,
});

const LIGNES: LigneStat[] = [
  ligne("zilong", {
    roles: ["Fighter", "Assassin"],
    lanes: ["Experience", "Jungle"],
    score: 50.8,
    victoire: 50.8,
    ban: 0.1,
    selection: 1,
    ecart: 0,
    jours: 6,
  }),
  ligne("aamon", {
    roles: ["Assassin"],
    lanes: ["Jungle"],
    palier: "S",
    score: 54,
    victoire: 52,
    ban: 10,
    selection: 2,
    ecart: 0.5,
    jours: 7,
  }),
  ligne("chang-e", { nom: "Chang'e", palier: "B", score: 49, victoire: 49, ban: 0.5, selection: 3, ecart: -1.2, jours: 7 }),
  ligne("eudora", { score: 51, victoire: 51, ban: 0.2, selection: 5 }),
];
const slugs = (l: LigneStat[]) => l.map((x) => x.slug);

describe("tri du tableau", () => {
  it("part du taux de victoire, du plus haut au plus bas", () => {
    expect(slugs(trierLignes(LIGNES, ETAT_DEFAUT.tri, ETAT_DEFAUT.ordre))).toEqual(["aamon", "eudora", "zilong", "chang-e"]);
  });

  it("inverse le sens sur demande", () => {
    expect(slugs(trierLignes(LIGNES, "victoire", "asc"))).toEqual(["chang-e", "zilong", "eudora", "aamon"]);
  });

  it("trie les noms dans l'ordre alphabetique", () => {
    expect(slugs(trierLignes(LIGNES, "nom", "asc"))).toEqual(["aamon", "chang-e", "eudora", "zilong"]);
    expect(slugs(trierLignes(LIGNES, "nom", "desc"))).toEqual(["zilong", "eudora", "chang-e", "aamon"]);
  });

  it("trie par palier, puis par score dans un meme palier", () => {
    expect(slugs(trierLignes(LIGNES, "palier", "desc"))).toEqual(["aamon", "eudora", "zilong", "chang-e"]);
  });

  it("trie ban et selection", () => {
    expect(slugs(trierLignes(LIGNES, "ban", "desc"))).toEqual(["aamon", "chang-e", "eudora", "zilong"]);
    expect(slugs(trierLignes(LIGNES, "selection", "desc"))).toEqual(["eudora", "chang-e", "aamon", "zilong"]);
  });

  it("laisse les heros sans ecart mesure en fin de liste, dans les deux sens", () => {
    expect(slugs(trierLignes(LIGNES, "tendance", "desc"))).toEqual(["aamon", "zilong", "chang-e", "eudora"]);
    expect(slugs(trierLignes(LIGNES, "tendance", "asc"))).toEqual(["chang-e", "zilong", "aamon", "eudora"]);
  });

  it("departage les egalites par le nom, quel que soit l'ordre d'entree", () => {
    const egales = [ligne("miya", { victoire: 50 }), ligne("layla", { victoire: 50 })];
    expect(slugs(trierLignes(egales, "victoire", "desc"))).toEqual(["layla", "miya"]);
    expect(slugs(trierLignes([...egales].reverse(), "victoire", "asc"))).toEqual(["layla", "miya"]);
  });

  it("ne modifie pas les lignes recues", () => {
    const avant = slugs(LIGNES);
    trierLignes(LIGNES, "nom", "desc");
    expect(slugs(LIGNES)).toEqual(avant);
  });

  it("commence par l'ordre alphabetique pour le nom, du plus fort au plus faible ailleurs", () => {
    expect(ordreInitial("nom")).toBe("asc");
    expect(ordreInitial("ban")).toBe("desc");
  });
});

describe("filtres du tableau", () => {
  const vide = { role: null, lane: null, recherche: "" };

  it("sans filtre, garde tout", () => {
    expect(filtrerLignes(LIGNES, vide)).toHaveLength(LIGNES.length);
  });

  it("filtre par role et par position, cumules", () => {
    expect(slugs(filtrerLignes(LIGNES, { ...vide, role: "Assassin" }))).toEqual(["zilong", "aamon"]);
    expect(slugs(filtrerLignes(LIGNES, { ...vide, role: "Assassin", lane: "Experience" }))).toEqual(["zilong"]);
  });

  it("cherche sans casse ni accents", () => {
    expect(slugs(filtrerLignes(LIGNES, { ...vide, recherche: "  CHANG" }))).toEqual(["chang-e"]);
    expect(slugs(filtrerLignes(LIGNES, { ...vide, recherche: "éudo" }))).toEqual(["eudora"]);
  });
});

describe("etat dans l'URL", () => {
  it("lit un etat complet", () => {
    expect(lireEtat(new URLSearchParams("tri=ban&ordre=asc&role=Mage&lane=Jungle&q=aa"))).toEqual({
      tri: "ban",
      ordre: "asc",
      role: "Mage",
      lane: "Jungle",
      recherche: "aa",
    });
  });

  it("ignore les valeurs inconnues, et prend le premier sens de la colonne", () => {
    expect(lireEtat(new URLSearchParams("tri=bidon&role=Chef&lane=Plage"))).toEqual(ETAT_DEFAUT);
    expect(lireEtat(new URLSearchParams("tri=nom")).ordre).toBe("asc");
  });

  it("n'ecrit pas les valeurs par defaut : le tableau non filtre garde son adresse nue", () => {
    expect(ecrireEtat(ETAT_DEFAUT).toString()).toBe("");
    expect(ecrireEtat({ ...ETAT_DEFAUT, tri: "ban" }).toString()).toBe("tri=ban");
    expect(ecrireEtat({ ...ETAT_DEFAUT, ordre: "asc", recherche: " x " }).toString()).toBe("ordre=asc&q=x");
  });

  it("garde les autres parametres et fait l'aller-retour", () => {
    const etat = { tri: "selection", ordre: "asc", role: "Tank", lane: "Roam", recherche: "ti" } as const;
    const params = ecrireEtat(etat, new URLSearchParams("source=menu&role=Mage"));
    expect(params.get("source")).toBe("menu");
    expect(lireEtat(params)).toEqual(etat);
  });

  it("donne l'adresse de chaque rang et l'icone de chaque heros", () => {
    expect(cheminStatistiques("all")).toBe("/statistics");
    expect(cheminStatistiques("mythic")).toBe("/statistics/mythic");
    expect(iconeHeros("aamon")).toBe("/visuels/heros/aamon/icone.png");
  });
});

describe("mini-courbe", () => {
  it("ne trace rien sous deux points mesures", () => {
    expect(echelonnerCourbe([])).toBeNull();
    expect(echelonnerCourbe([50])).toBeNull();
    expect(echelonnerCourbe([50, 50, null, null], 2)).toBeNull();
  });

  it("resume trente jours en quinze points, du bas vers le haut du cadre", () => {
    const valeurs = Array.from({ length: 30 }, (_, i) => 50 + i * 0.1);
    const points = echelonnerCourbe(valeurs)!.split(" ");
    expect(points).toHaveLength(POINTS_COURBE);
    expect(points[0]).toBe("19");
    expect(points.at(-1)).toBe("1");
    expect(points.map(Number)).toEqual([...points.map(Number)].sort((a, b) => b - a));
  });

  it("laisse plat un taux stable, au milieu du cadre", () => {
    expect(echelonnerCourbe(Array(30).fill(50))).toBe(Array(POINTS_COURBE).fill("10").join(" "));
  });

  it("marque d'un tiret une tranche sans mesure", () => {
    expect(echelonnerCourbe([48, 48, null, null, 52, 52], 3)).toBe("19 - 1");
  });

  it("trace sans « L » et coupe le trait sur un tiret", () => {
    expect(cheminCourbe("19 10 1")).toBe("M0 19 1 10 2 1");
    expect(cheminCourbe("5 - 7 8")).toBe("M0 5M2 7 3 8");
  });
});

describe("lignes compactes", () => {
  it("code roles et positions en chiffres, dans leur ordre", () => {
    expect(coderListe(["Fighter", "Assassin"], ROLES)).toBe(23);
    expect(decoderListe(23, ROLES)).toEqual(["Fighter", "Assassin"]);
    expect(decoderListe(coderListe(["Assassin", "Fighter"], ROLES), ROLES)).toEqual(["Assassin", "Fighter"]);
    expect(coderListe([], LANES)).toBe(0);
    expect(decoderListe(0, LANES)).toEqual([]);
  });

  it("fait l'aller-retour d'une ligne, champs absents compris", () => {
    for (const l of LIGNES) expect(decoderLigne(coderLigne(l))).toEqual(l);
    const complete = ligne("miya", { faible: true, courbe: "10 9 - 8", debut: 50.1, fin: 49.8, ecart: -0.3, jours: 6 });
    expect(decoderLigne(coderLigne(complete))).toEqual(complete);
  });
});

describe("format des taux", () => {
  it("suit la langue", () => {
    expect(formateurTaux("en")(52.44)).toBe("52.4%");
    expect(formateurTaux("fr")(52.44)).toMatch(/^52,4\s%$/u);
  });
});
