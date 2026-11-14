import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_HREFLANG,
  LOCALE_HTML,
  LOCALE_INTL,
  LOCALE_NAME,
  languageName,
  localeFromHeader,
} from "@/i18n/config";
import { metaLocales, OG_LOCALE } from "@/i18n/seo";

/**
 * The language tables around `LOCALES`: what a browser, a search engine and
 * `Intl` are told about each language.
 */
describe("site languages", () => {
  it("are URL segments: lowercase, no region", () => {
    for (const l of LOCALES) expect(l).toMatch(/^[a-z]{2,3}$/);
  });

  it("each have a native name, a lang code and an Open Graph locale of their own", () => {
    for (const table of [LOCALE_NAME, LOCALE_HTML, OG_LOCALE]) {
      expect(new Set(LOCALES.map((l) => table[l])).size).toBe(LOCALES.length);
    }
    expect(LOCALE_NAME).toMatchObject({ fil: "Filipino", th: "ไทย", pt: "Português (Brasil)", ru: "Русский" });
    expect(LOCALE_HTML).toMatchObject({ fil: "fil-PH", th: "th-TH", pt: "pt-BR", ru: "ru-RU" });
    expect(OG_LOCALE).toMatchObject({ fil: "fil_PH", th: "th_TH", pt: "pt_BR", ru: "ru_RU" });
    // The lang code and the URL segment name the same language.
    for (const l of LOCALES) expect(LOCALE_HTML[l].split("-")[0]).toBe(l);
  });

  it("name themselves inside a sentence", () => {
    expect(languageName("ru")).toBe("русский");
    expect(languageName("pt")).toBe("português");
  });
});

describe("hreflang", () => {
  it("lists every language once, Portuguese with its region, plus x-default", () => {
    const { canonical, languages } = metaLocales("th", "/heroes/khufra");
    expect(canonical).toBe("/th/heroes/khufra");
    expect(Object.keys(languages).sort()).toEqual([...LOCALES.map((l) => LOCALE_HREFLANG[l]), "x-default"].sort());
    expect(languages["pt-BR"]).toBe("/pt/heroes/khufra");
    expect(languages.pt).toBeUndefined();
    expect(languages.fil).toBe("/fil/heroes/khufra");
    expect(languages["x-default"]).toBe(`/${DEFAULT_LOCALE}/heroes/khufra`);
  });

  it("keeps the other languages region-free", () => {
    for (const l of LOCALES.filter((x) => x !== "pt")) expect(LOCALE_HREFLANG[l]).toBe(l);
  });
});

describe("Accept-Language", () => {
  it("picks the first language the site speaks, by primary subtag", () => {
    expect(localeFromHeader("ru-RU,ru;q=0.9,en-US;q=0.8")).toBe("ru");
    expect(localeFromHeader("th-TH,th;q=0.9")).toBe("th");
    expect(localeFromHeader("de-DE,pt-BR;q=0.8")).toBe("pt");
    // European Portuguese reads the Brazilian site rather than the English one.
    expect(localeFromHeader("pt-PT")).toBe("pt");
    expect(localeFromHeader("fil-PH,fil;q=0.9")).toBe("fil");
  });

  it("does not take Filipino for Finnish, and reads Tagalog as Filipino", () => {
    expect(localeFromHeader("fi-FI")).toBeNull();
    expect(localeFromHeader("tl-PH,en;q=0.5")).toBe("fil");
  });

  it("has no answer without a language it knows", () => {
    expect(localeFromHeader(null)).toBeNull();
    expect(localeFromHeader("")).toBeNull();
    expect(localeFromHeader("de,ja")).toBeNull();
  });
});

describe("dates", () => {
  const day = new Date("2026-11-14T00:00:00Z");
  const year = (l: (typeof LOCALES)[number]) =>
    new Intl.DateTimeFormat(LOCALE_INTL[l], { year: "numeric", timeZone: "UTC" })
      .formatToParts(day)
      .find((p) => p.type === "year")?.value;

  it("count years the same way in every language: Thai too, whose default is the Buddhist era", () => {
    expect(new Intl.DateTimeFormat(LOCALE_HTML.th, { year: "numeric", timeZone: "UTC" }).format(day)).toContain("2569");
    for (const l of LOCALES) expect(year(l), l).toBe("2026");
  });

  it("keep the lang code for everything else", () => {
    for (const l of LOCALES.filter((x) => x !== "th")) expect(LOCALE_INTL[l]).toBe(LOCALE_HTML[l]);
    expect(new Intl.DateTimeFormat(LOCALE_INTL.th, { month: "long", timeZone: "UTC" }).format(day)).toBe("พฤศจิกายน");
  });
});
