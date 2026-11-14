/**
 * Language configuration.
 *
 * The site is served by language prefix (`/en`, `/fr`, `/id`, `/pt`…), which
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
/**
 * The codes double as URL segments, so they stay lowercase and without a
 * region: `pt` is Brazilian Portuguese (the game's Portuguese client is
 * Brazil's), and its region shows in `lang` and `hreflang` (`LOCALE_HTML`).
 * Filipino is `fil`, the code browsers send next to Tagalog's `tl`.
 */
export const LOCALES = ["en", "fr", "it", "es", "id", "fil", "th", "pt", "ru"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Label shown in the selector, in the language itself. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  id: "Bahasa Indonesia",
  fil: "Filipino",
  th: "ไทย",
  pt: "Português (Brasil)",
  ru: "Русский",
};

/** BCP-47 code for the `lang` attribute and metadata. */
export const LOCALE_HTML: Record<Locale, string> = {
  en: "en",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
  id: "id-ID",
  fil: "fil-PH",
  th: "th-TH",
  pt: "pt-BR",
  ru: "ru-RU",
};

/**
 * `hreflang` value of each language: the bare code, so that `fr` or `es`
 * reach every French or Spanish reader rather than France or Spain only
 * (see `metaLocales`). Portuguese is the exception: its texts are Brazilian,
 * and say so, so that readers in Portugal keep their own results first.
 */
export const LOCALE_HREFLANG: Record<Locale, string> = {
  ...(Object.fromEntries(LOCALES.map((l) => [l, l])) as Record<Locale, string>),
  pt: "pt-BR",
};

/**
 * Locale for `Intl` and `toLocale…String`: the `lang` code, except Thai, whose
 * default calendar is the Buddhist one (2569 for 2026). A patch dated in the
 * Buddhist era next to a season counted in Gregorian years would read as two
 * different dates, so every language counts years the same way.
 */
export const LOCALE_INTL: Record<Locale, string> = {
  ...LOCALE_HTML,
  th: "th-TH-u-ca-gregory",
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

/**
 * Browsers name Filipino `fil` or, on older systems, Tagalog `tl`: both
 * read the same site. Every Portuguese (`pt-BR`, `pt-PT`) gets the
 * Brazilian one, the only Portuguese of the site.
 */
const LANGUAGE_ALIASES: Record<string, Locale> = { tl: "fil" };

/** First language of an `Accept-Language` header the site speaks, in the header's order. */
export function localeFromHeader(header: string | null): Locale | null {
  for (const entry of header?.split(",") ?? []) {
    // The primary subtag only: "fil-PH" is "fil", not "fi" (Finnish).
    const code = entry.split(";")[0]!.trim().split("-")[0]!.toLowerCase();
    const locale = LANGUAGE_ALIASES[code] ?? code;
    if (isLocale(locale)) return locale;
  }
  return null;
}
