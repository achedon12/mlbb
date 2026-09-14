/**
 * Constantes du site, centralisees pour que les metadonnees, le plan du site
 * et le flux RSS restent coherents entre eux.
 */
export const site = {
  name: "MLBBDex",
  // Nom de l'application installee, image de partage, flux RSS : l'anglais,
  // langue par defaut du site.
  title: "MLBBDex — Mobile Legends: Bang Bang knowledge base",
  description:
    "Hero pages, builds and counters by rank, tier lists, items, emblems, patch notes and news for Mobile Legends: Bang Bang, in English, French, Italian and Spanish.",
  // `||` et non `??` : dans l'image Docker, un `ARG` non fourni devient une
  // chaine vide (et non `undefined`). Sans ce repli, `new URL("")` echouerait
  // a la construction — c'est ce qui cassait le build de l'image en CI.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://mlbbdex.com",
  locale: "en",
  author: "achedon12",
  depot: "https://github.com/achedon12/mlbb",
} as const;

/** Informations legales : editeur, hebergeur, contact. */
export const legal = {
  publisher: "Leo Deroin",
  publisherSite: "https://leoderoin.fr",
  contact: "contact@leoderoin.fr",
  host: "Lord Hosting",
  hostSite: "https://lord-hosting.com",
} as const;

/**
 * Navigation principale.
 *
 * Deux familles : ce qui decrit le jeu, et ce qui raconte son actualite. Les
 * separer visuellement evite une file de huit liens ou l'oeil ne distingue
 * plus rien.
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
