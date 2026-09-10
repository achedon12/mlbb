import { LANGUES, LANGUE_DEFAUT, LOCALE_HTML, type Langue } from "./config";

/**
 * Métadonnées de langue d'une page : son canonique (dans la langue courante) et
 * ses `hreflang` (une entrée par langue, plus `x-default`). À passer à
 * `alternates` dans le `generateMetadata` de chaque page traduite.
 */
export function metaLangues(locale: Langue, chemin: string) {
  const languages: Record<string, string> = Object.fromEntries(
    LANGUES.map((l) => [LOCALE_HTML[l], `/${l}${chemin}`]),
  );
  languages["x-default"] = `/${LANGUE_DEFAUT}${chemin}`;
  return { canonical: `/${locale}${chemin}`, languages };
}
