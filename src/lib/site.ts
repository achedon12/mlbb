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
    "Hero pages, builds and counters by rank, tier lists, items, emblems, patch notes and news for Mobile Legends: Bang Bang, in English, French, Italian, Spanish, Indonesian, Filipino, Thai, Portuguese and Russian.",
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
  // Hosting of the site (LCEN art. 6: name, address, phone), from the
  // host's own legal notice (lordhosting.fr/mentions-legales, May 2026).
  host: "LORDHOSTING SASU",
  hostSite: "https://lordhosting.fr",
  hostAddress: "5 square Frédéric Vallois, 75015 Paris, France",
  hostPhone: "+33 6 01 21 24 27",
  // Hosting of the audience measurement (Matomo), on another server:
  // from PulseHeberg's terms (cdn.pulseheberg.com/contracts/fr/cgu.pdf).
  analyticsHost: "SAS PulseHeberg",
  analyticsHostSite: "https://pulseheberg.com",
  analyticsHostAddress: "9 boulevard de Strasbourg, 83000 Toulon, France",
} as const;

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}
