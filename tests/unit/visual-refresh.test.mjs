import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { differentImages, refreshDecision } from "../../scripts/visual-refresh.mjs";

const v1 = { file: "File:Clint (West Justice).jpg", sha1: "aaa" };
const v2 = { file: "File:Clint (West Justice).jpg", sha1: "bbb" };

describe("refreshDecision", () => {
  it("downloads a missing file", () => {
    expect(refreshDecision({ exists: false, recorded: undefined, current: v1 })).toBe("download");
    expect(refreshDecision({ exists: false, recorded: v1, current: undefined })).toBe("download");
  });

  it("keeps a file made from the wiki's current version", () => {
    expect(refreshDecision({ exists: true, recorded: v1, current: v1 })).toBe("keep");
  });

  it("downloads again a file the wiki replaced since", () => {
    expect(refreshDecision({ exists: true, recorded: v1, current: v2 })).toBe("download");
  });

  it("downloads again when the path now comes from another wiki file (a provisional one set aside)", () => {
    const live = { file: "File:Thamuz (Lord Lava).jpg", sha1: "aaa" };
    const provisional = { file: "File:Thamuz (Lord Lava; unreleased revamp).jpg", sha1: "aaa" };
    expect(refreshDecision({ exists: true, recorded: provisional, current: live })).toBe("download");
  });

  it("verifies a file downloaded before the manifest existed", () => {
    expect(refreshDecision({ exists: true, recorded: undefined, current: v1 })).toBe("verify");
  });

  it("keeps a file whose source gives no fingerprint (the game API's icons)", () => {
    expect(refreshDecision({ exists: true, recorded: undefined, current: undefined })).toBe("keep");
    expect(refreshDecision({ exists: true, recorded: undefined, current: { file: null, sha1: null } })).toBe("keep");
  });
});

/** A 64×36 test picture: a gradient, or the same with a block painted over. */
async function picture({ block = false, quality = 90 } = {}) {
  const width = 64;
  const height = 36;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const painted = block && x > 8 && x < 40 && y > 4 && y < 30;
      raw[i] = painted ? 250 : x * 4;
      raw[i + 1] = painted ? 20 : y * 7;
      raw[i + 2] = painted ? 20 : 128;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).webp({ quality }).toBuffer();
}

describe("differentImages", () => {
  it("sees the same picture through a re-encoding", async () => {
    expect(await differentImages(await picture({ quality: 90 }), await picture({ quality: 60 }))).toBe(false);
  });

  it("sees a new version of the artwork", async () => {
    expect(await differentImages(await picture(), await picture({ block: true }))).toBe(true);
  });
});
