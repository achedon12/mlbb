import { describe, expect, it } from "vitest";
import {
  FENETRE_FORME,
  evolution,
  fichesHerosRang,
  positionDe,
  statsParPosition,
  statsParRole,
} from "@/lib/analyse-joueur";
import { buildsJoues, contres } from "@/lib/donnees";
import { lireHerosFrequents, lireJson, lireParties, type PartieResume } from "@/lib/joueur-api";
import { comparerHeros } from "@/lib/profil-joueur";
import { HEROS_FREQUENTS, historiqueBrut, pageHistorique } from "./echantillons-joueur";

const frequents = lireHerosFrequents(HEROS_FREQUENTS.data).entrees;

/** Partie deja lue ; le nom « #hid » fait retrouver la fiche du site par l'identifiant du jeu. */
let numero = 0;
const partie = (hid: number, lane: number | null, victoire: boolean | null, date: number | null = null): PartieResume => ({
  id: String(++numero),
  saison: 40,
  heros: { hid, nom: hid === 999 ? "Nouveau Heros" : `#${hid}`, image: null },
  eliminations: 0,
  morts: 0,
  assistances: 0,
  lane,
  note: null,
  mvp: false,
  victoire,
  date,
});
const repeter = (n: number, fabrique: (i: number) => PartieResume) => Array.from({ length: n }, (_, i) => fabrique(i));

/** L'historique d'exemple, relu comme le fait la page : texte brut, grands entiers compris. */
const historique = lireParties((lireJson(pageHistorique(historiqueBrut(), null)) as { data: unknown }).data).entrees;

describe("statsParRole", () => {
  const bilan = statsParRole(frequents);

  it("compte chaque heros dans ses roles, sur toute la saison", () => {
    expect(bilan.total).toBe(58);
    expect(bilan.ecartees).toBe(0);
    expect(bilan.lignes.map((l) => [l.cle, l.parties, l.victoires])).toEqual([
      ["Assassin", 33, 24],
      // Lolita est Support et Tank : ses parties comptent dans les deux.
      ["Support", 12, 4],
      ["Tank", 12, 4],
      ["Marksman", 7, 5],
      ["Mage", 6, 2],
    ]);
    expect(bilan.lignes[0].taux).toBeCloseTo((24 / 33) * 100);
    expect(bilan.lignes[0].part).toBeCloseTo((33 / 58) * 100);
  });

  it("ne designe point fort et point faible qu'a partir du minimum de parties", () => {
    // Tireur (5 sur 7) a un meilleur taux que Tank, mais trop peu de parties.
    expect(bilan.fort).toBe("Assassin");
    expect(bilan.faible).toBe("Support");
  });

  it("ecarte un heros inconnu du site et ne designe rien sans contraste", () => {
    const b = statsParRole([
      { heros: { hid: 999, nom: "Nouveau Heros", image: null }, parties: 4, victoires: 2, note: null },
      { heros: { hid: 84, nom: "Ling", image: null }, parties: 20, victoires: 10, note: null },
    ]);
    expect(b).toMatchObject({ total: 24, ecartees: 4, fort: null, faible: null });
    expect(statsParRole([])).toEqual({ lignes: [], total: 0, ecartees: 0, fort: null, faible: null });
  });
});

describe("statsParPosition", () => {
  const parties = [
    ...repeter(12, (i) => partie(84, 4, i < 9)),
    ...repeter(10, (i) => partie(20, 3, i < 3)),
    ...repeter(3, () => partie(36, 2, true)),
    // Sans `lid` : Miya n'a qu'une position au catalogue, Chou en a deux, le nouveau heros aucune.
    ...repeter(2, () => partie(1, null, false)),
    partie(26, null, true),
    partie(999, null, true),
    // Issue inconnue : ne compte nulle part.
    partie(84, 4, null),
  ];
  const bilan = statsParPosition(parties);

  it("suit la position annoncee, et celle du catalogue quand elle est unique", () => {
    expect(bilan.lignes.map((l) => [l.cle, l.parties, l.victoires])).toEqual([
      ["Jungle", 12, 9],
      ["Roam", 10, 3],
      ["Milieu", 3, 3],
      ["Or", 2, 0],
    ]);
    expect(bilan).toMatchObject({ total: 27, ecartees: 2, fort: "Jungle", faible: "Roam" });
    expect(bilan.lignes.reduce((s, l) => s + l.part, 0)).toBeCloseTo(100);
  });

  it("lit une position hors plage comme absente", () => {
    expect(positionDe(partie(84, 9, true))).toBe("Jungle");
    expect(positionDe(partie(26, 9, true))).toBeNull();
  });
});

describe("evolution", () => {
  const evo = evolution(historique);

  it("compte series et forme sans les parties a l'issue inconnue", () => {
    expect(historique).toHaveLength(31);
    expect(evo).toMatchObject({
      parties: 30,
      victoires: 18,
      serieEnCours: { victoire: true, longueur: 4 },
      meilleureSerie: 7,
      pireSerie: 4,
      forme: 70,
    });
  });

  it("trace le taux glissant et le taux cumule a partir de la premiere fenetre complete", () => {
    const courbe = evo.courbe!;
    expect(courbe.glissante).toHaveLength(30 - FENETRE_FORME + 1);
    expect(courbe.cumulee).toHaveLength(courbe.glissante.length);
    expect(courbe.dates).toHaveLength(courbe.glissante.length);
    expect(courbe.glissante[0]).toBe(60);
    expect(courbe.glissante.at(-1)).toBe(70);
    expect(courbe.cumulee.at(-1)).toBe(60);
    expect(courbe.dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
    expect(courbe.dates[0]).toBe("2026-03-03");
    expect(courbe.dates.at(-1)).toBe("2026-03-08");
  });

  it("date une partie sans horodatage d'apres sa voisine", () => {
    const sansDate = [partie(84, 4, true, null), ...repeter(11, (i) => partie(84, 4, i % 2 === 0, 1774857999 - i * 60))];
    const courbe = evolution(sansDate).courbe!;
    expect(courbe.dates.at(-1)).toBe(courbe.dates.at(-2));
  });

  it("renonce a la courbe sans assez de parties ou sans aucune date", () => {
    const courtes = evolution(repeter(FENETRE_FORME, (i) => partie(84, 4, i < 5, 1774857999)));
    expect(courtes).toMatchObject({ parties: FENETRE_FORME, forme: 50, courbe: null });
    expect(evolution(repeter(15, (i) => partie(84, 4, i < 5))).courbe).toBeNull();
    expect(evolution([])).toMatchObject({ parties: 0, serieEnCours: null, forme: null, courbe: null, meilleureSerie: 0 });
  });
});

describe("fichesHerosRang", () => {
  const lignes = comparerHeros(frequents, "mythic");

  it("donne pour les heros les plus joues le build le plus joue du rang et ses pires contres", () => {
    const fiches = fichesHerosRang(lignes, "mythic", historique);
    expect(fiches.map((f) => f.ligne.heros.slug)).toEqual(["ling", "lolita", "fanny"]);

    const ling = fiches[0];
    const attendu = [...buildsJoues.ling.Jungle.mythic!].sort((a, b) => (b.pickRate ?? 0) - (a.pickRate ?? 0))[0];
    expect(ling).toMatchObject({ lane: "Jungle", rangBuild: "mythic", rangContres: "mythic" });
    expect(ling.build!.objets.map((o) => o.nom)).toEqual(attendu.items);
    expect(ling.build!.objets[0].slug).not.toBeNull();

    const pires = [...contres.ling.mythic!.weak].sort((a, b) => a.advantage - b.advantage).slice(0, 3);
    expect(ling.faibles.map((c) => c.heros.slug)).toEqual(pires.map((c) => c.slug));
    const ecarts = ling.faibles.map((c) => c.avantage);
    expect(ecarts).toEqual([...ecarts].sort((a, b) => a - b));
    expect(ecarts.every((e) => e < 0)).toBe(true);
  });

  const ligne = (hid: number, nom: string, parties: number, victoires: number) =>
    comparerHeros([{ heros: { hid, nom, image: null }, parties, victoires, note: null }], "mythic");

  it("retient la position ou le joueur joue le heros, sinon celle du catalogue", () => {
    const chou = ligne(26, "Chou", 10, 5);
    const enRoam = fichesHerosRang(chou, "mythic", [partie(26, 3, true), partie(26, 3, false), partie(26, 1, true)]);
    expect(enRoam[0].lane).toBe("Roam");
    expect(enRoam[0].build!.objets[0].nom).toBe("Dominance Ice");
    expect(fichesHerosRang(chou, "mythic", [])[0].lane).toBe("Experience");
  });

  it("passe les heros inconnus du site et s'arrete au nombre demande", () => {
    expect(fichesHerosRang(ligne(999, "Nouveau Heros", 30, 3), "mythic", [])).toEqual([]);
    expect(fichesHerosRang(lignes, "mythic", [], 1)).toHaveLength(1);
  });
});
