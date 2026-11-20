import { describe, expect, it } from "vitest";
import {
  WITHHELD_ARTWORKS,
  alteredArtwork,
  candidateRows,
  distinctSkinIds,
  extractAvatarIcons,
  extractIllustrations,
  fallbackFileNames,
  heroOfFile,
  isProvisionalFile,
  isWithheldArtwork,
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

describe("alteredArtwork", () => {
  it("flags edits, beta or unfinished versions, crops and retired versions by name", () => {
    expect(alteredArtwork({ name: "File:Aldous Death-picsay.png" })).toBe("altered");
    expect(alteredArtwork({ name: "File:Atlas HQHeroAtlas451 add-qlpicsay.png" })).toBe("altered");
    expect(alteredArtwork({ name: "File:Arlott Splash Art Unfinished.png" })).toBe("altered");
    expect(alteredArtwork({ name: "File:Lylia (Beta).jpg" })).toBe("altered");
    expect(alteredArtwork({ name: "x.jpg", comment: "cropped from the trailer" })).toBe("altered");
    expect(alteredArtwork({ name: "x.jpg", description: "Upscaled by me" })).toBe("altered");
    expect(alteredArtwork({ name: "File:Kadita (Ocean Goddess; 2018-2026).jpg" })).toBe("altered");
    expect(alteredArtwork({ name: "File:Angela (Floral Elf) (2021-2026).jpg" })).toBe("altered");
  });

  it("flags a picture too small or of the wrong shape to be the artwork", () => {
    expect(alteredArtwork({ name: "File:Miya (Captain Thorns).jpg", width: 554, height: 334 })).toBe("low-resolution");
    expect(alteredArtwork({ name: "File:Akai (Street Enforcer).jpg", width: 696, height: 392 })).toBe("low-resolution");
    // A portrait poster, not the 16:9 splash art.
    expect(alteredArtwork({ name: "File:The Pale Phantom.jpg", width: 1083, height: 1900 })).toBe("low-resolution");
  });

  it("leaves the published artwork alone", () => {
    expect(alteredArtwork({ name: "File:Kagura (Feast of Eternity).jpg", width: 1920, height: 1080 })).toBeNull();
    expect(alteredArtwork({ name: "File:Akai (Monk).jpg", width: 1780, height: 1000 })).toBeNull();
    expect(alteredArtwork({ name: "File:Beatrix (Sky Force Maverick).jpg", width: 960, height: 540 })).toBeNull();
    // A revamp is the current artwork, and Edith is a hero, not an edit.
    expect(alteredArtwork({ name: "File:Zhask-Cancer-Revamp.jpg", description: "Revamped" })).toBeNull();
    expect(alteredArtwork({ name: "File:Edith (Ancient Guard).jpg", categories: ["Category:Edith"] })).toBeNull();
    // Size unknown: not held against the file.
    expect(alteredArtwork({ name: "File:Aamon (Soul Reaper).jpg" })).toBeNull();
  });
});

describe("heroOfFile", () => {
  const names = ["Selena", "Karina", "Yu Zhong", "Yin", "Yi Sun-shin", "Benedetta", "Aamon"];
  it("names the hero a file is named after, the longest match first", () => {
    expect(heroOfFile("File:Selena (Gemini - Shadow).jpg", names)).toBe("Selena");
    expect(heroOfFile("Yu zhong b.png", names)).toBe("Yu Zhong");
    expect(heroOfFile("Yi Sun-shin (Azure Sentry).jpg", names)).toBe("Yi Sun-shin");
    expect(heroOfFile("Benedetta(Street Blow).jpg", names)).toBe("Benedetta");
  });

  it("does not take a word prefix for a hero", () => {
    expect(heroOfFile("Yindra (Test).jpg", names)).toBeNull();
    expect(heroOfFile("(Night's Edge).jpg", names)).toBeNull();
  });
});

describe("candidateRows", () => {
  const heroes = ["Karina", "Selena", "Freya", "Zilong", "Alice", "Atlas", "Thamuz", "Aamon"];

  it("tries the hero's own file before another hero's artwork, and keeps the shared one after it", () => {
    expect(candidateRows([{ file: "Selena (Gemini - Shadow).jpg", skin: "Gemini - Halo" }], "Karina", heroes)).toEqual([
      { file: "Karina (Gemini - Halo).jpg", skin: "Gemini - Halo", fallback: true },
      { file: "Selena (Gemini - Shadow).jpg", skin: "Gemini - Halo" },
    ]);
  });

  it("replaces an altered copy by the usual name", () => {
    expect(candidateRows([{ file: "Atlas HQHeroAtlas451 add-qlpicsay.png", skin: "Jade Empress" }], "Alice", heroes)).toEqual([
      { file: "Alice (Jade Empress).jpg", skin: "Jade Empress", fallback: true },
    ]);
  });

  it("replaces a provisional file by the live one, once", () => {
    expect(candidateRows([{ file: "Thamuz (Lord Lava; unreleased revamp).jpg", skin: "Lord Lava" }], "Thamuz", heroes)).toEqual([
      { file: "Thamuz (Lord Lava).jpg", skin: "Lord Lava", fallback: true },
    ]);
  });

  it("tries the gallery's file first, the usual name only after it", () => {
    expect(candidateRows([{ file: "Aamon (Soul Reaper).jpg", skin: "Soul Reaver" }], "Aamon", heroes)).toEqual([
      { file: "Aamon (Soul Reaper).jpg", skin: "Soul Reaver" },
      { file: "Aamon (Soul Reaver).jpg", skin: "Soul Reaver", fallback: true },
    ]);
    expect(candidateRows([{ file: "Aamon (Duke of Shards).jpg", skin: "Duke of Shards" }], "Aamon", heroes)).toEqual([
      { file: "Aamon (Duke of Shards).jpg", skin: "Duke of Shards" },
    ]);
  });
});

describe("isWithheldArtwork", () => {
  it("matches the hand-checked list by hero and file, with or without the File: prefix", () => {
    expect(isWithheldArtwork("karina", "File:Selena (Gemini - Shadow).jpg")).toBe(true);
    expect(isWithheldArtwork("karina", "Selena (Gemini - Shadow).jpg")).toBe(true);
    // The same file stays Selena's own artwork.
    expect(isWithheldArtwork("selena", "File:Selena (Gemini - Shadow).jpg")).toBe(false);
  });

  it("gives evidence for every entry", () => {
    for (const w of WITHHELD_ARTWORKS) {
      expect(w.file).toMatch(/^File:/);
      expect(w.evidence).toMatch(/^https:\/\/mobile-legends\.fandom\.com\/wiki\/File:/);
      expect(w.reason).toBeTruthy();
    }
  });
});
