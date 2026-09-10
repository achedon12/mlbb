import type { Article } from "@/lib/types";
import { site } from "@/lib/site";
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

/**
 * Donnees structurees d'un billet — actualite ou analyse de patch —, dans la
 * langue de la page : `inLanguage` annoncait jusqu'ici le francais partout.
 */
export function donneesBillet(a: Article, chemin: string, locale: Langue) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.titre,
    description: a.chapeau,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: LOCALE_HTML[locale],
    keywords: a.motsCles.join(", "),
    author: { "@type": "Person", name: a.auteur, url: `https://github.com/${a.auteur}` },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}${chemin}`,
  };
}
