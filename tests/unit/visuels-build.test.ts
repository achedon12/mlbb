import { describe, expect, it } from "vitest";
import { objets } from "@/lib/donnees";
import { visuelEmbleme, visuelObjet, visuelTalent } from "@/lib/visuels-build";

describe("visuelObjet", () => {
  const objet = objets("en")[0];

  it("retrouve un objet par son nom anglais", () => {
    expect(visuelObjet(objet.nom).slug).toBe(objet.slug);
  });

  it("ignore l'enchantement accole a des bottes", () => {
    expect(visuelObjet(`${objet.nom} - Encourage`).slug).toBe(objet.slug);
  });

  it("ne resout pas un nom inconnu", () => {
    expect(visuelObjet("Objet imaginaire")).toEqual({ nom: "Objet imaginaire", slug: null, image: null });
  });
});

describe("visuels de talents et d'emblemes", () => {
  it("rapproche les deux graphies de Weapons Master", () => {
    expect(visuelTalent("Weapons Master").image).not.toBeNull();
    expect(visuelTalent("Weapon Master").image).not.toBeNull();
  });

  it("trouve l'embleme par le role que donne l'API", () => {
    expect(visuelEmbleme("Marksman").image).not.toBeNull();
  });
});
