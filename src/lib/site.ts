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
  depot: "https://github.com/achedon12/mlbb",
} as const;

/** Legal information: publisher, host, contact. */
export const legal = {
  publisher: "Leo Deroin",
  publisherSite: "https://leoderoin.fr",
  contact: "contact@leoderoin.fr",
  host: "Lord Hosting",
  hostSite: "https://lord-hosting.com",
} as const;

/**
 * Main navigation.
 *
 * Two families: what describes the game, and what covers its news. Separating
 * them visually avoids a row of eight links where the eye can no longer
 * tell anything apart.
 */
export const navigation = [
  { href: "/heroes", label: "Heros", group: "game" },
  { href: "/tier-list", label: "Tier list", group: "game" },
  { href: "/compare", label: "Comparateur", group: "game" },
  { href: "/draft", label: "Draft", group: "game" },
  { href: "/game-modes", label: "Modes", group: "game" },
  { href: "/items", label: "Objets", group: "game" },
  { href: "/emblems", label: "Emblemes", group: "game" },
  { href: "/news", label: "Actualites", group: "news" },
  { href: "/watch", label: "Veille", group: "news" },
  { href: "/patch-notes", label: "Patch notes", group: "news" },
] as const;

export type Group = (typeof navigation)[number]["group"];

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}
