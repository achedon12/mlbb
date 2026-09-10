import { LANGUES, type Langue } from "./config";

/**
 * Ajoute la langue a une adresse interne : « /heroes » devient « /fr/heroes ».
 *
 * Sans prefixe, le proxy redirige chaque lien vers la bonne langue : un saut
 * de plus pour chaque clic, et pour chaque lien suivi par un moteur. Les
 * adresses externes, deja prefixees ou hors langue (API, fichiers) passent
 * telles quelles.
 */
const PREFIXEE = new RegExp(`^/(${LANGUES.join("|")})(/|$|\\?|#)`);
const HORS_LANGUE =
  /^\/(api|_next|visuels|feed\.xml|sitemap\.xml|robots\.txt|opengraph-image|manifest\.webmanifest|icon\.svg|sw\.js)(\/|$|\?|#)/;

export function prefixer(href: string, langue: Langue): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (PREFIXEE.test(href) || HORS_LANGUE.test(href)) return href;
  return href === "/" ? `/${langue}` : `/${langue}${href}`;
}
