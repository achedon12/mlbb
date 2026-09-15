import { describe, expect, it } from "vitest";
import {
  MAX_SITEMAP_URLS,
  renderSitemapIndex,
  renderUrlset,
  SITEMAPS,
  sitemapEntries,
  sitemapGroupOf,
  sitemapGroups,
  sitemapUrl,
} from "@/lib/sitemap";

describe("sitemap", () => {
  const urls = sitemapEntries().map((e) => String(e.url));

  it("includes the home page and main sections", () => {
    for (const path of ["", "/heroes", "/tier-list", "/compare", "/patch-notes"]) {
      expect(urls.some((u) => u.endsWith(path) || u.endsWith(`${path}`))).toBe(true);
    }
  });

  it("includes legal pages", () => {
    expect(urls.some((u) => u.endsWith("/legal"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/privacy"))).toBe(true);
  });

  it("lists hero pages", () => {
    expect(urls.some((u) => /\/heroes\/[a-z-]+$/.test(u))).toBe(true);
  });

  it("exposes neither the account nor the login page", () => {
    expect(urls.some((u) => u.endsWith("/account"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/login"))).toBe(false);
  });

  it("contains no duplicates", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("sitemap split by page type", () => {
  const groups = sitemapGroups();

  it("distributes every entry to exactly one child, in the original order", () => {
    const all = sitemapEntries();
    const order = new Map(all.map((e, i) => [e.url, i]));
    const children = [...groups.values()].flat();
    expect(children).toHaveLength(all.length);
    for (const [, entries] of groups) {
      const positions = entries.map((e) => order.get(e.url) ?? -1);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
    expect(new Set(children.map((e) => e.url)).size).toBe(all.length);
  });

  it("keeps every child under Google's URL cap", () => {
    for (const entries of groups.values()) expect(entries.length).toBeLessThanOrEqual(MAX_SITEMAP_URLS);
  });

  it("files each page type in its own child", () => {
    const base = "https://mlbbdex.com/fr";
    expect(sitemapGroupOf(`${base}`)).toBe("pages");
    expect(sitemapGroupOf(`${base}/heroes`)).toBe("pages");
    expect(sitemapGroupOf(`${base}/heroes/role/tank`)).toBe("pages");
    expect(sitemapGroupOf(`${base}/heroes/lolita`)).toBe("heroes");
    expect(sitemapGroupOf(`${base}/heroes/lolita/counters`)).toBe("hero-counters");
    expect(sitemapGroupOf(`${base}/heroes/lolita/duos`)).toBe("hero-duos");
    expect(sitemapGroupOf(`${base}/heroes/lolita/skins`)).toBe("hero-skins");
    expect(sitemapGroupOf(`${base}/compare`)).toBe("pages");
    expect(sitemapGroupOf(`${base}/compare/lolita-vs-tigreal`)).toBe("compare");
    expect(sitemapGroupOf(`${base}/items/blade-of-despair`)).toBe("items");
    expect(sitemapGroupOf(`${base}/spells/flicker`)).toBe("emblems-spells");
    expect(sitemapGroupOf(`${base}/tier-list/lane/gold`)).toBe("tier-lists");
    expect(sitemapGroupOf(`${base}/statistics`)).toBe("tier-lists");
    expect(sitemapGroupOf(`${base}/events/2026-08`)).toBe("events");
    expect(sitemapGroupOf(`${base}/patch-notes/1.8.92`)).toBe("patch-notes");
    expect(sitemapGroupOf(`${base}/news/some-article`)).toBe("news");
  });

  it("lists every non-empty child in the index", () => {
    const index = renderSitemapIndex();
    expect(index).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const listed = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const expected = SITEMAPS.filter((s) => groups.get(s.name)!.length > 0).map((s) => sitemapUrl(s.name));
    expect(listed).toEqual(expected);
    expect(listed.length).toBeGreaterThan(5);
  });

  it("serializes entries the way Next serializes a sitemap route", () => {
    const xml = renderUrlset([
      { url: "https://mlbbdex.com/en", lastModified: new Date("2026-09-11T08:19:47.144Z"), changeFrequency: "daily", priority: 1 },
      { url: "https://mlbbdex.com/en/about", changeFrequency: "yearly", priority: 0.3 },
    ]);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "<url>\n<loc>https://mlbbdex.com/en</loc>\n<lastmod>2026-09-11T08:19:47.144Z</lastmod>\n<changefreq>daily</changefreq>\n<priority>1</priority>\n</url>\n" +
        "<url>\n<loc>https://mlbbdex.com/en/about</loc>\n<changefreq>yearly</changefreq>\n<priority>0.3</priority>\n</url>\n" +
        "</urlset>\n",
    );
  });
});
