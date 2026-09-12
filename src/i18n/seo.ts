import type { Metadata } from "next";
import type { Article } from "@/lib/types";
import { site } from "@/lib/site";
import { LANGUES, LANGUE_DEFAUT, LOCALE_HTML, type Langue } from "./config";

/**
 * Métadonnées de langue d'une page : son canonique (dans la langue courante) et
 * ses `hreflang` (une entrée par langue, plus `x-default`). À passer à
 * `alternates` dans le `generateMetadata` de chaque page traduite.
 *
 * Codes de langue seuls (`fr`, `es`), sans region : `fr-FR` ou `es-ES` ne
 * visaient que la France et l'Espagne, alors que le public de MLBB est surtout
 * latino-americain en espagnol, et africain, belge ou canadien en francais.
 */
export function metaLangues(locale: Langue, chemin: string) {
  const languages: Record<string, string> = Object.fromEntries(LANGUES.map((l) => [l, `/${l}${chemin}`]));
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
    headline: a.title,
    description: a.summary,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: LOCALE_HTML[locale],
    keywords: a.keywords.join(", "),
    author: { "@type": "Person", name: a.author, url: `https://github.com/${a.author}` },
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

/**
 * Donnees structurees d'un outil (draft, comparateur, calculateur) : une
 * application web gratuite, sans compte, dans la langue de la page.
 */
export function donneesOutil(
  locale: Langue,
  o: { nom: string; description: string; chemin: string; categorie: "GameApplication" | "UtilitiesApplication" },
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: o.nom,
    description: o.description,
    url: `${site.url}/${locale}${o.chemin}`,
    applicationCategory: o.categorie,
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: LOCALE_HTML[locale],
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };
}

/**
 * Donnees structurees d'une page qui liste des heros (catalogue, tier list) :
 * la page, sa date de mise a jour, et la liste ordonnee de ses heros, chacun
 * avec l'adresse de sa fiche.
 */
export function donneesListeHeros(
  locale: Langue,
  o: {
    nom: string;
    description: string;
    chemin: string;
    heros: { nom: string; slug: string }[];
    /** Date ISO de mise a jour des donnees affichees. */
    modifie?: string;
    /** Vrai quand l'ordre est un classement, du plus fort au plus faible. */
    classe?: boolean;
  },
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: o.nom,
    description: o.description,
    url: `${site.url}/${locale}${o.chemin}`,
    inLanguage: LOCALE_HTML[locale],
    ...(o.modifie ? { dateModified: o.modifie } : {}),
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
    mainEntity: {
      "@type": "ItemList",
      name: o.nom,
      numberOfItems: o.heros.length,
      ...(o.classe ? { itemListOrder: "https://schema.org/ItemListOrderDescending" } : {}),
      itemListElement: o.heros.map((h, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: h.nom,
        url: `${site.url}/${locale}/heroes/${h.slug}`,
      })),
    },
  };
}

/** Image de partage par defaut, generee par `src/app/opengraph-image.tsx`. */
const IMAGE_PARTAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: site.titre };

/**
 * Au-dela, le titre complete du nom du site (« … — MLBBDex ») serait coupe
 * dans les resultats : le titre de la page passe alors seul, sans la marque.
 */
const TITRE_MAX = 60;

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
    // Le gabarit de la mise en page ajoute « — MLBBDex » ; un titre deja long
    // le perd plutot que de voir tronquer sa fin (patch, mois).
    title: titrePartage.length > TITRE_MAX ? { absolute: o.titre } : o.titre,
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
