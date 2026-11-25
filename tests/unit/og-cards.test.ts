import { describe, expect, it } from "vitest";
import { metaPage, withCard } from "@/i18n/seo";
import { allHeroes, illustrations } from "@/lib/data";
import { monthKeys } from "@/lib/events-server";
import { asJpeg } from "@/lib/og/assets";
import { buildsCard, calendarCard, eventMonthCard, heroesByBuilds, skinPoster, tierListCard } from "@/lib/og/cards";
import { calendarYears } from "@/lib/skin-catalog-server";
import { sitemapEntries } from "@/lib/sitemap";

/** A hero that has a named artwork, and that artwork's name. */
const [withArt, artName] = (() => {
  for (const h of allHeroes) {
    const name = Object.keys(illustrations[h.slug] ?? {})[0];
    if (name) return [h.slug, name];
  }
  throw new Error("no artwork in the data");
})();

describe("share card helpers", () => {
  it("takes the first skin with an artwork as the poster, in the list's order", () => {
    const poster = skinPoster([
      { hero: withArt, name: "A skin without any artwork" },
      { hero: withArt, name: artName },
    ]);
    expect(poster).toEqual({ hero: withArt, name: artName, art: illustrations[withArt][artName] });
    expect(skinPoster([{ hero: withArt, name: "A skin without any artwork" }])).toBeNull();
    expect(skinPoster([])).toBeNull();
  });

  it("ranks heroes by their number of builds, ties by name, unknown heroes left out", () => {
    const [a, b, c] = allHeroes.map((h) => h.slug).sort();
    const build = (hero: string) => ({ build: { hero } });
    const ranked = heroesByBuilds([build(c), build(b), build(c), build("not-a-hero"), build(a)]);
    expect(ranked).toEqual([
      [c, 2],
      [a, 1],
      [b, 1],
    ]);
  });

  it("points a page's Open Graph and Twitter images at its own card", () => {
    const meta = withCard(metaPage("fr", { title: "Tier list jungle", description: "…", path: "/tier-list/lane/jungle" }), "fr", "/tier-list/lane/jungle");
    expect(meta.openGraph?.images).toEqual([
      { url: "/fr/tier-list/lane/jungle/opengraph-image", alt: "Tier list jungle — MLBBDex", width: 1200, height: 630 },
    ]);
    expect(meta.twitter?.images).toEqual([{ url: "/fr/tier-list/lane/jungle/opengraph-image", alt: "Tier list jungle — MLBBDex" }]);
    expect(meta.title).toBe("Tier list jungle");
  });
});

describe("community builds hub in the sitemap", () => {
  const listed = (entries: ReturnType<typeof sitemapEntries>) => entries.some((e) => /^https:\/\/[^/]+\/[a-z]+\/builds$/.test(e.url));

  it("stays out while the hub is noindex, and joins it once indexable", () => {
    expect(listed(sitemapEntries())).toBe(false);
    expect(listed(sitemapEntries({ buildsHub: false }))).toBe(false);
    expect(listed(sitemapEntries({ buildsHub: true }))).toBe(true);
  });
});

/**
 * The cards themselves, rendered as the routes serve them: a 1200 × 630
 * JPEG light enough for messaging apps (under 150 KB).
 */
describe("share images of the tier list variants, events, calendar and builds", () => {
  const MAX_BYTES = 150 * 1024;
  const jpeg = async (image: Response | null) => {
    expect(image).not.toBeNull();
    const response = await asJpeg(image!);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    return Buffer.from(await response.arrayBuffer());
  };
  const cases: [string, () => Promise<Response | null> | null][] = [
    ["tier list, lane", () => tierListCard("fr", "all", { type: "lane", value: "Jungle" })],
    ["tier list, role", () => tierListCard("ru", "all", { type: "role", value: "Marksman" })],
    ["events, month", () => eventMonthCard("en", [...monthKeys()].sort().at(-1)!)],
    ["skins calendar", () => calendarCard("th", null)],
    ["skins calendar, year", () => calendarCard("fr", calendarYears()[0])],
    ["community builds", () => buildsCard("fr")],
  ];

  for (const [name, render] of cases) {
    it(`${name}: a JPEG of 1200 × 630 under 150 KB`, { timeout: 30_000 }, async () => {
      const bytes = await jpeg(await render());
      expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
      const sharp = (await import("sharp")).default;
      expect(await sharp(bytes).metadata()).toMatchObject({ width: 1200, height: 630, format: "jpeg" });
      expect(bytes.length).toBeLessThan(MAX_BYTES);
      if (process.env.OG_SIZES) console.log(`${name}: ${(bytes.length / 1024).toFixed(1)} KB`);
    });
  }

  it("answers null for a month or a year without a page", async () => {
    expect(await eventMonthCard("fr", "1999-01")).toBeNull();
    expect(calendarCard("fr", 1999)).toBeNull();
  });
});
