/**
 * Language configuration.
 *
 * The site is served by language prefix (`/en`, `/fr`, `/it`, `/es`, `/id`), which
 * gives a distinct URL per language — the most readable form for
 * engines, which then index each version separately and link them through
 * `hreflang`.
 *
 * English is the default language (widest reach, and original language
 * of the game data); it is also the target of `hreflang="x-default"`.
 *
 * Every language-dependent part of the site derives from this list: routes,
 * `hreflang`, sitemap, language picker, and the translate scripts (which read
 * this array from the file). Adding a language: see docs/wiki/Translations.md.
 */
export const LOCALES = ["en", "fr", "it", "es", "id"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Label shown in the selector, in the language itself. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  id: "Bahasa Indonesia",
};

/** BCP-47 code for the `lang` attribute and metadata. */
export const LOCALE_HTML: Record<Locale, string> = {
  en: "en",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
  id: "id-ID",
};

/**
 * Name of a language, in that language ("français", "English", "Indonesia"),
 * for sentences that name the language the reader is reading. The selector
 * label above is capitalized and sometimes fuller ("Bahasa Indonesia"), which
 * does not fit inside a sentence.
 */
export function languageName(locale: Locale): string {
  return new Intl.DisplayNames([LOCALE_HTML[locale]], { type: "language", fallback: "none" }).of(locale) ?? LOCALE_NAME[locale];
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
