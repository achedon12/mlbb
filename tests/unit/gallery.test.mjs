import { describe, expect, it } from "vitest";
import { distinctSkinIds, extractIllustrations, normalizeNameSkin } from "../../scripts/gallery.mjs";

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

describe("distinctSkinIds", () => {
  it("gives a skin copied with another hero's id its wiki key", () => {
    const { ids, rewritten } = distinctSkinIds([
      { hero: "cici", key: "1234", id: "1255" },
      { hero: "zhuxin", key: "1255", id: "1255" },
    ]);
    expect(ids).toEqual(["1234", "1255"]);
    expect(rewritten.map((e) => e.hero)).toEqual(["cici"]);
  });

  it("leaves colour variants of one hero sharing their base id", () => {
    const { ids } = distinctSkinIds([
      { hero: "alucard", key: "012", id: "012" },
      { hero: "alucard", key: "012-color01", id: "012" },
    ]);
    expect(ids).toEqual(["012", "012"]);
  });

  it("never takes a key another skin already uses as its id", () => {
    const { ids } = distinctSkinIds([
      { hero: "a", key: "2", id: "1" },
      { hero: "b", key: "1", id: "1" },
      { hero: "c", key: "2", id: "2" },
    ]);
    expect(ids).toEqual(["1", "1", "2"]);
  });
});
