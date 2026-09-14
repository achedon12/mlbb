/**
 * Configuration des langues.
 *
 * Le site est servi par prefixe de langue (`/en`, `/fr`, `/it`, `/es`), ce qui
 * donne une URL distincte par langue — la forme la plus lisible pour les
 * moteurs, qui indexent alors chaque version separement et les relient par
 * `hreflang`.
 *
 * L'anglais est la langue par defaut (portee la plus large, et langue d'origine
 * des donnees du jeu) ; c'est aussi la cible du `hreflang="x-default"`.
 */
export const LOCALES = ["en", "fr", "it", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Etiquette affichee dans le selecteur, dans la langue elle-meme. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
};

/** Code BCP-47 pour l'attribut `lang` et les métadonnées. */
export const LOCALE_HTML: Record<Locale, string> = {
  en: "en",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
