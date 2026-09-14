import { describe, expect, it } from "vitest";
import { extractIllustrations, normalizeNameSkin } from "../../scripts/gallery.mjs";

describe("extractIllustrations", () => {
  it("reads galleries from the 'Splash art' section and its subsections", () => {
    const wikitext = `
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
    expect(extractIllustrations(wikitext)).toEqual([
      { file: "Aamon Default.jpg", skin: "Default" },
      { file: "Aamon Vessel.png", skin: "Vessel of Deceit" },
      { file: "Aamon Old.jpg", skin: "Old Default" },
    ]);
  });

  it("accepts 'Artwork' and ignores caption options", () => {
    const wikitext = `
==Artworks==
<gallery mode="packed">
File:Miya.jpg|link=Miya|Moonlight Archer
File:Miya.jpg|Doublon
</gallery>`;
    expect(extractIllustrations(wikitext)).toEqual([{ file: "Miya.jpg", skin: "Moonlight Archer" }]);
  });

  it("returns nothing without an illustrations section", () => {
    expect(extractIllustrations("== Lore ==\nTexte")).toEqual([]);
  });
});

describe("normalizeNameSkin", () => {
  it("matches regardless of case, accents, punctuation and qualifiers", () => {
    expect(normalizeNameSkin("Vessel Of Deceit")).toBe(normalizeNameSkin("Vessel of Deceit"));
    expect(normalizeNameSkin("Épée & Bouclier (Starlight)")).toBe("epeeandbouclier");
  });
});
