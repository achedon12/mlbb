import { describe, expect, it } from "vitest";
import { LANGUES } from "@/i18n/config";
import {
  COLONNES,
  comparer,
  dateEligibilite,
  enregistrerVictoire,
  EPOQUE,
  FENETRE,
  grilleClassique,
  grilleCompetence,
  indicesDebloques,
  ligneEmoji,
  moyenneEssais,
  numeroMlbbdle,
  prochainIndice,
  SEAU_MAX,
  textePartage,
  tirerAuHasard,
  tirerSecrets,
  type CandidatMlbbdle,
  type HerosMlbbdle,
} from "@/lib/mlbbdle";
import { candidatsMlbbdle, defiMlbbdle, rosterMlbbdle } from "@/lib/mlbbdle-donnees";
import { decalerJour, serieCourante, STATS_VIDES } from "@/lib/quiz";

const BASE: HerosMlbbdle = {
  slug: "a",
  nom: "A",
  icone: null,
  genre: "homme",
  roles: ["Mage"],
  lanes: ["Milieu"],
  specialites: ["burst"],
  degats: "magic",
  attaque: "ranged",
  ressource: "mana",
  region: "eruditio",
  annee: 2020,
};
const h = (o: Partial<HerosMlbbdle>): HerosMlbbdle => ({ ...BASE, ...o });
const carres = (ligne: string) => [...ligne].filter((c) => /[🟩🟧🟥⬛]/u.test(c)).length;
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contientNom = (texte: string, nom: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${echapper(nom)}(?![\\p{L}\\p{N}])`, "iu").test(texte);

describe("comparaison du mode classique", () => {
  it("donne tout vert pour le meme heros", () => {
    const c = comparer(BASE, BASE);
    for (const col of COLONNES) expect(c[col].verdict).toBe("oui");
    expect(c.annee.sens).toBe("egal");
  });

  it("distingue accord exact, partiel et nul sur les listes", () => {
    const cible = h({ roles: ["Mage", "Support"] });
    expect(comparer(h({ roles: ["Support", "Mage"] }), cible).roles.verdict).toBe("oui");
    expect(comparer(h({ roles: ["Mage"] }), cible).roles.verdict).toBe("partiel");
    expect(comparer(h({ roles: ["Mage", "Tank"] }), cible).roles.verdict).toBe("partiel");
    expect(comparer(h({ roles: ["Tank"] }), cible).roles.verdict).toBe("non");
  });

  it("tient les degats mixtes et la portee hybride pour un accord partiel", () => {
    expect(comparer(h({ degats: "mixed" }), h({ degats: "physical" })).degats.verdict).toBe("partiel");
    expect(comparer(h({ degats: "magic" }), h({ degats: "mixed" })).degats.verdict).toBe("partiel");
    expect(comparer(h({ degats: "magic" }), h({ degats: "physical" })).degats.verdict).toBe("non");
    expect(comparer(h({ attaque: "hybrid" }), h({ attaque: "melee" })).attaque.verdict).toBe("partiel");
    expect(comparer(h({ attaque: "ranged" }), h({ attaque: "melee" })).attaque.verdict).toBe("non");
    // Une valeur unique sans « large » n'a jamais d'accord partiel.
    expect(comparer(h({ region: "abyss" }), h({ region: "eruditio" })).region.verdict).toBe("non");
  });

  it("oriente l'annee de sortie et signale les valeurs manquantes", () => {
    expect(comparer(h({ annee: 2018 }), h({ annee: 2020 })).annee).toEqual({ verdict: "non", sens: "plus" });
    expect(comparer(h({ annee: 2022 }), h({ annee: 2020 })).annee).toEqual({ verdict: "non", sens: "moins" });
    expect(comparer(h({ annee: null }), BASE).annee).toEqual({ verdict: "inconnu", sens: "inconnu" });
    expect(comparer(h({ genre: null }), BASE).genre.verdict).toBe("inconnu");
    expect(comparer(h({ specialites: [] }), BASE).specialites.verdict).toBe("inconnu");
  });
});

describe("dates et tirage", () => {
  it("date l'eligibilite quelques jours apres la sortie", () => {
    expect(dateEligibilite("26 October 2021")).toBe("2021-11-09");
    expect(dateEligibilite("January 2017")).toBe("2017-01-15");
    expect(dateEligibilite("2016")).toBe("2016-01-15");
    expect(dateEligibilite("TBA")).toBeNull();
    expect(dateEligibilite(null)).toBeNull();
    expect(dateEligibilite("Octember 2021")).toBeNull();
  });

  it("numerote les jours depuis l'epoque", () => {
    expect(numeroMlbbdle(EPOQUE)).toBe(1);
    expect(numeroMlbbdle(decalerJour(EPOQUE, 30))).toBe(31);
  });

  const candidats = candidatsMlbbdle();
  const fin = decalerJour(EPOQUE, 400);
  const secrets = tirerSecrets(candidats, fin);

  it("tire un secret par jour, sans repetition sur la fenetre, jamais le meme dans les deux modes", () => {
    expect(secrets).toHaveLength(401);
    const depuis = new Map(candidats.map((c) => [c.slug, c.depuis]));
    const avecCompetence = new Set(candidats.filter((c) => c.competence).map((c) => c.slug));
    secrets.forEach((s, i) => {
      expect(s.classique).not.toBeNull();
      expect(s.competence).not.toBeNull();
      expect(s.classique).not.toBe(s.competence);
      expect(depuis.get(s.classique!)! <= s.jour).toBe(true);
      expect(avecCompetence.has(s.competence!)).toBe(true);
      const avant = secrets.slice(Math.max(0, i - FENETRE), i);
      expect(avant.map((x) => x.classique)).not.toContain(s.classique);
      expect(avant.map((x) => x.competence)).not.toContain(s.competence);
    });
  });

  it("ne depend ni de l'ordre du roster ni d'un heros qui sort plus tard", () => {
    expect(tirerSecrets([...candidats].reverse(), fin)).toEqual(secrets);
    const nouveau: CandidatMlbbdle = { slug: "aaa-nouveau", depuis: decalerJour(EPOQUE, 200), competence: true };
    const avecNouveau = tirerSecrets([...candidats, nouveau], fin);
    expect(avecNouveau.slice(0, 200)).toEqual(secrets.slice(0, 200));
  });

  it("reprend un heros recent plutot que de rester sans secret", () => {
    const petits: CandidatMlbbdle[] = ["x", "y", "z"].map((slug) => ({ slug, depuis: "2016-01-01", competence: true }));
    const s = tirerSecrets(petits, decalerJour(EPOQUE, 9));
    expect(s.every((j) => j.classique && j.competence && j.classique !== j.competence)).toBe(true);
  });

  it("evite les derniers secrets a l'entrainement", () => {
    for (let i = 0; i < 50; i++) expect(tirerAuHasard(["a", "b", "c"], ["a", "b"])).toBe("c");
    expect(tirerAuHasard(["a"], ["a"])).toBe("a");
    expect(tirerAuHasard([], [])).toBeNull();
  });
});

describe("defi du jour", () => {
  const jour = decalerJour(EPOQUE, 12);

  it("pose les memes reponses dans toutes les langues", () => {
    const fr = defiMlbbdle("fr", jour)!;
    expect(fr.numero).toBe(13);
    for (const l of LANGUES) {
      const d = defiMlbbdle(l, jour)!;
      expect(d.classique).toBe(fr.classique);
      expect(d.competence?.reponse).toBe(fr.competence?.reponse);
      expect(d.competence?.icone).toBe(fr.competence?.icone);
    }
  });

  it("donne les reponses de la veille, sauf le premier jour", () => {
    const veille = defiMlbbdle("en", decalerJour(jour, -1))!;
    expect(defiMlbbdle("en", jour)!.hier).toEqual({
      classique: veille.classique,
      competence: veille.competence?.reponse ?? null,
    });
    expect(defiMlbbdle("en", EPOQUE)!.hier).toBeNull();
  });

  it("masque le nom du heros dans l'enigme de competence, dans chaque langue", () => {
    const noms = new Map(rosterMlbbdle("en").heros.map((x) => [x.slug, x.nom]));
    const fuites: string[] = [];
    for (let i = 0; i < 45; i++) {
      for (const l of LANGUES) {
        const e = defiMlbbdle(l, decalerJour(EPOQUE, i))?.competence;
        if (!e) continue;
        const nom = noms.get(e.reponse)!;
        for (const texte of [e.nom, e.extrait ?? ""]) if (contientNom(texte, nom)) fuites.push(`${l}/${e.reponse}`);
      }
    }
    expect(fuites).toEqual([]);
  });

  it("donne a chaque valeur du roster un libelle dans chaque langue", () => {
    for (const l of LANGUES) {
      const { heros, libelles } = rosterMlbbdle(l);
      expect(heros.length).toBeGreaterThan(100);
      const manquants = heros.flatMap((x) => [
        ...(x.genre ? [`genre.${x.genre}`] : []),
        ...x.roles.map((r) => `roles.${r}`),
        ...x.lanes.map((v) => `lanes.${v}`),
        ...x.specialites.map((v) => `specialites.${v}`),
        ...(["degats", "attaque", "ressource", "region"] as const).flatMap((c) => (x[c] ? [`${c}.${x[c]}`] : [])),
      ]).filter((cle) => !libelles[cle] || libelles[cle].startsWith("pages."));
      expect(manquants).toEqual([]);
    }
  });
});

describe("partage et statistiques", () => {
  it("fait une ligne de carres par essai, verte pour la bonne reponse", () => {
    const cible = h({ slug: "cible" });
    expect(carres(ligneEmoji(h({ roles: ["Tank"] }), cible))).toBe(COLONNES.length);
    expect(ligneEmoji(cible, cible)).toBe("🟩".repeat(COLONNES.length));
  });

  it("resume une grille trop longue sans perdre la ligne gagnante", () => {
    const heros = Array.from({ length: 12 }, (_, i) => h({ slug: `h${i}`, annee: 2010 + i }));
    const parSlug = new Map(heros.map((x) => [x.slug, x]));
    const cible = heros[11];
    const lignes = grilleClassique(heros.map((x) => x.slug), cible, parSlug, 8);
    expect(lignes).toHaveLength(9);
    expect(lignes[7]).toBe("⋯ +4");
    expect(lignes.at(-1)).toBe("🟩".repeat(COLONNES.length));
  });

  it("ne livre aucun nom de heros dans le texte partage", () => {
    const { heros } = rosterMlbbdle("fr");
    const parSlug = new Map(heros.map((x) => [x.slug, x]));
    const essais = heros.slice(0, 5).map((x) => x.slug);
    const texte = textePartage({
      titre: "MLBBdle #3",
      lignes: [...grilleClassique(essais, heros[4], parSlug), grilleCompetence(essais, heros[4].slug)],
      url: "https://mlbbdex.com/fr/mlbbdle",
    });
    for (const x of heros.slice(0, 5)) expect(contientNom(texte, x.nom)).toBe(false);
  });

  it("compte les erreurs du mode competence", () => {
    expect(grilleCompetence(["a", "b", "c"], "c")).toBe("🟥🟥🟩");
    expect(grilleCompetence(["c"], "c")).toBe("🟩");
    const quinze = Array.from({ length: 15 }, (_, i) => `x${i}`);
    expect(grilleCompetence([...quinze, "c"], "c")).toBe("🟥×15🟩");
  });

  it("range les victoires par essais et tient la serie", () => {
    let s = enregistrerVictoire(STATS_VIDES, EPOQUE, 3);
    s = enregistrerVictoire(s, EPOQUE, 1);
    expect(s.joues).toBe(1);
    s = enregistrerVictoire(s, decalerJour(EPOQUE, 1), 25);
    expect(s.distribution[3]).toBe(1);
    expect(s.distribution[SEAU_MAX]).toBe(1);
    expect(s.serie).toBe(2);
    expect(moyenneEssais(s)).toBeCloseTo(6.5);
    expect(serieCourante(s, decalerJour(EPOQUE, 3))).toBe(0);
  });

  it("debloque les indices de competence dans l'ordre", () => {
    expect(indicesDebloques(1).size).toBe(0);
    expect([...indicesDebloques(4)]).toEqual(["couleur", "nom"]);
    expect(prochainIndice(3)).toEqual({ cle: "nom", restant: 1 });
    expect(prochainIndice(8)).toBeNull();
  });
});
