import { describe, expect, it } from "vitest";
import {
  curseurSuivant,
  lireDetailPartie,
  lireHerosFrequents,
  lireJson,
  lireParties,
  lireSaisons,
  lireStats,
  saisonsDe,
} from "@/lib/joueur-api";
import { LANE_JEU, formaterDatePartie, formaterEcart, formaterPourcent, pluriel, ratioKda } from "@/lib/format-joueur";
import {
  afficherPartie,
  bilanSaison,
  bourreaux,
  comparerHeros,
  herosAffiche,
  herosSousMoyenne,
  meilleursHeros,
  moyenneDuRang,
  trancheDuRang,
  type LigneHeros,
} from "@/lib/profil-joueur";
import { statsParRang } from "@/lib/tier-list";
import {
  DETAIL_SCHEMA,
  HEROS_FREQUENTS,
  MOI,
  PARTIES_FIN,
  PARTIES_TEXTE,
  SAISONS,
  STATS,
  detailPartie,
} from "./echantillons-joueur";

const donnees = (texte: string) => (lireJson(texte) as { data: unknown }).data;

describe("lireJson — grands entiers", () => {
  it("garde curseurs et identifiants de partie intacts, en chaines", () => {
    const lu = lireJson('{"pageInfo":{"nextCursor":4143043017340290910},"bid":4132717739868068601,"k":14}') as {
      pageInfo: { nextCursor: unknown };
      bid: unknown;
      k: unknown;
    };
    expect(lu.pageInfo.nextCursor).toBe("4143043017340290910");
    expect(lu.bid).toBe("4132717739868068601");
    expect(lu.k).toBe(14);
  });
});

describe("lireParties", () => {
  const page = lireParties(donnees(PARTIES_TEXTE));

  it("ecarte les entrees sans heros ou sans identifiant lisible", () => {
    expect(page.entrees.map((p) => p.heros.hid)).toEqual([17, 84, 20, 36, 999]);
    expect(page.suivant).toBe("4143043017340290910");
  });

  it("lit une partie complete", () => {
    const fanny = page.entrees[0];
    expect(fanny).toMatchObject({
      id: "4132717739868068534",
      saison: 40,
      eliminations: 14,
      morts: 1,
      assistances: 11,
      lane: 4,
      mvp: true,
      victoire: true,
      date: 1774857999,
    });
    expect(fanny.note).toBeCloseTo(11.8);
    expect(fanny.heros.image).toMatch(/^https:\/\/akmweb\.youngjoygame\.com\//);
  });

  it("recupere l'identifiant exact depuis le seul `bid` numerique", () => {
    expect(page.entrees[1].id).toBe("4132717739868068601");
    expect(page.entrees[1].victoire).toBe(false);
  });

  it("refuse une image hors des hotes autorises", () => {
    expect(page.entrees[3].heros.image).toBeNull();
  });

  it("tolere chaines, valeurs nulles, millisecondes et issue inconnue", () => {
    expect(page.entrees[4]).toMatchObject({
      eliminations: 4,
      morts: 0,
      lane: null,
      note: null,
      mvp: false,
      victoire: null,
      date: 1774820000,
    });
  });

  it("rend une page vide sur une reponse inattendue", () => {
    expect(lireParties(null)).toEqual({ entrees: [], suivant: null });
    expect(lireParties({ result: "x", pageInfo: 3 })).toEqual({ entrees: [], suivant: null });
    expect(lireParties(PARTIES_FIN.data)).toEqual({ entrees: [], suivant: null });
  });
});

describe("curseurSuivant", () => {
  it("s'arrete sur hasNext faux ou curseur vide", () => {
    expect(curseurSuivant({ nextCursor: "123", hasNext: false })).toBeNull();
    expect(curseurSuivant({ nextCursor: "", hasNext: true })).toBeNull();
    expect(curseurSuivant(null)).toBeNull();
  });

  it("accepte un curseur numerique sur et refuse ce qui n'est pas un nombre", () => {
    expect(curseurSuivant({ nextCursor: 11, hasNext: true })).toBe("11");
    expect(curseurSuivant({ nextCursor: "11; drop", hasNext: true })).toBeNull();
    expect(curseurSuivant({ nextCursor: "../info" })).toBeNull();
  });
});

describe("lireHerosFrequents", () => {
  const page = lireHerosFrequents(HEROS_FREQUENTS.data);

  it("garde les heros lisibles et joues au moins une fois", () => {
    expect(page.entrees.map((h) => h.heros.nom)).toEqual(["Ling", "Lolita", "Fanny", "Aurora", "Claude", "Miya"]);
  });

  it("convertit les chaines et borne les victoires aux parties", () => {
    const miya = page.entrees.at(-1)!;
    expect(miya).toMatchObject({ parties: 4, victoires: 4 });
    expect(miya.heros.hid).toBe(1);
  });

  it("ne suit pas un curseur vide, meme annonce avec hasNext", () => {
    expect(page.suivant).toBeNull();
  });
});

describe("lireStats et saisons", () => {
  it("lit l'exemple du schema", () => {
    const s = lireStats(STATS.data);
    expect(s).toMatchObject({ parties: 308, victoires: 188, mvp: 73, meilleureSerie: 11, saisons: [40, 39, 38, 37] });
    expect(s.noteMoyenne).toBeCloseTo(7.62, 2);
    expect(s.heuresJeu).toBeCloseTo(77.95);
  });

  it("rend des zeros et des absences, jamais une exception", () => {
    expect(lireStats(null)).toEqual({
      parties: 0,
      victoires: 0,
      noteMoyenne: null,
      heuresJeu: null,
      mvp: null,
      meilleureSerie: null,
      saisons: [],
    });
    expect(lireStats({ tc: "12", wc: 20, mvpc: -3 })).toMatchObject({ parties: 12, victoires: 12, mvp: null });
  });

  it("dedoublonne et trie les saisons, sans valeur invalide", () => {
    expect(saisonsDe(SAISONS.data)).toEqual([40, 39, 38, 37]);
    expect(lireSaisons([38, "40", 40, -1, 1.5, "x", null])).toEqual([40, 38]);
    expect(lireSaisons(undefined)).toEqual([]);
  });
});

describe("lireDetailPartie", () => {
  it("lit l'exemple du schema", () => {
    const [moskov] = lireDetailPartie(DETAIL_SCHEMA.data);
    expect(moskov).toMatchObject({ equipe: 2, roleId: 1880233572, zoneId: 57027, victoire: false });
    expect(moskov.heros.nom).toBe("Moskov");
  });

  it("lit une partie a dix", () => {
    expect(lireDetailPartie(detailPartie(17, [109, 30, 31, 65, 1], false).data)).toHaveLength(10);
    expect(lireDetailPartie({ result: [null, 1, "x"] })).toEqual([]);
  });
});

describe("herosAffiche", () => {
  it("retrouve la fiche du site par le nom", () => {
    expect(herosAffiche({ hid: 555, nom: "Yi Sun-shin", image: null }).slug).toBe("yi-sun-shin");
  });

  it("retrouve la fiche par l'identifiant du jeu quand le nom manque", () => {
    expect(herosAffiche({ hid: 17, nom: "#17", image: null }).slug).toBe("fanny");
    expect(herosAffiche({ hid: 1, nom: "#1", image: null }).slug).toBe("miya");
    expect(herosAffiche({ hid: 109, nom: "#109", image: null }).slug).toBe("aamon");
  });

  it("garde le nom et l'image du service pour un heros inconnu du site", () => {
    const image = "https://akmweb.youngjoygame.com/x.png";
    expect(herosAffiche({ hid: 999, nom: "Nouveau Heros", image })).toEqual({ slug: null, nom: "Nouveau Heros", portrait: image });
  });
});

describe("trancheDuRang", () => {
  it("compare sous Epique a tous rangs confondus", () => {
    expect(trancheDuRang(0)).toBe("all");
    expect(trancheDuRang(50)).toBe("all");
  });

  it("suit les tranches mesurees par le site", () => {
    expect(trancheDuRang(90)).toBe("epic");
    expect(trancheDuRang(140)).toBe("mythic");
    expect(trancheDuRang(166)).toBe("honor");
    expect(trancheDuRang(190)).toBe("glory");
    // Immortel : au-dela de la derniere tranche, compare a Gloire.
    expect(trancheDuRang(240)).toBe("glory");
  });
});

describe("comparaison aux moyennes du site", () => {
  const frequents = lireHerosFrequents(HEROS_FREQUENTS.data).entrees;

  it("prend la moyenne de la tranche, ou tous rangs a defaut", () => {
    const m = moyenneDuRang("ling", "mythic")!;
    const stats = statsParRang("ling");
    expect(m.victoire).toBe(stats[m.tranche]!.victoire);
    expect(m.tranche).toBe(stats.mythic ? "mythic" : "all");
    expect(moyenneDuRang("heros-inexistant", "mythic")).toBeNull();
  });

  it("classe les heros par parties et calcule l'ecart", () => {
    const lignes = comparerHeros(frequents, "mythic");
    expect(lignes.map((l) => l.heros.slug)).toEqual(["ling", "lolita", "fanny", "aurora", "miya", "claude"]);
    const ling = lignes[0];
    expect(ling.taux).toBeCloseTo(68);
    expect(ling.ecart).toBeCloseTo(68 - ling.moyenne!);
  });

  it("fait le bilan de la saison", () => {
    const b = bilanSaison(frequents);
    expect(b).toMatchObject({ parties: 58, victoires: 35, heros: 6 });
    expect(b.taux).toBeCloseTo((35 / 58) * 100);
    expect(bilanSaison([])).toEqual({ parties: 0, victoires: 0, taux: null, heros: 0 });
  });
});

describe("conseils", () => {
  it("prefere un taux solide a un taux flatteur sur peu de parties", () => {
    const meilleurs = meilleursHeros(comparerHeros(lireHerosFrequents(HEROS_FREQUENTS.data).entrees, "mythic"));
    // Fanny 7/8 et Ling 17/25 ; Miya 4/4 n'a pas assez de parties.
    expect(meilleurs.map((l) => l.heros.slug)).toEqual(["fanny", "ling"]);
  });

  it("signale les heros nettement sous la moyenne, les plus couteux d'abord", () => {
    const ligne = (slug: string, parties: number, ecart: number): LigneHeros => ({
      heros: { slug, nom: slug, portrait: null },
      parties,
      victoires: 0,
      taux: 50 + ecart,
      moyenne: 50,
      trancheMoyenne: "mythic",
      ecart,
      note: null,
    });
    const sous = herosSousMoyenne([ligne("a", 20, -5), ligne("b", 6, -12), ligne("c", 4, -20), ligne("d", 30, -2)]);
    expect(sous.map((l) => l.heros.slug)).toEqual(["a", "b"]);
  });
});

describe("bourreaux", () => {
  const partie = (ennemis: number[], victoire: boolean | null, avecEquipes = true) => ({
    victoire,
    participants: lireDetailPartie(detailPartie(17, ennemis, victoire ?? false, avecEquipes).data),
  });

  it("compte les adversaires des defaites, a partir de deux", () => {
    const analyse = bourreaux(
      [
        partie([109, 30, 31, 65, 1], false),
        partie([109, 30, 50, 51, 52], false),
        partie([109, 60, 61, 62, 63], true),
        // Issue absente de la liste : celle du detail prend le relais.
        partie([109, 70, 71, 72, 73], null),
        // Sans le joueur, ou sans equipes : ignorees.
        { victoire: false, participants: lireDetailPartie(DETAIL_SCHEMA.data) },
        partie([109, 30, 80, 81, 82], false, false),
      ],
      MOI,
    );
    expect(analyse.analysees).toBe(4);
    expect(analyse.liste.map((b) => [b.heros.slug, b.defaites, b.rencontres])).toEqual([
      ["aamon", 3, 4],
      ["yi-sun-shin", 2, 2],
    ]);
  });

  it("n'analyse rien quand le detail ne porte pas le joueur", () => {
    expect(bourreaux([{ victoire: false, participants: lireDetailPartie(DETAIL_SCHEMA.data) }], MOI)).toEqual({
      liste: [],
      analysees: 0,
    });
  });
});

describe("mise en forme", () => {
  it("formate selon la langue", () => {
    expect(formaterPourcent(62.5, "en")).toBe("62.5%");
    expect(formaterPourcent(62.5, "fr")).toMatch(/^62,5\s%$/u);
    expect(formaterEcart(4.25, "en")).toBe("+4.3");
    expect(formaterEcart(-3, "en")).toBe("-3");
    expect(pluriel(1, "fr")).toBe("un");
    expect(pluriel(0, "fr")).toBe("un");
    expect(pluriel(0, "en")).toBe("autres");
    expect(ratioKda(14, 0, 11)).toBe(25);
    expect(LANE_JEU[4]).toBe("Jungle");
  });

  it("date une partie en UTC cote serveur", () => {
    expect(formaterDatePartie(1774857999, "en", false)).toMatch(/^Mar 30/);
  });

  it("prepare une partie pour le navigateur, sans rien de plus que l'affichage", () => {
    const [fanny] = lireParties(donnees(PARTIES_TEXTE)).entrees;
    const affichee = afficherPartie(fanny);
    expect(affichee.heros.slug).toBe("fanny");
    expect(Object.keys(affichee).sort()).toEqual(
      ["assistances", "date", "eliminations", "heros", "id", "lane", "morts", "mvp", "note", "victoire"].sort(),
    );
  });
});
