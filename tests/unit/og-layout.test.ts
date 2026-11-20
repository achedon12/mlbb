import { describe, expect, it } from "vitest";
import { metaPage } from "@/i18n/seo";
import {
  balance,
  charWidth,
  fitTitle,
  nameInText,
  ogPath,
  ogPose,
  shorten,
  textWidth,
  wrap,
  TITLE_LINE_HEIGHT,
} from "@/lib/og/layout";

describe("share image layout", () => {
  it("measures capitals in the display face, wider for Cyrillic, marks of Thai for nothing", () => {
    expect(charWidth("M")).toBeGreaterThan(charWidth("I"));
    expect(charWidth("É")).toBe(charWidth("E"));
    expect(charWidth("Ж")).toBeGreaterThan(charWidth("A"));
    expect(charWidth("ิ")).toBe(0);
    expect(textWidth("AA")).toBeCloseTo(2 * charWidth("A"));
  });

  it("wraps word by word, and cuts only a word wider than the line", () => {
    expect(wrap("TIER LIST MYTHIC", 100)).toEqual(["TIER LIST MYTHIC"]);
    expect(wrap("TIER LIST MYTHIC", textWidth("TIER LIST"))).toEqual(["TIER LIST", "MYTHIC"]);
    const cut = wrap("ABCDEFGHIJ", textWidth("ABCDE"));
    expect(cut.length).toBe(2);
    expect(cut.join("")).toBe("ABCDEFGHIJ");
  });

  it("balances lines: the last word does not stand alone", () => {
    const text = "BASE DE CONNAISSANCES MOBILE LEGENDS: BANG BANG";
    const width = textWidth("BASE DE CONNAISSANCES MOBILE LEGENDS: BANG");
    expect(wrap(text, width).at(-1)).toBe("BANG");
    const lines = balance(text, width);
    expect(lines.length).toBe(wrap(text, width).length);
    expect(lines.at(-1)).not.toBe("BANG");
    expect(lines.join(" ")).toBe(text);
  });

  it("shortens at a word boundary with an ellipsis", () => {
    expect(shorten("Short", 20)).toBe("Short");
    const short = shorten("Patch 2.2.23: who rises, who falls, and why it matters", 30);
    expect([...short].length).toBeLessThanOrEqual(30);
    expect(short.endsWith("…")).toBe(true);
    expect(short).not.toMatch(/\s…$/);
  });

  it("gives a short title the largest size, in capitals", () => {
    const fitted = fitTitle("Draft", { width: 660, max: 128 });
    expect(fitted).toEqual({ lines: ["DRAFT"], size: 128 });
  });

  it("shrinks a long title rather than cutting one of its words", () => {
    const fitted = fitTitle("Statistiques des héros", { width: 660, lines: 2, max: 124 });
    expect(fitted.lines.length).toBeLessThanOrEqual(2);
    expect(fitted.lines.join(" ")).toBe("STATISTIQUES DES HÉROS");
    for (const line of fitted.lines) expect(textWidth(line) * fitted.size).toBeLessThanOrEqual(660);
  });

  it("keeps the title within the height it is given", () => {
    const fitted = fitTitle("Monter en classé : mentalité, pool de héros et choix du rôle", { width: 660, height: 200, lines: 3 });
    expect(fitted.lines.length * fitted.size * TITLE_LINE_HEIGHT).toBeLessThanOrEqual(200);
  });

  it("shortens a title too long even at the smallest size", () => {
    const long = "Une analyse très détaillée ".repeat(12);
    const fitted = fitTitle(long, { width: 600, lines: 2, min: 56 });
    expect(fitted.size).toBe(56);
    expect(fitted.lines.length).toBeLessThanOrEqual(2);
    expect(fitted.lines.at(-1)?.endsWith("…")).toBe(true);
  });

  it("finds a hero named in a title, as a whole word, the longest name first", () => {
    const names = ["Yi", "Yi Sun-shin", "Nana", "Gloo"];
    expect(nameInText("Patch: Yi Sun-shin returns", names)).toBe("Yi Sun-shin");
    expect(nameInText("Banana split", names)).toBeNull();
    expect(nameInText("Why Gloo still wins", names)).toBe("Gloo");
  });

  it("gives Dex the pose of the page", () => {
    expect(ogPose("home")).toBe("salut");
    expect(ogPose("guide")).toBe("carte");
    expect(ogPose("tool")).toBe("idee");
    expect(ogPose("statistics")).toBe("reflexion");
  });

  it("puts the card next to the page", () => {
    expect(ogPath("fr", "/tier-list")).toBe("/fr/tier-list/opengraph-image");
    expect(ogPath("en", "/")).toBe("/en/opengraph-image");
  });
});

describe("metaPage share images", () => {
  it("points a page with a card to it, with its translated title as alt", () => {
    const meta = metaPage("fr", { title: "Tier list", description: "…", path: "/tier-list", card: true });
    expect(meta.openGraph?.images).toEqual([
      { url: "/fr/tier-list/opengraph-image", alt: "Tier list — MLBBDex", width: 1200, height: 630 },
    ]);
    expect(meta.twitter?.images).toEqual([{ url: "/fr/tier-list/opengraph-image", alt: "Tier list — MLBBDex" }]);
  });

  it("falls back on the home card of the page's language", () => {
    const meta = metaPage("es", { title: "Legal", description: "…", path: "/legal" });
    const [image] = meta.openGraph?.images as { url: string; alt: string }[];
    expect(image.url).toBe("/es/opengraph-image");
    expect(image.alt).toMatch(/^MLBBDex — /);
  });

  it("keeps an image a page gives", () => {
    const meta = metaPage("en", { title: "Bot", description: "…", path: "/bot", image: "/bot/banner.png", card: true });
    expect(meta.openGraph?.images).toEqual([{ url: "/bot/banner.png", alt: "Bot — MLBBDex" }]);
  });
});
