import { describe, expect, it } from "vitest";
import { alteredArtwork, fallbackFileNames, isProvisionalFile } from "../../scripts/gallery.mjs";
import { manifestRecord, refreshedRecord } from "../../scripts/visual-refresh.mjs";
import {
  PROVISIONAL_DAYS,
  duplicateGroups,
  isProvisionalUpload,
  shapeIssue,
  visualIssues,
  visualKind,
} from "../../scripts/visual-rules.mjs";

const NOW = Date.UTC(2026, 10, 19, 12);
const DAY = 86_400_000;

describe("pre-release and third-party files", () => {
  it.each([
    "File:Suyou (Frostblade Duelist; Advance Server).jpg",
    "File:Suyou (Frostblade Duelist) advanced-server.jpg",
    "File:Kalea Tideborn Sailor Teaser.png",
    "File:Kalea (Tideborn Sailor; beta).jpg",
    "File:Zetian Sneak Peek.jpg",
    "File:Lukas (Draft).jpg",
    "File:Marcel prototype.png",
    "File:Obsidia pre-release.jpg",
  ])("marks %s as provisional", (name) => {
    expect(isProvisionalFile({ name })).toBe(true);
  });

  it("reads the wiki's categories and upload comment too", () => {
    expect(isProvisionalFile({ name: "File:Kalea (Tideborn Sailor).jpg", categories: ["Category:Test server"] })).toBe(true);
    expect(isProvisionalFile({ name: "File:Kalea (Tideborn Sailor).jpg", comment: "sneak peek from the official page" })).toBe(
      true,
    );
  });

  it.each(["File:Jawhead (Proto Sentinel).jpg", "File:Lolita (Angelic Fan).jpg", "File:Chang'e (New Moon).jpg", "File:Gord (New Baron).jpg"])(
    "does not take the skin name %s for a marker",
    (name) => {
      expect(isProvisionalFile({ name })).toBe(false);
      expect(alteredArtwork({ name })).toBeNull();
    },
  );

  it.each([
    "File:Layla screenshot.png",
    "File:Miya (Captain Thorns) watermarked.jpg",
    "File:Alucard wallpaper.jpg",
    "File:Fanny resized.jpg",
    "File:Gusion stretched.jpg",
    "File:Lesley fan edit.png",
  ])("marks %s as an altered copy", (name) => {
    expect(alteredArtwork({ name })).toBe("altered");
  });

  it("finds the live file next to a beta or teaser one", () => {
    expect(fallbackFileNames("Kalea (Tideborn Sailor; beta).jpg")).toContain("Kalea (Tideborn Sailor).jpg");
    expect(fallbackFileNames("Kalea Tideborn Sailor (Teaser).jpg")).toContain("Kalea (Tideborn Sailor).jpg");
  });
});

describe("visualKind", () => {
  it("tells artworks, portraits and icons apart by path", () => {
    expect(visualKind("/visuels/heros/miya/illustrations/captain-thorns.webp")).toBe("artwork");
    expect(visualKind("/visuels/heros/miya/skins/014-captain-thorns.webp")).toBe("portrait");
    expect(visualKind("/visuels/heros/miya/portrait.webp")).toBe("portrait");
    expect(visualKind("/visuels/heros/miya/icone.webp")).toBe("icon");
    expect(visualKind("/visuels/objets/blade-of-despair.webp")).toBeNull();
  });
});

describe("shapeIssue", () => {
  it("accepts the official sizes", () => {
    expect(shapeIssue("artwork", 1920, 1080)).toBeNull();
    expect(shapeIssue("artwork", 1280, 719)).toBeNull();
    expect(shapeIssue("portrait", 240, 390)).toBeNull();
    expect(shapeIssue("portrait", 1358, 2207)).toBeNull();
    expect(shapeIssue("icon", 100, 100)).toBeNull();
  });

  it("catches a crop, a stretched copy and a thumbnail", () => {
    // Miya "Captain Thorns": a 554 x 334 crop of a social media post.
    expect(shapeIssue("artwork", 554, 334)).toBe("low-resolution");
    expect(shapeIssue("artwork", 1280, 1280)).toBe("ratio");
    expect(shapeIssue("artwork", 2560, 900)).toBe("ratio");
    expect(shapeIssue("portrait", 390, 240)).toBe("ratio");
    expect(shapeIssue("portrait", 120, 195)).toBe("low-resolution");
    expect(shapeIssue("icon", 100, 60)).toBe("ratio");
  });

  it("does not hold an unknown size against a file", () => {
    expect(shapeIssue("artwork", undefined, undefined)).toBeNull();
    expect(shapeIssue(null, 10, 10)).toBeNull();
  });
});

describe("visualIssues", () => {
  const art = "/visuels/heros/aldous/illustrations/death.webp";

  it("lists every category a visual falls into", () => {
    expect(visualIssues({ path: art, source: { file: "File:Aldous Death-picsay.png" }, width: 1280, height: 720 })).toEqual([
      "altered",
    ]);
    expect(
      visualIssues({
        path: "/visuels/heros/miya/illustrations/captain-thorns.webp",
        source: { file: "File:Miya (Captain Thorns).jpg" },
        width: 554,
        height: 334,
      }),
    ).toEqual(["withheld", "low-resolution"]);
    expect(visualIssues({ path: art, source: { file: "File:Aldous (Death; Advance Server).jpg" } })).toEqual(["pre-release"]);
    expect(visualIssues({ path: art, source: undefined, width: 1280, height: 720 })).toEqual(["unknown-source"]);
  });

  it("finds nothing wrong with an official artwork", () => {
    expect(visualIssues({ path: art, source: { file: "File:Aldous (Death).jpg" }, width: 1280, height: 720 })).toEqual([]);
  });

  it("holds the words of a full-size artwork's edit against artworks only", () => {
    const icon = "/visuels/heros/aldous/icone.webp";
    expect(visualIssues({ path: icon, source: { file: "File:Hero641-icon cropped.png" }, width: 100, height: 100 })).toEqual([]);
  });
});

describe("duplicateGroups", () => {
  it("groups paths of the same wiki file or the same bytes", () => {
    const groups = duplicateGroups([
      { path: "/a", sha1: "1", hash: "x" },
      { path: "/b", sha1: "1", hash: "y" },
      { path: "/c", sha1: "2", hash: "y" },
      { path: "/d", sha1: "3", hash: "z" },
    ]);
    expect(groups).toEqual([
      ["/a", "/b"],
      ["/b", "/c"],
    ]);
  });

  it("reports a group once", () => {
    expect(duplicateGroups([{ path: "/a", sha1: "1", hash: "x" }, { path: "/b", sha1: "1", hash: "x" }])).toEqual([["/a", "/b"]]);
  });
});

describe("isProvisionalUpload", () => {
  it("holds a recent upload, or one of unknown date, as provisional", () => {
    expect(isProvisionalUpload(new Date(NOW - 5 * DAY).toISOString(), NOW)).toBe(true);
    expect(isProvisionalUpload(null, NOW)).toBe(true);
    expect(isProvisionalUpload(new Date(NOW - (PROVISIONAL_DAYS + 1) * DAY).toISOString(), NOW)).toBe(false);
  });
});

describe("manifest records", () => {
  const current = { file: "File:Bruno (The Protector).jpg", sha1: "abc", timestamp: "2026-09-03T00:00:00Z", width: 1920, height: 1080 };

  it("records the size of the wiki's original", () => {
    expect(manifestRecord(current)).toEqual({ ...current });
    expect(manifestRecord({ ...current, width: null, height: null })).toEqual({
      file: current.file,
      sha1: "abc",
      timestamp: current.timestamp,
    });
    expect(manifestRecord({ file: "x" })).toBeNull();
  });

  it("completes the entry of a kept file of the same version only", () => {
    const old = { file: current.file, sha1: "abc", timestamp: current.timestamp };
    expect(refreshedRecord(old, current)).toEqual({ ...current });
    const other = { ...old, sha1: "def" };
    expect(refreshedRecord(other, current)).toBe(other);
    expect(refreshedRecord(old, undefined)).toBe(old);
  });
});
