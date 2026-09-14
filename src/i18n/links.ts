import { LOCALES, type Locale } from "./config";

/**
 * Ajoute la langue a une adresse interne : « /heroes » devient « /fr/heroes ».
 *
 * Sans prefixe, le proxy redirige chaque lien vers la bonne langue : un saut
 * de plus pour chaque clic, et pour chaque lien suivi par un moteur. Les
 * adresses externes, deja prefixees ou hors langue (API, fichiers) passent
 * telles quelles.
 */
const PREFIXED = new RegExp(`^/(${LOCALES.join("|")})(/|$|\\?|#)`);
const OUTSIDE_LOCALE =
  /^\/(api|_next|visuels|feed\.xml|sitemap\.xml|robots\.txt|opengraph-image|manifest\.webmanifest|icon\.svg|sw\.js)(\/|$|\?|#)/;

export function prefix(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (PREFIXED.test(href) || OUTSIDE_LOCALE.test(href)) return href;
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}
