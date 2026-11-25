import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { TITLE_MAX } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { isHubIndexable } from "@/lib/community-builds";
import { patchAnalysis } from "@/lib/content";
import { titleHero } from "@/lib/hero-title";
import { asJpeg } from "@/lib/og/assets";

describe("titleHero", () => {
  const t = createT("en");

  it("keeps MLBB and the tier when they fit", () => {
    expect(titleHero(t, "Aamon", "S", "2.2.23")).toBe("Aamon MLBB: build, emblem, counters (tier S, patch 2.2.23)");
  });

  it("drops the tier, then MLBB, for a long name", () => {
    const name = "Popol and Kupa";
    const title = titleHero(t, name, "S+", "2.2.23");
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title).not.toContain("tier");
    const longer = titleHero(t, "A name far too long for any title", "S+", "2.2.23");
    expect(longer).toBe(t("pages.seo.hero.titleShort", { name: "A name far too long for any title", v: "2.2.23" }));
  });

  it("goes without the tier when the hero has none", () => {
    expect(titleHero(t, "Aamon", undefined, "2.2.23")).toBe("Aamon MLBB: build, emblem, counters (patch 2.2.23)");
  });
});

describe("patchAnalysis", () => {
  it("finds a patch analysis and a news analysis by version", () => {
    expect(patchAnalysis("2.1.88", "en")?.href).toBe("/patch-notes/patch-2-1-88");
    expect(patchAnalysis("2.2.23", "en")?.href).toBe("/news/analyse-patch-2-2-23");
  });

  it("does not mistake a longer version for another", () => {
    expect(patchAnalysis("2.1.8", "en")).toBeNull();
    expect(patchAnalysis("1.0.0", "en")).toBeNull();
  });
});

describe("isHubIndexable", () => {
  const builds = (...heroes: string[]) => heroes.map((hero) => ({ build: { hero } }));

  it("needs builds for several heroes", () => {
    expect(isHubIndexable(builds("aamon", "aamon", "aamon"))).toBe(false);
    expect(isHubIndexable(builds("aamon", "layla", "lukas", "miya", "tigreal"))).toBe(true);
  });
});

describe("asJpeg", () => {
  it("re-encodes a PNG response as JPEG, keeping its headers", async () => {
    const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#ff0000" } }).png().toBuffer();
    const out = await asJpeg(
      new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60" } }),
    );
    expect(out.headers.get("content-type")).toBe("image/jpeg");
    expect(out.headers.get("cache-control")).toBe("public, max-age=60");
    const meta = await sharp(Buffer.from(await out.arrayBuffer())).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(40);
  });
});
