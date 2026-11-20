import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LOCALES, argsWithoutLocale, readLocales, targetLocales } from "../../scripts/locales.mjs";
import { applyGlossary, nameRules, restoreNames } from "../../scripts/translation-glossary.mjs";
import { fromWire, toWire } from "../../scripts/translation-google.mjs";
import { forgetLost, namesPattern, shieldWith } from "../../scripts/translation-shield.mjs";
import { LOCALES as SMOKE_LOCALES } from "../../scripts/smoke-check-rules.mjs";
import { isHandWritten } from "../../scripts/handwritten.mjs";

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

describe("French game vocabulary", () => {
  it("uses the site's words for lanes, roles, stats and effects", () => {
    expect(applyGlossary("Les tireurs d'élite de la voie d'or", "fr")).toBe("Les tireurs de la Gold lane");
    expect(applyGlossary("Gagne une immunité lente et 200 HP.", "fr")).toBe("Gagne une immunité aux ralentissements et 200 PV.");
    expect(applyGlossary("Inflige des dégâts aux serviteurs et aux fluages.", "fr")).toBe("Inflige des dégâts aux sbires et aux creeps.");
    expect(applyGlossary("Le Réservoir protège la voie du milieu.", "fr")).toBe("Le Tank protège la Mid lane.");
  });

  it("leaves words that only look like an abbreviation alone", () => {
    expect(applyGlossary("Les héros hp et Phoveus", "fr")).toBe("Les héros hp et Phoveus");
  });

  it("never translates the game's name", () => {
    expect(applyGlossary("-Légendes mobiles : Bang Bang", "fr")).toBe("-Mobile Legends: Bang Bang");
    expect(applyGlossary("Une mise à jour de Mobile Legends : Bang Bang", "fr")).toBe("Une mise à jour de Mobile Legends: Bang Bang");
    expect(applyGlossary("Le wiki Légendes mobiles", "fr")).toBe("Le wiki Mobile Legends");
  });

  it("calls a skin an apparence, with feminine articles and adjectives", () => {
    expect(applyGlossary("E. Nouvelle peau", "fr")).toBe("E. Nouvelle apparence");
    expect(applyGlossary("Boutique de fragments de peau premium", "fr")).toBe("Boutique de fragments d'apparence premium");
    expect(applyGlossary("Le tout nouveau skin StarLight", "fr")).toBe("La toute nouvelle apparence StarLight");
    expect(applyGlossary("le skin saisonnier S40 et un skin spécial", "fr")).toBe("l'apparence saisonnière S40 et une apparence spéciale");
    expect(applyGlossary("E. Nouveaux skins", "fr")).toBe("E. Nouvelles apparences");
    expect(applyGlossary("Tous les skins de ce héros", "fr")).toBe("Toutes les apparences de ce héros");
    expect(applyGlossary("Nom du skin", "fr")).toBe("Nom de l'apparence");
    expect(applyGlossary("un détail de skin", "fr")).toBe("un détail d'apparence");
    // The client's names for painted and shining skins.
    expect(applyGlossary("et le skin peint Yu Zhong", "fr")).toBe("et l'apparence colorée Yu Zhong");
    expect(applyGlossary("les skins resplendissants", "fr")).toBe("les apparences éclatantes");
    // An adjective past a series name agrees too, not one that follows another noun.
    expect(applyGlossary("obtenir un skin Epic gratuit", "fr")).toBe("obtenir une apparence Epic gratuite");
    expect(applyGlossary("les skins StarLight obtenus", "fr")).toBe("les apparences StarLight obtenues");
    expect(applyGlossary("les skins des héros sortis", "fr")).toBe("les apparences des héros sortis");
  });

  it("leaves skins alone in links, anchors, variables and English event names", () => {
    expect(applyGlossary('<h3 id="new-skins"><a href="/fr/skins">', "fr")).toBe('<h3 id="new-skins"><a href="/fr/skins">');
    expect(applyGlossary("{skins} héros", "fr")).toBe("{skins} héros");
    expect(applyGlossary("L'événement Anniversary Skin Giveaway et l'étiquette MLabel Skin", "fr")).toBe(
      "L'événement Anniversary Skin Giveaway et l'étiquette MLabel Skin",
    );
    expect(applyGlossary("chapeau", "fr")).toBe("chapeau");
  });

  it("writes damage out, taken and dealt", () => {
    expect(applyGlossary("DMG Prise -8% → -6%", "fr")).toBe("Dégâts subis -8% → -6%");
    expect(applyGlossary("(Nouveau) DÉG pris : -6 %", "fr")).toBe("(Nouveau) Dégâts subis : -6 %");
    expect(applyGlossary("(Nouveau) DMG infligés +4 %", "fr")).toBe("(Nouveau) Dégâts infligés +4 %");
    expect(applyGlossary("DÉG +10 %, DMG -2%", "fr")).toBe("Dégâts +10 %, Dégâts -2%");
  });

  it("uses the site's words for lanes, roles, modes and spells", () => {
    expect(applyGlossary("Voie : Gold lane/Voie médiane", "fr")).toBe("Lane : Gold lane/Mid lane");
    expect(applyGlossary("A. Ajustement des voies", "fr")).toBe("A. Ajustement des lanes");
    expect(applyGlossary("les chars itinérants la voie de l’EXP", "fr")).toBe("les tanks roamers l'EXP lane");
    expect(applyGlossary("La voie d’expérience", "fr")).toBe("L'EXP lane");
    expect(applyGlossary("Tueur de chars, semi-chars", "fr")).toBe("Tueur de tanks, semi-tanks");
    expect(applyGlossary("[Bénédictions itinérantes] du héros itinérant", "fr")).toBe("[Roaming Blessings] du roamer");
    expect(applyGlossary("A. Bagarre", "fr")).toBe("A. Brawl");
    expect(applyGlossary("[Rétribution] BUFF", "fr")).toBe("[Retribution] BUFF");
    // A path in a mode, or "en voie de", is no lane; a brawl in lowercase is no mode.
    expect(applyGlossary("Si le joueur a choisi la voie physique", "fr")).toBe("Si le joueur a choisi la voie physique");
    expect(applyGlossary("en voie de guérison, une bagarre", "fr")).toBe("en voie de guérison, une bagarre");
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
    expect(applyGlossary("Pahlawan", "it")).toBe("Pahlawan");
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

  it("keeps the game's name in every language", () => {
    expect(applyGlossary("Legenda Seluler: Bang Bang", "id")).toBe("Mobile Legends: Bang Bang");
    expect(applyGlossary("Wiki Legenda Seluler", "id", "messages")).toBe("Wiki Mobile Legends");
    expect(applyGlossary("―Leyendas móviles: Bang Bang", "es")).toBe("―Mobile Legends: Bang Bang");
    expect(applyGlossary("Leggende mobili: Bang Bang", "it")).toBe("Mobile Legends: Bang Bang");
    expect(applyGlossary("Mobile Legends: ปังปัง", "th")).toBe("Mobile Legends: Bang Bang");
    expect(applyGlossary("Мобильные легенды: Bang Bang", "ru")).toBe("Mobile Legends: Bang Bang");
  });

  it("says skin where the players do", () => {
    expect(applyGlossary("E. Nuova pelle, Pelli per categoria", "it")).toBe("E. Nuova skin, Skin per categoria");
    expect(applyGlossary("a. Pieles raras y el aspecto de temporada", "es")).toBe("a. Skins raras y el skin de temporada");
    // "Aspectos destacados" are the highlights; "в человеческом облике", a human form.
    expect(applyGlossary("Aspectos destacados del parche", "es")).toBe("Aspectos destacados del parche");
    expect(applyGlossary("сезонный облик S40, в человеческом облике", "ru")).toBe("сезонный скин S40, в человеческом облике");
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

describe("protected names", () => {
  const pattern = namesPattern(["Chip", "Joy", "Book of Sages", "Flicker", "Retribution", "Ice Retribution"]);
  const shield = shieldWith(pattern);
  const M = (n) => `${PRIVATE}${n}${PRIVATE}`;

  it("hide the game's name, hero, item and spell names, longest first", () => {
    const s = shield("Mobile Legends: Bang Bang: Chip buys Book of Sages, casts Ice Retribution. MLBB.");
    expect(s.text).toBe(`${M(0)}: ${M(1)} buys ${M(2)}, casts ${M(3)}. ${M(4)}.`);
    expect(s.restore(`${M(0)} : ${M(1)} achète ${M(2)}, lance ${M(3)}. ${M(4)}.`)).toBe(
      "Mobile Legends: Bang Bang : Chip achète Book of Sages, lance Ice Retribution. MLBB.",
    );
  });

  it("only whole words, and Bang Bang only within the game's name", () => {
    expect(shield("Chipped, enjoy a bang bang").text).toBe("Chipped, enjoy a bang bang");
    expect(shield("Mobile Legends Bang Bang").text).toBe(M(0));
  });

  it("give the text up when a name did not come back", () => {
    const s = shield("Joy and Chip");
    expect(s.restore(`Joie et ${M(1)}`)).toBe(null);
  });

  it("number after the markers a text already carries, and leave those alone", () => {
    // An HTML block reaches the service with its tags behind markers 0 to 3.
    const s = shield(`${M(0)}Chip${M(1)} ${M(2)}▼ Nerf${M(3)}`);
    expect(s.text).toBe(`${M(0)}${M(4)}${M(1)} ${M(2)}▼ Nerf${M(3)}`);
    expect(s.restore(`${M(0)}${M(4)}${M(1)} ${M(2)}▼ Nerf${M(3)}`)).toBe(`${M(0)}Chip${M(1)} ${M(2)}▼ Nerf${M(3)}`);
  });

  it("send back to the service a cached translation that lost one", () => {
    const cache = {
      "en|fr|New skin for Joy": "Nouvelle peau pour Joie",
      "en|fr|Buy Book of Sages": "Achetez Book of Sages",
      "en|fr|Mobile Legends: Bang Bang": "Légendes mobiles : Bang Bang",
    };
    const dropped = forgetLost(cache, ["New skin for Joy", "Buy Book of Sages", "Mobile Legends: Bang Bang"], "en", "fr", pattern);
    expect(dropped).toEqual(["en|fr|New skin for Joy", "en|fr|Mobile Legends: Bang Bang"]);
    expect(Object.keys(cache)).toEqual(["en|fr|Buy Book of Sages"]);
  });

  it("can be the game's name alone", () => {
    expect(shieldWith(namesPattern([]))("Chip plays MLBB").text).toBe(`Chip plays ${M(0)}`);
  });
});

describe("hand-written article translations", () => {
  it("are recognised by the handwritten flag in the front matter", () => {
    expect(isHandWritten('---\ntitle: "Patch"\nhandwritten: true\n---\nBody.\n')).toBe(true);
    expect(isHandWritten('---\r\nhandwritten: "true"\r\n---\r\nBody.\r\n')).toBe(true);
    expect(isHandWritten('---\ntitle: "Patch"\n---\nBody.\n')).toBe(false);
    expect(isHandWritten('---\nhandwritten: false\n---\nBody.\n')).toBe(false);
    // Only the front matter counts, not a line of the body.
    expect(isHandWritten('---\ntitle: "Patch"\n---\nhandwritten: true\n')).toBe(false);
  });

  it("include the English patch 2.2.23 analysis", () => {
    expect(isHandWritten(readFileSync("content/en/news/2026-11-19-analyse-patch-2-2-23.md", "utf8"))).toBe(true);
  });
});
