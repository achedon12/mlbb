/**
 * Language configuration.
 *
 * The site is served by language prefix (`/en`, `/fr`, `/it`, `/es`), which
 * gives a distinct URL per language — the most readable form for
 * engines, which then index each version separately and link them through
 * `hreflang`.
 *
 * English is the default language (widest reach, and original language
 * of the game data); it is also the target of `hreflang="x-default"`.
 */
export const LOCALES = ["en", "fr", "it", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Label shown in the selector, in the language itself. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
};

/** BCP-47 code for the `lang` attribute and metadata. */
export const LOCALE_HTML: Record<Locale, string> = {
  en: "en",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
