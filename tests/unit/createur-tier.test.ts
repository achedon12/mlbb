import { describe, expect, it } from "vitest";
import {
  ajouterRangee,
  changerDeRangee,
  couleurTexte,
  decaler,
  decoderTier,
  deserialiser,
  encoderTier,
  etatDefaut,
  MAX_RANGEES,
  modifierRangee,
  placer,
  preremplir,
  serialiser,
  supprimerRangee,
  type EtatTier,
} from "@/lib/createur-tier";
import { heros } from "@/lib/donnees";

const slugs = heros.map((h) => h.slug);
const connus = new Set(slugs);

/** Liste complete : les 133 heros repartis sur six rangees, titre et noms accentues. */
function listePleine(): EtatTier {
  const etat = etatDefaut("Ma tier list — été 🔥");
  return {
    ...etat,
    rangees: etat.rangees.map((r, i) => ({
      ...r,
      nom: i === 0 ? "Dieux ✨" : r.nom,
      heros: slugs.filter((_, k) => k % etat.rangees.length === i),
    })),
  };
}

describe("partage par lien", () => {
  it("fait l'aller-retour, compresse ou non", async () => {
    const etat = modifierRangee(listePleine(), "d2", { couleur: "#123ABC" });
    for (const compresser of [true, false]) {
      const code = await encoderTier(etat, compresser);
      expect(code).toMatch(/^[12][A-Za-z0-9_-]+$/);
      const relu = await decoderTier(code, connus);
      expect(relu && serialiser(relu)).toBe(serialiser(etat));
      expect(relu?.rangees[2].couleur).toBe("#123abc");
    }
  });

  it("tient une liste complete en moins d'un kilo-octet grace a la compression", async () => {
    const code = await encoderTier(listePleine());
    expect(code[0]).toBe("2");
    expect(code.length).toBeLessThan(1024);
    expect(code.length).toBeLessThan((await encoderTier(listePleine(), false)).length);
  });

  it("prend toujours le code le plus court, brut quand la compression ne gagne rien", async () => {
    const minuscule: EtatTier = { titre: "", rangees: [{ id: "x", nom: "S", couleur: "#ff5a5f", heros: ["aamon"] }] };
    const code = await encoderTier(minuscule);
    expect(code[0]).toBe("1");
    expect((await decoderTier(code, connus))?.rangees[0]).toMatchObject({ nom: "S", heros: ["aamon"] });
    const defaut = await encoderTier(etatDefaut());
    expect(defaut.length).toBeLessThanOrEqual((await encoderTier(etatDefaut(), false)).length);
    expect((await decoderTier(defaut, connus))?.rangees.map((r) => r.nom)).toEqual(["S+", "S", "A", "B", "C", "D"]);
  });

  it("rejette un lien illisible sans lever d'erreur", async () => {
    for (const code of ["", "3abc", "2!!!", "1a", "2AAAA", `1${"A".repeat(20_000)}`]) {
      expect(await decoderTier(code, connus)).toBeNull();
    }
    const tronque = (await encoderTier(listePleine())).slice(0, 60);
    expect(await decoderTier(tronque, connus)).toBeNull();
  });

  it("ecarte heros inconnus, doublons et couleurs invalides, et borne les rangees", () => {
    const texte = [
      "Titre",
      "S\tzzzzzz\taamon,inconnu,aamon,akai",
      "A\tff0000\takai,alice",
      ...Array.from({ length: 20 }, (_, i) => `R${i}\t00ff00\t`),
    ].join("\n");
    const etat = deserialiser(texte, connus)!;
    expect(etat.rangees).toHaveLength(MAX_RANGEES);
    expect(etat.rangees[0]).toMatchObject({ couleur: "#94a3b8", heros: ["aamon", "akai"] });
    expect(etat.rangees[1].heros).toEqual(["alice"]);
    expect(deserialiser("seulement un titre", connus)).toBeNull();
  });
});

describe("operations", () => {
  it("place, insere avant un heros, deplace et rend a la reserve", () => {
    let etat = placer(etatDefaut(), "aamon", "d0");
    etat = placer(etat, "akai", "d0");
    etat = placer(etat, "alice", "d0", "akai");
    expect(etat.rangees[0].heros).toEqual(["aamon", "alice", "akai"]);
    etat = placer(etat, "akai", "d0", "aamon");
    expect(etat.rangees[0].heros).toEqual(["akai", "aamon", "alice"]);
    etat = decaler(etat, "akai", 1);
    expect(etat.rangees[0].heros).toEqual(["aamon", "akai", "alice"]);
    expect(decaler(etat, "aamon", -1)).toEqual(etat);
    etat = changerDeRangee(etat, "alice", 1);
    expect(etat.rangees[1].heros).toEqual(["alice"]);
    etat = placer(etat, "alice", null);
    expect(etat.rangees.flatMap((r) => r.heros)).toEqual(["aamon", "akai"]);
  });

  it("supprime une rangee (ses heros retournent a la reserve) mais jamais la derniere", () => {
    let etat = placer(etatDefaut(), "aamon", "d1");
    etat = supprimerRangee(etat, "d1");
    expect(etat.rangees.map((r) => r.id)).toEqual(["d0", "d2", "d3", "d4", "d5"]);
    expect(etat.rangees.flatMap((r) => r.heros)).toEqual([]);
    let seule: EtatTier = { titre: "", rangees: [etat.rangees[0]] };
    seule = supprimerRangee(seule, "d0");
    expect(seule.rangees).toHaveLength(1);
    const pleine = Array.from({ length: 10 }, (_, i) => i).reduce((e, i) => ajouterRangee(e, `n${i}`, "N"), etatDefaut());
    expect(pleine.rangees).toHaveLength(MAX_RANGEES);
  });

  it("pre-remplit depuis les paliers calcules, D vide", () => {
    const etat = preremplir(slugs, [[0, 1], [2], [], [3], [4, 999]], "Méta");
    expect(etat.titre).toBe("Méta");
    expect(etat.rangees.map((r) => r.heros)).toEqual([
      [slugs[0], slugs[1]], [slugs[2]], [], [slugs[3]], [slugs[4]], [],
    ]);
  });

  it("choisit un texte lisible sur chaque fond", () => {
    expect(couleurTexte("#ffd166")).toBe("#0a0e1a");
    expect(couleurTexte("#1c2742")).toBe("#ffffff");
  });
});
