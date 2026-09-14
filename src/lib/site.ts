/**
 * Site constants, centralized so that metadata, the sitemap
 * and the RSS feed stay consistent with each other.
 */
export const site = {
  name: "MLBBDex",
  // Installed app name, share image, RSS feed: English, the site's
  // default language.
  title: "MLBBDex — Mobile Legends: Bang Bang knowledge base",
  description:
    "Hero pages, builds and counters by rank, tier lists, items, emblems, patch notes and news for Mobile Legends: Bang Bang, in English, French, Italian and Spanish.",
  // `||` and not `??`: in the Docker image, an `ARG` that is not provided becomes an
  // empty string (not `undefined`). Without this fallback, `new URL("")` would fail
  // at build time — that is what broke the image build in CI.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://mlbbdex.com",
  locale: "en",
  author: "achedon12",
  repository: "https://github.com/achedon12/mlbb",
} as const;

/** Legal information: publisher, host, contact. */
export const legal = {
  publisher: "Leo Deroin",
  publisherSite: "https://leoderoin.fr",
  contact: "contact@leoderoin.fr",
  host: "Lord Hosting",
  hostSite: "https://lord-hosting.com",
} as const;

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}
