import { describe, expect, it } from "vitest";
import { extraireIllustrations, normaliserNomSkin } from "../../scripts/galerie.mjs";

describe("extraireIllustrations", () => {
  it("lit les galeries de la section « Splash art » et de ses sous-sections", () => {
    const wikitexte = `
== Splash art ==
<gallery>
File:Aamon Default.jpg|Default
Aamon Vessel.png|[[Vessel of Deceit]]
</gallery>
=== Old ===
<gallery>
File:Aamon Old.jpg|'''Old''' Default<br>(2021)
</gallery>
== Trivia ==
<gallery>
File:Hors section.jpg|Ailleurs
</gallery>`;
    expect(extraireIllustrations(wikitexte)).toEqual([
      { fichier: "Aamon Default.jpg", skin: "Default" },
      { fichier: "Aamon Vessel.png", skin: "Vessel of Deceit" },
      { fichier: "Aamon Old.jpg", skin: "Old Default" },
    ]);
  });

  it("accepte « Artwork » et ignore les options de la legende", () => {
    const wikitexte = `
==Artworks==
<gallery mode="packed">
File:Miya.jpg|link=Miya|Moonlight Archer
File:Miya.jpg|Doublon
</gallery>`;
    expect(extraireIllustrations(wikitexte)).toEqual([{ fichier: "Miya.jpg", skin: "Moonlight Archer" }]);
  });

  it("ne renvoie rien sans section d'illustrations", () => {
    expect(extraireIllustrations("== Lore ==\nTexte")).toEqual([]);
  });
});

describe("normaliserNomSkin", () => {
  it("rapproche casse, accents, ponctuation et precisions", () => {
    expect(normaliserNomSkin("Vessel Of Deceit")).toBe(normaliserNomSkin("Vessel of Deceit"));
    expect(normaliserNomSkin("Épée & Bouclier (Starlight)")).toBe("epeeandbouclier");
  });
});
