/**
 * Constantes du site, centralisees pour que les metadonnees, le plan du site
 * et le flux RSS restent coherents entre eux.
 */
export const site = {
  nom: "MLBB.fr",
  titre: "MLBB — Base de connaissances Mobile Legends: Bang Bang",
  description:
    "Fiches heros, builds, tier list argumentee, objets, emblemes, patch notes et actualites de Mobile Legends: Bang Bang, en francais.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://mlbb.leoderoin.fr",
  langue: "fr-FR",
  auteur: "achedon12",
  depot: "https://github.com/achedon12/mlbb",
} as const;

/**
 * Navigation principale.
 *
 * Deux familles : ce qui decrit le jeu, et ce qui raconte son actualite. Les
 * separer visuellement evite une file de huit liens ou l'oeil ne distingue
 * plus rien.
 */
export const navigation = [
  { href: "/heros", label: "Heros", groupe: "jeu" },
  { href: "/tier-list", label: "Tier list", groupe: "jeu" },
  { href: "/comparateur", label: "Comparateur", groupe: "jeu" },
  { href: "/draft", label: "Draft", groupe: "jeu" },
  { href: "/objets", label: "Objets", groupe: "jeu" },
  { href: "/emblemes", label: "Emblemes", groupe: "jeu" },
  { href: "/actualites", label: "Actualites", groupe: "actualite" },
  { href: "/veille", label: "Veille", groupe: "actualite" },
  { href: "/patch-notes", label: "Patch notes", groupe: "actualite" },
] as const;

export type Groupe = (typeof navigation)[number]["groupe"];

export function urlAbsolue(chemin: string): string {
  return new URL(chemin, site.url).toString();
}
