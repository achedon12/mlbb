import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LOCALES, argsWithoutLocale, readLocales, targetLocales } from "../../scripts/locales.mjs";
import { applyGlossary, nameRules, restoreNames } from "../../scripts/translation-glossary.mjs";
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

describe("game vocabulary of the other languages", () => {
  it("keeps the English game words Filipino players write", () => {
    expect(applyGlossary("Mga balat ng bayani at rate ng panalo", "fil", "messages")).toBe("Mga skin ng hero at win rate");
    expect(applyGlossary("Pagong, Panginoon at mga buff", "fil")).toBe("Turtle, Lord at mga buff");
  });

  it("matches Thai terms without word boundaries, and spaces the Latin ones off", () => {
    expect(applyGlossary("เครื่องคำนวณอัตราการชนะ", "th", "messages")).toBe("เครื่องคำนวณ Win Rate");
    expect(applyGlossary("รายการระดับของฮีโร่", "th")).toBe("Tier List ของฮีโร่");
    expect(applyGlossary("ตำนานมือถือ: Bang Bang", "th")).toBe("Mobile Legends: Bang Bang");
  });

  it("uses the Brazilian players' jargon", () => {
    expect(applyGlossary("Lista de níveis e construções", "pt", "messages")).toBe("Tier list e builds");
    expect(applyGlossary("Lendas Móveis: Bang Bang", "pt")).toBe("Mobile Legends: Bang Bang");
    // An ordinary word keeps its sense outside the interface.
    expect(applyGlossary("a construção da torre", "pt", "data")).toBe("a construção da torre");
  });

  it("replaces each Russian case form with the matching one", () => {
    expect(applyGlossary("Счетчики героя и список уровней", "ru")).toBe("Контрпики героя и тир-лист");
    expect(applyGlossary("лучший из счетчиков, в тир-листе", "ru")).toBe("лучший из контрпиков, в тир-листе");
    expect(applyGlossary("лагеря в джунглях", "ru")).toBe("лагеря в лесу");
  });
});

describe("hero names", () => {
  const ru = nameRules(
    new Map([
      ["Khufra", "Хуфра"],
      ["Lancelot", "Ланселот"],
      ["Sun", "Солнце"],
      ["Yu Zhong", "Ю Чжун"],
      ["Layla", "Layla"],
    ]),
    "ru",
  );

  it("come back in the game's spelling, whatever their Russian case", () => {
    expect(restoreNames("Хуфра бьёт Ланселота, против Хуфры", "Khufra hits Lancelot", ru)).toBe("Khufra бьёт Lancelot, против Khufra");
    expect(restoreNames("Ю Чжун", "Yu Zhong", ru)).toBe("Yu Zhong");
  });

  it("only where the source names the hero, and never a dictionary word", () => {
    expect(restoreNames("Ланселот", "A knight", ru)).toBe("Ланселот");
    expect(restoreNames("Солнце встаёт", "Sun rises", ru)).toBe("Солнце встаёт");
  });

  it("in Thai, without eating the next word's vowel", () => {
    const th = nameRules(
      new Map([
        ["Vale", "เวล"],
        ["Khufra", "คูฟรา"],
      ]),
      "th",
    );
    expect(restoreNames("คูฟราใช้สกิล เวลา 5 วินาที", "Khufra, Vale", th)).toBe("Khufra ใช้สกิล เวลา 5 วินาที");
  });
});
