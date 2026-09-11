import { describe, expect, it } from "vitest";
import { LANGUES } from "@/i18n/config";
import {
  ABANDON,
  chercherOptions,
  comparerHeros,
  couper,
  decalerJour,
  enregistrerPartie,
  estJourValide,
  genererDefi,
  genererManche,
  ligneGrille,
  mancheFinie,
  masquerNom,
  MASQUE,
  numeroDefi,
  ORDRE_DEFI,
  pointsManche,
  pointsMax,
  reponsesDuel,
  serieCourante,
  STATS_VIDES,
  textePartage,
  type Defi,
  type HerosQuiz,
  type Manche,
  type PoolQuiz,
} from "@/lib/quiz";
import { defiDuJour, poolQuiz } from "@/lib/quiz-donnees";

const reponses = (d: Defi) => d.manches.flatMap((m) => (m.type === "duel" ? m.paires.flat().map((x) => x.slug) : [m.reponse]));
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contientNom = (texte: string, nom: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${echapper(nom)}(?![\\p{L}\\p{N}])`, "iu").test(texte);

describe("defi du jour", () => {
  const fr = poolQuiz("fr");
  const jour = "2026-09-11";

  it("donne le meme defi pour la meme date", () => {
    expect(genererDefi(fr, jour)).toEqual(genererDefi(fr, jour));
    expect(genererDefi(poolQuiz("fr"), jour)).toEqual(defiDuJour("fr", jour));
  });

  it("pose les memes reponses dans toutes les langues", () => {
    const attendu = reponses(defiDuJour("fr", jour));
    for (const l of LANGUES) expect(reponses(defiDuJour(l, jour))).toEqual(attendu);
  });

  it("change d'un jour a l'autre", () => {
    const jours = Array.from({ length: 30 }, (_, i) => decalerJour(jour, i));
    const series = new Set(jours.map((j) => reponses(genererDefi(fr, j)).join(",")));
    expect(series.size).toBe(30);
  });

  it("tient une manche de chaque type, dans l'ordre, sans heros repete", () => {
    for (let i = 0; i < 60; i++) {
      const d = genererDefi(fr, decalerJour(jour, i));
      expect(d.manches.map((m) => m.type)).toEqual(ORDRE_DEFI);
      const heros = reponses(d).filter((s) => fr.heros.some((h) => h.slug === s));
      expect(new Set(heros).size).toBe(heros.length);
      expect(pointsMax(d.manches)).toBe(7);
    }
  });

  it("ne bouge pas quand le vivier perd un heros qui n'est pas tire", () => {
    const d = genererDefi(fr, jour);
    const tires = new Set(reponses(d));
    const absent = fr.heros.find((h) => !tires.has(h.slug))!;
    const reduit: PoolQuiz = { ...fr, heros: fr.heros.filter((h) => h.slug !== absent.slug) };
    expect(reponses(genererDefi(reduit, jour))).toEqual(reponses(d));
  });

  it("numerote et valide les jours", () => {
    expect(numeroDefi("2026-09-11")).toBe(1);
    expect(numeroDefi("2026-10-25")).toBe(45);
    expect(numeroDefi("2027-09-11")).toBe(366);
    expect(estJourValide("2026-02-30")).toBe(false);
    expect(estJourValide("2026-9-1")).toBe(false);
    expect(estJourValide("2028-02-29")).toBe(true);
  });
});

describe("generation des manches", () => {
  it("masque le nom du heros dans les competences et les histoires, dans chaque langue", () => {
    const fuites: string[] = [];
    for (const l of LANGUES) {
      const pool = poolQuiz(l);
      for (const h of pool.heros) {
        const textes = [
          ...(pool.histoires[h.slug] ?? []),
          ...(pool.competences[h.slug] ?? []).flatMap((c) => [c.nom, c.extrait ?? ""]),
          ...(pool.skins[h.slug] ?? []).map((s) => s.nom),
        ];
        for (const texte of textes) if (contientNom(texte, h.nom)) fuites.push(`${l}/${h.slug} : ${texte.slice(0, 80)}`);
      }
    }
    expect(fuites).toEqual([]);
  });

  it("tire des manches valides a l'entrainement, quel que soit le hasard", () => {
    const pool = poolQuiz("en");
    const slugs = new Set(pool.heros.map((h) => h.slug));
    const objets = new Set(pool.objets.map((o) => o.slug));
    for (let i = 0; i < 300; i++) {
      const type = ORDRE_DEFI[i % ORDRE_DEFI.length];
      const m = genererManche(pool, type, () => Math.random());
      expect(m?.type).toBe(type);
      if (!m) continue;
      if (m.type === "duel") {
        const [[a, b]] = m.paires;
        expect(Math.abs(a.victoire - b.victoire)).toBeGreaterThanOrEqual(0.5);
        expect(reponsesDuel(m)[0]).toBe(a.victoire >= b.victoire ? a.slug : b.slug);
      } else if (m.type === "objet") {
        expect(objets.has(m.reponse)).toBe(true);
        expect(m.bonus).not.toBe("");
      } else {
        expect(slugs.has(m.reponse)).toBe(true);
      }
      if (m.type === "skin") {
        for (const f of m.foyer) expect(f).toBeGreaterThanOrEqual(0.25);
        expect(m.image).toMatch(/^\/visuels\//);
      }
    }
  });

  it("respecte les exclusions", () => {
    const pool = poolQuiz("fr");
    const exclus = new Set(pool.heros.slice(0, 120).map((h) => h.slug));
    for (let i = 0; i < 50; i++) {
      const m = genererManche(pool, "histoire", () => Math.random(), { exclus: new Set(exclus) });
      if (m && m.type === "histoire") expect(exclus.has(m.reponse)).toBe(false);
    }
  });
});

describe("textes", () => {
  it("masque nom complet, parties et elisions sans toucher aux mots courants", () => {
    expect(masquerNom("Popol and Kupa hunt; Kupa bites.", ["Popol and Kupa"])).toBe(`${MASQUE} hunt; ${MASQUE} bites.`);
    expect(masquerNom("l'arme d'Aamon, AAMON", ["Aamon"])).toBe(`l'arme d'${MASQUE}, ${MASQUE}`);
    expect(masquerNom("Sun rose over the sun.", ["Yi Sun-shin"])).toBe(`${MASQUE} rose over the sun.`);
    expect(masquerNom("X.Borg fires", ["X.Borg"])).toBe(`${MASQUE} fires`);
    expect(masquerNom("Lunoxia", ["Lunox"])).toBe("Lunoxia");
  });

  it("coupe a la fin d'une phrase quand elle tombe assez loin", () => {
    const texte = "Une premiere phrase assez longue pour compter. Une seconde qui depasse largement la limite fixee.";
    expect(couper(texte, 60)).toBe("Une premiere phrase assez longue pour compter.");
    expect(couper("mot ".repeat(40), 30).endsWith("…")).toBe(true);
    expect(couper("court", 30)).toBe("court");
  });
});

describe("reponses, grille et statistiques", () => {
  const competence: Manche = { type: "competence", reponse: "aamon", nom: "x", icone: "/i.webp", extrait: null };
  const duel: Manche = {
    type: "duel",
    paires: [
      [{ slug: "a", victoire: 51 }, { slug: "b", victoire: 49 }],
      [{ slug: "c", victoire: 48 }, { slug: "d", victoire: 50 }],
    ],
  };

  it("termine une devinette trouvee, epuisee ou abandonnee", () => {
    expect(mancheFinie(competence, ["zilong"])).toBe(false);
    expect(mancheFinie(competence, ["zilong", "aamon"])).toBe(true);
    expect(mancheFinie(competence, ["zilong", ABANDON])).toBe(true);
    expect(mancheFinie(competence, ["a", "b", "c", "d", "e"])).toBe(true);
    expect(pointsManche(duel, ["a", "c"])).toBe(1);
  });

  it("compose une grille qui ne dit rien des reponses", () => {
    expect(ligneGrille(competence, ["zilong", "aamon"])).toBe("✨ 🟥🟩⬛⬛⬛");
    expect(ligneGrille(competence, ["zilong", ABANDON])).toBe("✨ 🟥🟥🟥🟥🟥");
    expect(ligneGrille(competence, ["zilong"])).toBe("✨ 🟥⬛⬛⬛⬛");
    expect(ligneGrille(duel, ["a", "c"])).toBe("⚖️ 🟩🟥");
    const texte = textePartage({ numero: 3, points: 5, max: 7, serie: 4, lignes: ["✨ 🟩⬛⬛⬛⬛"], url: "https://x/fr/quiz" });
    expect(texte).toBe("MLBBDex Quiz #3 · 5/7 🔥4\n✨ 🟩⬛⬛⬛⬛\nhttps://x/fr/quiz");
    expect(texte).not.toMatch(/aamon|zilong/i);
  });

  it("compte la serie de jours joues et ne compte pas deux fois le meme jour", () => {
    let s = enregistrerPartie(STATS_VIDES, "2026-09-11", 5);
    s = enregistrerPartie(s, "2026-09-12", 7);
    expect(s).toMatchObject({ joues: 2, serie: 2, meilleure: 2 });
    expect(enregistrerPartie(s, "2026-09-12", 0)).toBe(s);
    expect(serieCourante(s, "2026-09-13")).toBe(2);
    expect(serieCourante(s, "2026-09-14")).toBe(0);
    s = enregistrerPartie(s, "2026-09-15", 3);
    expect(s).toMatchObject({ joues: 3, serie: 1, meilleure: 2 });
    expect(s.distribution).toEqual([0, 0, 0, 1, 0, 1, 0, 1]);
  });

  it("compare un mauvais essai a la reponse", () => {
    const h = (o: Partial<HerosQuiz>): HerosQuiz => ({
      slug: "x", nom: "X", icone: null, roles: ["Mage"], lanes: ["Milieu"], annee: 2020, region: "Abyss", ...o,
    });
    expect(comparerHeros(h({ roles: ["Mage", "Support"], annee: 2018 }), h({}))).toEqual({
      roles: "partiel", lanes: "oui", annee: "plus", region: "oui",
    });
    expect(comparerHeros(h({ lanes: ["Roam"], region: null }), h({ annee: 2016 }))).toMatchObject({
      lanes: "non", annee: "moins", region: "non",
    });
  });

  it("propose d'abord les noms qui commencent par la saisie, sans accents", () => {
    const options = ["Chang'e", "Chou", "Lunox", "Popol and Kupa", "Richou"].map((nom) => ({ slug: nom, nom }));
    expect(chercherOptions(options, "cho", new Set()).map((o) => o.nom)).toEqual(["Chou", "Richou"]);
    expect(chercherOptions(options, "KUPA", new Set()).map((o) => o.nom)).toEqual(["Popol and Kupa"]);
    expect(chercherOptions(options, "chang", new Set(["Chang'e"]))).toEqual([]);
    expect(chercherOptions(options, "  ", new Set())).toEqual([]);
  });
});
