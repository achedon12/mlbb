/**
 * Constantes du site, centralisees pour que les metadonnees, le plan du site
 * et le flux RSS restent coherents entre eux.
 */
export const site = {
  nom: "MLBBDex",
  titre: "MLBBDex — Base de connaissances Mobile Legends: Bang Bang",
  description:
    "Fiches heros, builds, tier list argumentee, objets, emblemes, patch notes et actualites de Mobile Legends: Bang Bang, en francais.",
  // `||` et non `??` : dans l'image Docker, un `ARG` non fourni devient une
  // chaine vide (et non `undefined`). Sans ce repli, `new URL("")` echouerait
  // a la construction — c'est ce qui cassait le build de l'image en CI.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://mlbbdex.com",
  langue: "fr-FR",
  auteur: "achedon12",
  depot: "https://github.com/achedon12/mlbb",
} as const;

/** Informations legales : editeur, hebergeur, contact. */
export const legal = {
  editeur: "Leo Deroin",
  editeurSite: "https://leoderoin.fr",
  contact: "contact@leoderoin.fr",
  hebergeur: "Lord Hosting",
  hebergeurSite: "https://lord-hosting.com",
} as const;

/**
 * Navigation principale.
 *
 * Deux familles : ce qui decrit le jeu, et ce qui raconte son actualite. Les
 * separer visuellement evite une file de huit liens ou l'oeil ne distingue
 * plus rien.
 */
export const navigation = [
  { href: "/heroes", label: "Heros", groupe: "jeu" },
  { href: "/tier-list", label: "Tier list", groupe: "jeu" },
  { href: "/compare", label: "Comparateur", groupe: "jeu" },
  { href: "/draft", label: "Draft", groupe: "jeu" },
  { href: "/game-modes", label: "Modes", groupe: "jeu" },
  { href: "/items", label: "Objets", groupe: "jeu" },
  { href: "/emblems", label: "Emblemes", groupe: "jeu" },
  { href: "/news", label: "Actualites", groupe: "actualite" },
  { href: "/watch", label: "Veille", groupe: "actualite" },
  { href: "/patch-notes", label: "Patch notes", groupe: "actualite" },
] as const;

export type Groupe = (typeof navigation)[number]["groupe"];

export function urlAbsolue(chemin: string): string {
  return new URL(chemin, site.url).toString();
}
