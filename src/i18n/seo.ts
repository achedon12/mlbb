import type { Metadata } from "next";
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

/** Locale Open Graph de chaque langue du site. */
export const OG_LOCALE: Record<Langue, string> = {
  en: "en_US",
  fr: "fr_FR",
  it: "it_IT",
  es: "es_ES",
};

/** Image de partage par defaut, generee par `src/app/opengraph-image.tsx`. */
const IMAGE_PARTAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: site.titre };

/**
 * Metadonnees d'une page : titre, description, canonique et `hreflang`, carte
 * Open Graph et carte Twitter, toujours avec une image. Une page qui definit
 * son propre `openGraph` remplace celui du gabarit, image comprise : sans
 * image explicite, ses liens partages s'affichaient nus.
 */
export function metaPage(
  locale: Langue,
  o: {
    titre: string;
    description: string;
    /** Chemin sans langue, « /heroes/aamon ». */
    chemin: string;
    /** Description des cartes de partage, si elle differe. */
    partage?: string;
    /** Image propre a la page ; a defaut, l'image de partage du site. */
    image?: string;
    type?: "website" | "article";
    motsCles?: string[];
    /** Date de publication d'un article. */
    publie?: string;
    auteur?: string;
  },
): Metadata {
  const images = [o.image ? { url: o.image } : IMAGE_PARTAGE];
  const titrePartage = `${o.titre} — ${site.nom}`;
  const descriptionPartage = o.partage ?? o.description;
  const openGraph = {
    type: o.type ?? "website",
    siteName: site.nom,
    locale: OG_LOCALE[locale],
    title: titrePartage,
    description: descriptionPartage,
    url: `/${locale}${o.chemin}`,
    images,
    ...(o.type === "article" && o.publie
      ? { publishedTime: o.publie, authors: o.auteur ? [o.auteur] : undefined }
      : {}),
  } as Metadata["openGraph"];
  return {
    title: o.titre,
    description: o.description,
    ...(o.motsCles?.length ? { keywords: o.motsCles } : {}),
    alternates: metaLangues(locale, o.chemin),
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: titrePartage,
      description: descriptionPartage,
      images: images.map((i) => i.url),
    },
  };
}
