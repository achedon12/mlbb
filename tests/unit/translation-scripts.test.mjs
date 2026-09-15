import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LOCALES, argsWithoutLocale, readLocales, targetLocales } from "../../scripts/locales.mjs";
import { applyGlossary } from "../../scripts/translation-glossary.mjs";
import { fromWire, toWire } from "../../scripts/translation-google.mjs";
import { LOCALES as SMOKE_LOCALES } from "../../scripts/smoke-check-rules.mjs";

const PRIVATE = String.fromCharCode(0xe000);

describe("script locales", () => {
  it("reads the site languages from src/i18n/config.ts", () => {
    const config = readFileSync("src/i18n/config.ts", "utf8");
    const declared = config.match(/export const LOCALES\s*=\s*\[([^\]]*)\]/)[1].match(/[a-z]{2,3}/g);
    expect(LOCALES).toEqual(declared);
    expect(readLocales('export const LOCALES = ["en", "id"] as const;')).toEqual(["en", "id"]);
    expect(() => readLocales("const nothing = 1;")).toThrow();
  });

  it("keeps the smoke check on every site language", () => {
    expect([...SMOKE_LOCALES].sort()).toEqual([...LOCALES].sort());
  });

  it("targets every language but the source, or the ones named with --locale", () => {
    expect(targetLocales("fr", [])).toEqual(LOCALES.filter((l) => l !== "fr"));
    expect(targetLocales("fr", ["--locale", "id"])).toEqual(["id"]);
    expect(targetLocales("en", ["--locale=fr,id", "--locale", "en"])).toEqual(["fr", "id"]);
    expect(() => targetLocales("fr", ["--locale", "ID!"])).toThrow();
    expect(argsWithoutLocale(["patches", "--locale", "id", "combos", "--locale=it"])).toEqual(["patches", "combos"]);
  });
});

describe("translation markers", () => {
  it("travel as brackets and come back in the private use form", () => {
    const text = `Counter ${PRIVATE}0${PRIVATE} di ${PRIVATE}12${PRIVATE}`;
    expect(toWire(text)).toBe("Counter ⟦0⟧ di ⟦12⟧");
    expect(fromWire("Counter ⟦0⟧ di ⟦ 12 ⟧")).toBe(text);
  });
});

describe("Indonesian game vocabulary", () => {
  it("puts back the English terms players use", () => {
    expect(applyGlossary("Tingkat kemenangan dan kulit pahlawan", "id")).toBe("Win rate dan skin hero");
    expect(applyGlossary("Kalkulator Tingkat Kemenangan", "id")).toBe("Kalkulator Win Rate");
    expect(applyGlossary("Penembak Jalur Emas.", "id")).toBe("Marksman Gold Lane.");
    expect(applyGlossary("Semua penghitung {name}", "id")).toBe("Semua counter {name}");
    expect(applyGlossary("pahlawannya", "id")).toBe("heronya");
  });

  it("only touches whole words, and ambiguous ones only in the interface", () => {
    expect(applyGlossary("Tuan rumah", "id")).toBe("Tuan rumah");
    expect(applyGlossary("bangunan musuh", "id", "data")).toBe("bangunan musuh");
    expect(applyGlossary("Sebuah bangunan", "id", "messages")).toBe("Sebuah build");
    expect(applyGlossary("PV dan resistensi", "id")).toBe("HP dan resistensi");
    expect(applyGlossary("pv", "id")).toBe("pv");
  });

  it("leaves languages without a glossary unchanged", () => {
    expect(applyGlossary("Pahlawan", "fr")).toBe("Pahlawan");
    expect(applyGlossary(null, "id")).toBe(null);
  });
});
