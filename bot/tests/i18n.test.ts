import { describe, expect, it } from "vitest";
import { COMMANDS } from "../src/commands/index.js";
import { HELP_ORDER } from "../src/commands/help.js";
import { DISCORD_LOCALES, LOCALES, MESSAGES, leafKeys, resolveLocale, t } from "../src/i18n/index.js";

/**
 * Localization completeness: a command, an option or a reply missing in one
 * language would show English to that language's players (or a raw key).
 */

const enKeys = leafKeys(MESSAGES.en).sort();
const discordLocales = LOCALES.flatMap((l) => DISCORD_LOCALES[l]);
// Discord's rule for command and option names (lower case where the script has case).
const NAME = /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;

describe("translations", () => {
  for (const locale of LOCALES) {
    it(`${locale} has exactly the English keys`, () => {
      const keys = leafKeys(MESSAGES[locale]).sort();
      expect(keys.filter((k) => !enKeys.includes(k)), "keys unknown to English").toEqual([]);
      expect(enKeys.filter((k) => !keys.includes(k)), "keys missing").toEqual([]);
    });

    it(`${locale} has no empty text and keeps every placeholder`, () => {
      for (const key of enKeys) {
        const text = t(locale, key);
        expect(text.trim(), key).not.toBe("");
        const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(placeholders(text), key).toEqual(placeholders(t("en", key)));
      }
    });
  }

  it("valid command and option names in every language", () => {
    for (const locale of LOCALES) {
      const commands = MESSAGES[locale].commands as Record<string, { name: string; options?: Record<string, { name: string }> }>;
      for (const [key, c] of Object.entries(commands)) {
        expect(c.name, `${locale} ${key}`).toMatch(NAME);
        expect(c.name, `${locale} ${key}`).toBe(c.name.toLowerCase());
        for (const o of Object.values(c.options ?? {})) {
          expect(o.name).toMatch(NAME);
          expect(o.name).toBe(o.name.toLowerCase());
        }
      }
    }
  });
});

describe("commands", () => {
  const built = COMMANDS.map((c) => c.data());

  it("every command has an i18n entry and a /help line", () => {
    const keys = Object.keys(MESSAGES.en.commands as object);
    for (const c of COMMANDS) expect(keys).toContain(c.key);
    for (const key of keys) expect(COMMANDS.map((c) => c.key)).toContain(key);
    for (const c of COMMANDS) if (c.key !== "help") expect(HELP_ORDER).toContain(c.key);
  });

  it("every name, description, option and choice is localized for every Discord locale", () => {
    for (const cmd of built) {
      for (const field of ["name_localizations", "description_localizations"] as const) {
        expect(Object.keys(cmd[field] ?? {}).sort(), `${cmd.name} ${field}`).toEqual([...discordLocales].sort());
      }
      for (const option of cmd.options ?? []) {
        expect(Object.keys(option.name_localizations ?? {}).sort(), `${cmd.name}.${option.name}`).toEqual([...discordLocales].sort());
        expect(Object.keys(option.description_localizations ?? {}).sort()).toEqual([...discordLocales].sort());
        for (const choice of ("choices" in option ? option.choices : undefined) ?? []) {
          expect(Object.keys(choice.name_localizations ?? {}).sort(), `${cmd.name}.${option.name}=${choice.value}`).toEqual(
            [...discordLocales].sort(),
          );
        }
      }
    }
  });

  it("names are unique and within Discord's per-command size", () => {
    expect(new Set(built.map((c) => c.name)).size).toBe(built.length);
    for (const cmd of built) {
      let total = 0;
      const walk = (x: unknown): void => {
        if (Array.isArray(x)) return x.forEach(walk);
        if (x && typeof x === "object") {
          for (const [k, v] of Object.entries(x)) {
            if (["name", "description", "value"].includes(k) && typeof v === "string") total += v.length;
            else if (k.endsWith("_localizations") && v) total += Object.values(v as Record<string, string>).join("").length;
            else walk(v);
          }
        }
      };
      walk(cmd);
      expect(total, cmd.name).toBeLessThan(8000);
      expect(cmd.description.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("reply language", () => {
  it("prefers the server setting, then the member's language, then English", () => {
    expect(resolveLocale("fr", "es-ES")).toBe("fr");
    expect(resolveLocale(null, "es-419")).toBe("es");
    expect(resolveLocale(undefined, "id")).toBe("id");
    expect(resolveLocale(null, "en-GB")).toBe("en");
    expect(resolveLocale(null, "ja")).toBe("en");
    expect(resolveLocale("de", "it")).toBe("it");
  });

  it("fills placeholders and falls back to English, then to the key", () => {
    expect(t("fr", "ui.build.title", { hero: "Layla" })).toBe("Layla : builds");
    expect(t("fr", "does.not.exist")).toBe("does.not.exist");
  });
});
