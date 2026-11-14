import type { LocaleString } from "discord.js";
import en from "./en.json" with { type: "json" };
import es from "./es.json" with { type: "json" };
import fr from "./fr.json" with { type: "json" };
import id from "./id.json" with { type: "json" };
import it from "./it.json" with { type: "json" };
import { LOCALES, type Locale } from "./locales.js";

/**
 * Bot translations, one JSON file per site language.
 *
 * The site's languages (en, fr, it, es, id) are the reference: a server's
 * setting stores one of them, and links to mlbbdex.com use them as prefix.
 * Discord names some of them differently (es-ES, es-419, en-US...): the
 * mapping lives here and nowhere else.
 */

export { LOCALES, type Locale };
export const DEFAULT_LOCALE: Locale = "en";

/** Discord locales that receive each site language in command localizations. */
export const DISCORD_LOCALES: Record<Locale, LocaleString[]> = {
  en: ["en-US", "en-GB"],
  fr: ["fr"],
  it: ["it"],
  es: ["es-ES", "es-419"],
  id: ["id"],
};

export type Messages = Record<string, unknown>;

export const MESSAGES: Record<Locale, Messages> = { en, fr, it, es, id };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Site language of a Discord locale ("es-419" gives "es"), or null if unsupported. */
export function fromDiscordLocale(locale: string | null | undefined): Locale | null {
  if (!locale) return null;
  const base = locale.split("-")[0]!.toLowerCase();
  return isLocale(base) ? base : null;
}

/**
 * Reply language: the server's setting first (an owner who picked French wants
 * French replies for everyone), then the member's Discord language, then English.
 */
export function resolveLocale(guildSetting: string | null | undefined, interactionLocale: string | null | undefined): Locale {
  if (isLocale(guildSetting)) return guildSetting;
  return fromDiscordLocale(interactionLocale) ?? DEFAULT_LOCALE;
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export type Vars = Record<string, string | number>;

/** Translated text, English when the key is missing, the key itself as a last resort. */
export function t(locale: Locale, key: string, vars?: Vars): string {
  const text = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.en, key) ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

export type Translator = (key: string, vars?: Vars) => string;

export function translator(locale: Locale): Translator {
  return (key, vars) => t(locale, key, vars);
}

/** The same key in every Discord locale but the default, for builder localizations. */
export function localizations(key: string): Partial<Record<LocaleString, string>> {
  const out: Partial<Record<LocaleString, string>> = {};
  for (const locale of LOCALES) {
    const text = lookup(MESSAGES[locale], key);
    if (!text) continue;
    for (const discord of DISCORD_LOCALES[locale]) out[discord] = text;
  }
  return out;
}

/** Every leaf key of a messages object, dotted ("ui.common.error"). */
export function leafKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? leafKeys(v as Messages, key) : [key];
  });
}

/** Number formatted for the language (1 234,5 in French, 1,234.5 in English). */
export function formatNumber(locale: Locale, value: number, digits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

/** A rate already expressed in percent (52.3 for 52.3 %), with the language's spacing. */
export function formatPercent(locale: Locale, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
}
