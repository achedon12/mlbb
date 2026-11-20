import { describe, expect, it } from "vitest";
import {
  distinctSkinIds,
  extractAvatarIcons,
  extractIllustrations,
  fallbackFileNames,
  isProvisionalFile,
  normalizeNameSkin,
} from "../../scripts/gallery.mjs";

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

describe("extractAvatarIcons", () => {
  it("reads skin ids and names from the 'Avatar icons' gallery, without painted variants", () => {
    const wikitext = `
=== Avatar icons ===
<gallery widths="100">
File:Hero1281-icon.png|Surging Wave
Hero1284-icon.png|[[Tideborn Sailor]]
File:Hero722-icon (unreleased revamp).png|Lord of Wraith
</gallery>
==== Painted avatar icons ====
<gallery>
File:Hero1284-color01-icon.png|Coralglow Sailor
</gallery>
=== Battle emotes ===
<gallery>
File:Hero999-icon.png|Not a skin
</gallery>`;
    expect(extractAvatarIcons(wikitext)).toEqual([
      { id: "1281", name: "Surging Wave", file: "Hero1281-icon.png" },
      { id: "1284", name: "Tideborn Sailor", file: "Hero1284-icon.png" },
      { id: "722", name: "Lord of Wraith", file: "Hero722-icon (unreleased revamp).png" },
    ]);
  });
});

describe("isProvisionalFile", () => {
  it("flags unreleased, pre-revamp, leaked and fan-made files", () => {
    expect(isProvisionalFile({ name: "File:Thamuz (Lord Lava; unreleased revamp).jpg" })).toBe(true);
    expect(isProvisionalFile({ name: "Masha Rogue Talon (Original).jpg" })).toBe(true);
    expect(isProvisionalFile({ name: "x.jpg", description: "Leaked from the advance server" })).toBe(true);
    expect(isProvisionalFile({ name: "x.jpg", categories: ["Category:Fan art"] })).toBe(true);
    expect(isProvisionalFile({ name: "x.jpg", comment: "concept" })).toBe(true);
  });

  it("leaves the live artwork alone", () => {
    expect(isProvisionalFile({ name: "File:Thamuz (Lord Lava).jpg", categories: ["Category:Assets copyrighted to Moonton Games"] })).toBe(false);
    expect(isProvisionalFile({ name: "File:Kagura (Feast of Eternity).jpg", description: "== Licensing ==\n{{Fairuse}}" })).toBe(false);
    // A low-resolution stand-in for the released artwork is still the game's artwork.
    expect(isProvisionalFile({ name: "File:Odette (Virgo).jpg", description: "The first file is a placeholder for now" })).toBe(false);
  });
});

describe("fallbackFileNames", () => {
  it("names the live file a provisional one stands next to", () => {
    expect(fallbackFileNames("Thamuz (Lord Lava; unreleased revamp).jpg")).toEqual(["Thamuz (Lord Lava).jpg"]);
    expect(fallbackFileNames("Masha Rogue Talon (Original).jpg")).toEqual([
      "Masha Rogue Talon.jpg",
      "Masha (Rogue Talon).jpg",
    ]);
    expect(fallbackFileNames("Kagura (Feast of Eternity).jpg")).toEqual([]);
  });
});
