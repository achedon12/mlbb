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
export const LANGUES = ["en", "fr", "it", "es"] as const;

export type Langue = (typeof LANGUES)[number];

export const LANGUE_DEFAUT: Langue = "en";

/** Etiquette affichee dans le selecteur, dans la langue elle-meme. */
export const NOM_LANGUE: Record<Langue, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
};

/** Code BCP-47 pour l'attribut `lang` et les métadonnées. */
export const LOCALE_HTML: Record<Langue, string> = {
  en: "en",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
};

export function estLangue(valeur: string): valeur is Langue {
  return (LANGUES as readonly string[]).includes(valeur);
}
