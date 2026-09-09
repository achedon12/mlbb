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

/** Navigation principale, reprise dans l'en-tete et le pied de page. */
export const navigation = [
  { href: "/heros", label: "Heros" },
  { href: "/tier-list", label: "Tier list" },
  { href: "/objets", label: "Objets" },
  { href: "/emblemes", label: "Emblemes" },
  { href: "/actualites", label: "Actualites" },
  { href: "/veille", label: "Veille" },
  { href: "/patch-notes", label: "Patch notes" },
] as const;

export function urlAbsolue(chemin: string): string {
  return new URL(chemin, site.url).toString();
}
