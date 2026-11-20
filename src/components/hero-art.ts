import { illustrations } from "@/lib/data";

/**
 * Artwork lookups for the poster pages. Server side only: the artwork
 * catalogue stays out of the client bundles, which receive the paths.
 */

/** A hero's main artwork (the first released one), or null. */
export function heroArt(slug: string): string | null {
  const byName = illustrations[slug];
  return byName ? (Object.values(byName)[0] ?? null) : null;
}

/** A hero's artwork for a given skin name, or null. */
export function skinArt(slug: string, skin: string): string | null {
  return illustrations[slug]?.[skin] ?? null;
}
