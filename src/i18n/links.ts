import { LOCALES, type Locale } from "./config";

/**
 * Adds the language to an internal address: "/heroes" becomes "/fr/heroes".
 *
 * Without a prefix, the proxy redirects each link to the right language: one more
 * hop for every click, and for every link followed by an engine. External
 * addresses, already prefixed or outside a language (API, files) pass
 * through unchanged.
 */
const PREFIXED = new RegExp(`^/(${LOCALES.join("|")})(/|$|\\?|#)`);
const OUTSIDE_LOCALE =
  /^\/(api|_next|visuels|feed\.xml|sitemap\.xml|robots\.txt|opengraph-image|manifest\.webmanifest|icon\.svg|sw\.js)(\/|$|\?|#)/;

export function prefix(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (PREFIXED.test(href) || OUTSIDE_LOCALE.test(href)) return href;
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}
