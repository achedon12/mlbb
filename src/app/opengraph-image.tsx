import { asJpeg } from "@/lib/og/assets";
import { homeCard } from "@/lib/og/cards";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
// Re-encoded from the engine's PNG: a fraction of its weight (`asJpeg`).
export const contentType = "image/jpeg";

/**
 * Default share image, outside any language: in English, the site's
 * default language. Pages point to their own card, or to their language's
 * home card (`/<locale>/opengraph-image`); this one stays for the addresses
 * that have no language (feeds, the manifest, older shared links).
 */
export default async function Image() {
  return asJpeg(await homeCard("en"));
}
