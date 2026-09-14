import type { Locale } from "@/i18n/config";
import { LOCALE_HTML } from "@/i18n/config";
import { allHeroes, sync } from "./data";
import { RARITIES } from "./rarities";
import { site } from "./site";
import { heroGallery } from "./hero-skins";
import {
  AVAILABILITIES,
  NUMERIC_CURRENCIES,
  anchorsOf,
  isOrigin,
  isReleased,
  readRelease,
  type Catalog,
  type Availability,
  type Price,
  type SkinCatalog,
} from "./skin-catalog";

/**
 * Catalogue des skins cote serveur : jointure du module de skins du wiki et
 * des portraits de boutique, en objets `SkinCatalogue`. Les pages du
 * calendrier le lisent directement ; l'index compact en est l'encodage.
 */

/** Date des donnees : « ce mois-ci » et « sorti » se jugent a cette date, pas a celle du build. */
export const dateReference = sync.date.slice(0, 10);

/** Retire les liens du wiki : « [[MLBB × Naruto|MLBB X Naruto]] » garde son libelle. */
export function cleanObtain(text: string | undefined): string | null {
  if (!text) return null;
  const clean = text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return clean || null;
}

/** Prix chiffres ; une valeur illisible est ignoree plutot que comptee pour zero. */
export function readPrice(raw: Record<string, string>): Price {
  const price: Price = {};
  for (const m of NUMERIC_CURRENCIES) {
    const n = Number(raw[m]);
    if (raw[m] && Number.isFinite(n) && n > 0) price[m] = n;
  }
  return price;
}

/**
 * Le wiki ecrit parfois la meme serie avec deux casses (« Annual StarLight »,
 * « Annual Starlight ») : elles se rangent sous la graphie la plus courante.
 */
function seriesSpellings(values: (string | null)[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const v of values) {
    if (!v) continue;
    const key = v.toLowerCase();
    const spellings = counts.get(key) ?? new Map<string, number>();
    spellings.set(v, (spellings.get(v) ?? 0) + 1);
    counts.set(key, spellings);
  }
  return new Map(
    [...counts].map(([key, spellings]) => [key, [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]]),
  );
}

let cache: Catalog | null = null;

export function catalogSkins(): Catalog {
  if (cache) return cache;
  // Un heros sans aucun skin recense (annonce, pas encore sorti) ne peut pas etre possede.
  const withSkins = allHeroes.filter((h) => h.skins.length > 0);
  const series = seriesSpellings(withSkins.flatMap((h) => h.skins.map((s) => s.label)));
  const skins: SkinCatalog[] = withSkins.flatMap((h) => {
    const gallery = heroGallery(h).skins;
    const anchors = anchorsOf(gallery.map((s) => s.name));
    return gallery.map((s, i) => ({
      id: s.id,
      name: s.name,
      hero: h.slug,
      // Une rarete inconnue compte comme la plus commune plutot que de passer pour un skin d'origine.
      rarity: s.rarity ? (RARITIES[s.rarity]?.rank ?? 1) : 0,
      series: s.label ? (series.get(s.label.toLowerCase()) ?? s.label) : null,
      release: s.release,
      availability: (AVAILABILITIES as readonly string[]).includes(s.availability ?? "") ? (s.availability as Availability) : null,
      price: readPrice(s.price),
      acquisition: cleanObtain(s.price.other),
      image: s.portrait ?? s.illustration,
      anchor: anchors[i],
    }));
  });
  cache = {
    maj: dateReference,
    heroes: withSkins.map((h) => ({ slug: h.slug, name: h.name, roles: h.roles, icon: h.images.icon ?? h.images.portrait })),
    skins,
  };
  return cache;
}

/** Skins du calendrier : sortis a la date des donnees, sans les skins d'origine (ce sont des sorties de heros). */
export function releasedSkins(): SkinCatalog[] {
  return catalogSkins().skins.filter((s) => !isOrigin(s) && isReleased(s, dateReference));
}

/** Annees qui ont au moins un skin sorti, de la plus recente a la plus ancienne. */
export function calendarYears(): number[] {
  return [...new Set(releasedSkins().map((s) => readRelease(s.release)!.year))].sort((a, b) => b - a);
}

/** Heros indexes par slug, pour les filtres et les liens. */
export function catalogHeroes() {
  return new Map(catalogSkins().heroes.map((h) => [h.slug, h]));
}

/**
 * Donnees structurees d'une page qui liste des skins ou des pages de skins :
 * la page, sa date de mise a jour et sa liste ordonnee.
 */
export function dataListSkins(
  locale: Locale,
  o: { name: string; description: string; path: string; elements: { name: string; path: string }[] },
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: o.name,
    description: o.description,
    url: `${site.url}/${locale}${o.path}`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: dateReference,
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    mainEntity: {
      "@type": "ItemList",
      name: o.name,
      numberOfItems: o.elements.length,
      itemListElement: o.elements.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: e.name,
        url: `${site.url}/${locale}${e.path}`,
      })),
    },
  };
}
