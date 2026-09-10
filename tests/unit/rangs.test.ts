import { describe, expect, it } from "vitest";
import { nomPays, rangLisible } from "@/lib/rangs";

describe("rangLisible — paliers Guerrier a Epique", () => {
  it("place le premier rank_level en Guerrier III", () => {
    const r = rangLisible(1);
    expect(r.nom).toBe("Guerrier");
    expect(r.division).toBe("III");
    expect(r.mythique).toBe(false);
    expect(r.image).toMatch(/^\/visuels\/rangs\//);
  });

  it("compte les etoiles dans la division", () => {
    // Epique I couvre rank_level 100 a 105 : 103 = 4e etoile.
    const r = rangLisible(103);
    expect(r.nom).toBe("Epique");
    expect(r.division).toBe("I");
    expect(r.etoiles).toBe(4);
    expect(r.uniteEtoiles).toBe("etoile");
  });
});

describe("rangLisible — famille Mythique", () => {
  it("compte 30 etoiles pour rank_level 166 (repere reel) et le classe en Honneur", () => {
    const r = rangLisible(166);
    expect(r.etoiles).toBe(30);
    expect(r.nom).toBe("Honneur mythique");
    expect(r.mythique).toBe(true);
  });

  it("garde le meilleur rang (182) en Honneur, jamais Gloire", () => {
    const r = rangLisible(182);
    expect(r.etoiles).toBe(46);
    expect(r.nom).toBe("Honneur mythique");
  });

  it("respecte les seuils des sous-paliers", () => {
    expect(rangLisible(160).nom).toBe("Mythique"); // 24 etoiles
    expect(rangLisible(161).nom).toBe("Honneur mythique"); // 25
    expect(rangLisible(186).nom).toBe("Gloire mythique"); // 50
    expect(rangLisible(236).nom).toBe("Immortel mythique"); // 100
  });

  it("ne descend jamais sous zero etoile a l'entree en Mythique", () => {
    expect(rangLisible(106).etoiles).toBe(0);
    expect(rangLisible(106).mythique).toBe(true);
  });
});

describe("nomPays", () => {
  it("traduit les codes connus", () => {
    expect(nomPays("FR")).toBe("France");
    expect(nomPays("fr")).toBe("France");
  });

  it("rend le code tel quel s'il est inconnu", () => {
    expect(nomPays("ZZ")).toBe("ZZ");
  });
});
