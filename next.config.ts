import type { NextConfig } from "next";
import { version } from "./package.json";

/**
 * Le site a une partie serveur — sessions de connexion en jeu, appels a l'API
 * communautaire — donc pas d'export statique. `standalone` produit un dossier
 * autonome contenant uniquement les fichiers reellement utilises, ce qui donne
 * une image de production nettement plus legere que l'arborescence complete.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  // Next genere sinon des fichiers d'instructions pour agents a la racine du
  // depot. Ce projet est publie sous le nom de son auteur : rien de tel n'a a
  // y figurer.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  // La racine ne rend pas <html> (c'est [locale]/layout qui le fait) : une
  // adresse inconnue hors langue, comme /llms.txt avant sa creation, finissait
  // en erreur 500 en production. Cette 404 globale rend son propre document.
  experimental: { globalNotFound: true },
  compress: true,
  // Version du site, lue dans package.json au build : le pied de page
  // l'affiche sans qu'on ait a la reporter a la main.
  env: { VERSION_SITE: version },

  images: {
    // Les portraits de heros sont servis par le wiki communautaire qui les
    // heberge. Rien n'est recopie dans ce depot : ce sont des ressources de
    // Moonton, affichees en pointant vers leur hebergeur.
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      // Avatars de profil, servis par le CDN de Moonton.
      { protocol: "https", hostname: "akmpicture.youngjoygame.com" },
      // Icones de competences en repli, quand le wiki ne les fournit pas.
      { protocol: "https", hostname: "akmweb.youngjoygame.com" },
    ],
    formats: ["image/avif", "image/webp"],
    // 50 : fonds assombris (banniere des fiches) ; 75 : tout le reste.
    qualities: [50, 75],
  },

  // Les routes sont passees en anglais. Les anciennes adresses francaises,
  // deja indexees et partagees, redirigent en permanence vers les nouvelles.
  async redirects() {
    return [
      { source: "/heros/:path*", destination: "/heroes/:path*", permanent: true },
      { source: "/objets/:path*", destination: "/items/:path*", permanent: true },
      { source: "/emblemes", destination: "/emblems", permanent: true },
      { source: "/actualites/:path*", destination: "/news/:path*", permanent: true },
      { source: "/veille", destination: "/watch", permanent: true },
      { source: "/comparateur", destination: "/compare", permanent: true },
      { source: "/modes-de-jeu/:path*", destination: "/game-modes/:path*", permanent: true },
      { source: "/a-propos", destination: "/about", permanent: true },
      { source: "/mentions-legales", destination: "/legal", permanent: true },
      { source: "/confidentialite", destination: "/privacy", permanent: true },
      { source: "/compte", destination: "/account", permanent: true },
      { source: "/connexion", destination: "/login", permanent: true },
    ];
  },

  async headers() {
    return [
      // Le service worker doit etre relu a chaque visite : une version en cache
      // HTTP retarderait la mise a jour du cache hors ligne.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/:chemin*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
