import type { Metadata } from "next";
import type { Article } from "@/lib/types";
import { site } from "@/lib/site";
import { LOCALES, DEFAULT_LOCALE, LOCALE_HTML, type Locale } from "./config";

/**
 * Métadonnées de langue d'une page : son canonique (dans la langue courante) et
 * ses `hreflang` (une entrée par langue, plus `x-default`). À passer à
 * `alternates` dans le `generateMetadata` de chaque page traduite.
 *
 * Codes de langue seuls (`fr`, `es`), sans region : `fr-FR` ou `es-ES` ne
 * visaient que la France et l'Espagne, alors que le public de MLBB est surtout
 * latino-americain en espagnol, et africain, belge ou canadien en francais.
 */
export function metaLocales(locale: Locale, path: string) {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, `/${l}${path}`]));
  languages["x-default"] = `/${DEFAULT_LOCALE}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}

/**
 * Donnees structurees d'un billet — actualite ou analyse de patch —, dans la
 * langue de la page : `inLanguage` annoncait jusqu'ici le francais partout.
 */
export function postData(a: Article, path: string, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.summary,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: LOCALE_HTML[locale],
    keywords: a.keywords.join(", "),
    author: { "@type": "Person", name: a.author, url: `https://github.com/${a.author}` },
    publisher: { "@type": "Organization", name: site.name, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}${path}`,
  };
}

/** Locale Open Graph de chaque langue du site. */
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  it: "it_IT",
  es: "es_ES",
};

/**
 * Donnees structurees d'un outil (draft, comparateur, calculateur) : une
 * application web gratuite, sans compte, dans la langue de la page.
 */
export function dataTool(
  locale: Locale,
  o: { name: string; description: string; path: string; category: "GameApplication" | "UtilitiesApplication" },
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: o.name,
    description: o.description,
    url: `${site.url}/${locale}${o.path}`,
    applicationCategory: o.category,
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: LOCALE_HTML[locale],
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: site.name, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };
}

/**
 * Donnees structurees d'une page qui liste des heros (catalogue, tier list) :
 * la page, sa date de mise a jour, et la liste ordonnee de ses heros, chacun
 * avec l'adresse de sa fiche.
 */
export function heroListData(
  locale: Locale,
  o: {
    name: string;
    description: string;
    path: string;
    heroes: { name: string; slug: string }[];
    /** Date ISO de mise a jour des donnees affichees. */
    changed?: string;
    /** Vrai quand l'ordre est un classement, du plus fort au plus faible. */
    ranked?: boolean;
  },
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: o.name,
    description: o.description,
    url: `${site.url}/${locale}${o.path}`,
    inLanguage: LOCALE_HTML[locale],
    ...(o.changed ? { dateModified: o.changed } : {}),
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    mainEntity: {
      "@type": "ItemList",
      name: o.name,
      numberOfItems: o.heroes.length,
      ...(o.ranked ? { itemListOrder: "https://schema.org/ItemListOrderDescending" } : {}),
      itemListElement: o.heroes.map((h, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: h.name,
        url: `${site.url}/${locale}/heroes/${h.slug}`,
      })),
    },
  };
}

/** Image de partage par defaut, generee par `src/app/opengraph-image.tsx`. */
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: site.title };

/**
 * Au-dela, le titre complete du nom du site (« … — MLBBDex ») serait coupe
 * dans les resultats : le titre de la page passe alors seul, sans la marque.
 */
const TITLE_MAX = 60;

/**
 * Metadonnees d'une page : titre, description, canonique et `hreflang`, carte
 * Open Graph et carte Twitter, toujours avec une image. Une page qui definit
 * son propre `openGraph` remplace celui du gabarit, image comprise : sans
 * image explicite, ses liens partages s'affichaient nus.
 */
export function metaPage(
  locale: Locale,
  o: {
    title: string;
    description: string;
    /** Chemin sans langue, « /heroes/aamon ». */
    path: string;
    /** Description des cartes de partage, si elle differe. */
    share?: string;
    /** Image propre a la page ; a defaut, l'image de partage du site. */
    image?: string;
    type?: "website" | "article";
    keywords?: string[];
    /** Date de publication d'un article. */
    published?: string;
    author?: string;
  },
): Metadata {
  const images = [o.image ? { url: o.image } : SHARE_IMAGE];
  const titleShare = `${o.title} — ${site.name}`;
  const descriptionShare = o.share ?? o.description;
  const openGraph = {
    type: o.type ?? "website",
    siteName: site.name,
    locale: OG_LOCALE[locale],
    title: titleShare,
    description: descriptionShare,
    url: `/${locale}${o.path}`,
    images,
    ...(o.type === "article" && o.published
      ? { publishedTime: o.published, authors: o.author ? [o.author] : undefined }
      : {}),
  } as Metadata["openGraph"];
  return {
    // Le gabarit de la mise en page ajoute « — MLBBDex » ; un titre deja long
    // le perd plutot que de voir tronquer sa fin (patch, mois).
    title: titleShare.length > TITLE_MAX ? { absolute: o.title } : o.title,
    description: o.description,
    ...(o.keywords?.length ? { keywords: o.keywords } : {}),
    alternates: metaLocales(locale, o.path),
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: titleShare,
      description: descriptionShare,
      images: images.map((i) => i.url),
    },
  };
}
