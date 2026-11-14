import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LANES } from "@/lib/draft";
import { laneKit, shownKit, KIT_MIN_SHARE } from "@/lib/guide-lanes";
import {
  anchorOf,
  blocksOf,
  GUIDE_LANE_OF_ROLE,
  guide,
  guideHeadings,
  guideOfLane,
  guides,
  guideSlugs,
  internalLinks,
  readingMinutes,
  renderGuide,
} from "@/lib/guides";
import { cleanGuideHtml } from "@/lib/html";
import { BASE } from "@/lib/sections";
import { sitemapEntries } from "@/lib/sitemap";
import { LOCALES } from "@/i18n/config";
import type { BuildPlayed, BuildsHero } from "@/lib/data";

/**
 * Guides: the files, their front matter, their links and their translations.
 *
 * A guide links to heroes, items, spells and tools on almost every line. A
 * hero renamed or an item removed at a sync would leave a dead link in the
 * text: every internal link must point to a page the sitemap lists.
 */
const slugs = guideSlugs();
const french = guides("fr");

/** Every path the site publishes, without locale ("/heroes/ling"). */
const published = new Set(
  sitemapEntries().map((e) => new URL(e.url).pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/"),
);

describe("guide files", () => {
  it("has the eight strategy guides and one guide per lane", () => {
    expect(french.filter((g) => g.kind === "strategy")).toHaveLength(8);
    const roles = french.filter((g) => g.kind === "role");
    expect(roles.map((g) => g.lane).sort()).toEqual([...LANES].sort());
  });

  it("gives every guide a URL-safe slug, a title, a short name, a summary and dates", () => {
    for (const g of french) {
      expect(g.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(g.title.length).toBeGreaterThan(10);
      expect(g.short.length).toBeGreaterThan(2);
      expect(g.short.length).toBeLessThan(g.title.length);
      // The summary is the meta description: one or two sentences.
      expect(g.summary.length).toBeGreaterThan(60);
      expect(g.summary.length).toBeLessThan(260);
      expect(g.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(g.updated >= g.date).toBe(true);
    }
  });

  it("orders each kind without ties", () => {
    for (const kind of ["strategy", "role"] as const) {
      const orders = french.filter((g) => g.kind === kind).map((g) => g.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it("relates guides that exist, never the guide itself", () => {
    for (const g of french) {
      expect(g.related.length).toBeGreaterThan(0);
      for (const r of g.related) {
        expect(slugs, `${g.slug} → ${r}`).toContain(r);
        expect(r).not.toBe(g.slug);
      }
    }
  });

  it("only names tools that are in the site menu", () => {
    const menu = new Set(BASE.map((e) => e.href));
    for (const g of french) {
      expect(g.tools.length).toBeGreaterThan(0);
      for (const tool of g.tools) expect(menu.has(tool), `${g.slug}: ${tool}`).toBe(true);
    }
  });

  it("places both live blocks in a role guide, none in a strategy guide", () => {
    for (const g of french) {
      expect(blocksOf(g.content), g.slug).toEqual(g.kind === "role" ? ["heroes", "kit"] : []);
    }
  });

  it("gives a role guide to every lane, and every role a lane guide", () => {
    for (const lane of LANES) expect(guideOfLane(lane, "fr")?.lane).toBe(lane);
    for (const lane of Object.values(GUIDE_LANE_OF_ROLE)) expect(guideOfLane(lane, "fr")).toBeDefined();
  });
});

describe("guide links", () => {
  it("lists the hub and every guide in the sitemap", () => {
    expect(published.has("/guides")).toBe(true);
    for (const slug of slugs) expect(published.has(`/guides/${slug}`), slug).toBe(true);
  });

  it("points every internal link of every language to a published page", () => {
    const dead: string[] = [];
    for (const locale of LOCALES) {
      for (const g of guides(locale)) {
        for (const target of internalLinks(g.content)) {
          if (!published.has(target)) dead.push(`${locale}/${g.slug}: ${target}`);
        }
      }
    }
    expect(dead).toEqual([]);
  });

  it("links every guide to the site's data pages", () => {
    for (const g of french) {
      const links = internalLinks(g.content);
      expect(links.length, g.slug).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps every link well formed in every language", () => {
    const broken: string[] = [];
    for (const locale of LOCALES) {
      for (const g of guides(locale)) {
        // Every `](/…)` must close a `[label]` that has no stray bracket.
        const addresses = g.content.match(/\]\(\//g)?.length ?? 0;
        const links = g.content.match(/\[[^[\]\n]+\]\(\/[^)\s]*\)/g)?.length ?? 0;
        if (addresses !== links || /\]\]|\[\[/.test(g.content)) broken.push(`${locale}/${g.slug}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("keeps the structure of the French text in every translation, with no line left empty", () => {
    // Each line's Markdown marker (heading, list item, number), and whether it has text.
    const shape = (markdown: string) =>
      markdown.split("\n").map((line) => {
        const marker = line.match(/^\s*(#{1,6}\s|[-*>]\s|\d+\.\s)?/)?.[1]?.trim() ?? "";
        return `${marker}|${line.slice(line.indexOf(marker) + marker.length).trim() ? "text" : ""}`;
      });
    for (const locale of LOCALES) {
      for (const g of french) {
        expect(shape(guide(g.slug, locale)!.content), `${locale}/${g.slug}`).toEqual(shape(g.content));
      }
    }
  });

  it("keeps the same links and blocks in every translation", () => {
    for (const locale of LOCALES) {
      for (const g of french) {
        const translated = guide(g.slug, locale)!;
        expect(internalLinks(translated.content), `${locale}/${g.slug}`).toEqual(internalLinks(g.content));
        expect(blocksOf(translated.content), `${locale}/${g.slug}`).toEqual(blocksOf(g.content));
        // Front matter fields that are not text are copied as is.
        expect([translated.kind, translated.lane, translated.order, translated.updated]).toEqual([
          g.kind,
          g.lane,
          g.order,
          g.updated,
        ]);
        expect(translated.related).toEqual(g.related);
        expect(translated.tools).toEqual(g.tools);
      }
    }
  });

  it("has a translated file for every guide in every language", () => {
    for (const locale of LOCALES.filter((l) => l !== "fr")) {
      for (const g of french) {
        // A missing file would silently fall back to another language.
        expect(existsSync(join(process.cwd(), "content", locale, "guides", `${g.slug}.md`)), `${locale}/${g.slug}`).toBe(true);
        expect(guide(g.slug, locale)!.title, `${locale}/${g.slug}`).not.toBe(g.title);
      }
    }
  });
});

describe("guide rendering", () => {
  it("anchors headings like the table of contents, uniquely", () => {
    for (const g of french) {
      const headings = guideHeadings(g.content);
      expect(headings.length, g.slug).toBeGreaterThanOrEqual(4);
      expect(new Set(headings.map((h) => h.anchor)).size).toBe(headings.length);
      const html = renderGuide(g.content)
        .flatMap((p) => (p.type === "html" ? [p.html] : []))
        .join("");
      for (const h of headings) expect(html, `${g.slug}#${h.anchor}`).toContain(`id="${h.anchor}"`);
    }
  });

  it("builds anchors without accents or punctuation", () => {
    expect(anchorOf("Les erreurs les plus courantes")).toBe("les-erreurs-les-plus-courantes");
    expect(anchorOf("Héros recommandés en ce moment")).toBe("heros-recommandes-en-ce-moment");
    expect(anchorOf("Le Seigneur : l'objectif qui termine les parties")).toBe("le-seigneur-l-objectif-qui-termine-les-parties");
  });

  it("numbers repeated headings", () => {
    expect(guideHeadings("## Début\n\ntext\n\n## Début").map((h) => h.anchor)).toEqual(["debut", "debut-2"]);
  });

  it("cuts the text at the live block markers", () => {
    const parts = renderGuide("## A\n\nOne.\n\n<!-- guide:heroes -->\n\n## B\n\n<!-- guide:unknown -->\n");
    expect(parts.map((p) => p.type)).toEqual(["html", "block", "html"]);
    expect(parts[1]).toEqual({ type: "block", block: "heroes" });
  });

  it("localizes internal links and keeps them in the same tab", () => {
    const html = cleanGuideHtml('<p><a href="/heroes/ling">Ling</a> <a href="https://example.com">x</a> <a href="#a">y</a></p>', "it");
    expect(html).toContain('<a href="/it/heroes/ling">Ling</a>');
    expect(html).toContain('<a href="https://example.com" rel="noreferrer nofollow" target="_blank">x</a>');
    expect(html).toContain('<a href="#a">y</a>');
    expect(cleanGuideHtml('<a href="javascript:alert(1)">x</a><script>x</script>', "en")).not.toMatch(/javascript|script/);
  });

  it("estimates the reading time from the words", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(Array.from({ length: 1000 }, () => "mot").join(" "))).toBe(5);
    // Link addresses and block markers are not read.
    expect(readingMinutes("[Ling](/heroes/ling) <!-- guide:heroes -->")).toBe(1);
    for (const g of french) expect(readingMinutes(g.content), g.slug).toBeGreaterThanOrEqual(3);
  });
});

describe("lane kit", () => {
  const build = (items: string[], spell: string, emblem: string, pickRate: number): BuildPlayed => ({
    items,
    spell,
    emblem,
    talents: ["Thrill"],
    winRate: 50,
    pickRate,
  });
  const builds: Record<string, BuildsHero> = {
    popular: { Gold: { all: [build(["Windtalker", "Windtalker"], "Flicker", "Marksman", 60), build(["Golden Staff"], "Inspire", "Marksman", 40)] } },
    rare: { Gold: { all: [build(["Malefic Gun"], "Purify", "Assassin", 100)] }, Mid: { all: [build(["Glowing Wand"], "Flicker", "Mage", 100)] } },
    unmeasured: { Gold: { all: [build(["Blade of Despair"], "Flicker", "Marksman", 100)] } },
  };
  const weights = { popular: 3, rare: 1 };

  it("weighs each hero's builds by its popularity, and counts an item once per build", () => {
    const kit = laneKit(builds, weights, "Gold");
    // Mass: popular 3 × 100, rare 1 × 100 = 400.
    expect(kit.items.map((c) => [c.name, c.share])).toEqual([
      ["Windtalker", 45],
      ["Golden Staff", 30],
      ["Malefic Gun", 25],
    ]);
    expect(kit.spells.map((c) => c.name)).toEqual(["Flicker", "Inspire", "Purify"]);
    expect(kit.emblems.map((c) => [c.name, c.share])).toEqual([
      ["Marksman", 75],
      ["Assassin", 25],
    ]);
    expect(kit.talents).toEqual([{ name: "Thrill", share: 100 }]);
  });

  it("ignores other lanes and heroes without a weight", () => {
    const kit = laneKit(builds, weights, "Gold");
    expect(kit.items.some((c) => c.name === "Glowing Wand" || c.name === "Blade of Despair")).toBe(false);
    expect(laneKit(builds, {}, "Gold").items).toEqual([]);
  });

  it("shows only the common choices", () => {
    const shown = shownKit(laneKit(builds, weights, "Gold"));
    for (const part of Object.values(shown)) for (const c of part) expect(c.share).toBeGreaterThanOrEqual(KIT_MIN_SHARE);
    expect(shown.items.length).toBeLessThanOrEqual(6);
  });
});
