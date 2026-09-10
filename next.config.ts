import type { NextConfig } from "next";

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
  compress: true,

  images: {
    // Les portraits de heros sont servis par le wiki communautaire qui les
    // heberge. Rien n'est recopie dans ce depot : ce sont des ressources de
    // Moonton, affichees en pointant vers leur hebergeur.
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      // Vignettes des presentations video ; le lecteur n'est charge qu'au clic.
      { protocol: "https", hostname: "i.ytimg.com" },
      // Avatars de profil, servis par le CDN de Moonton.
      { protocol: "https", hostname: "akmpicture.youngjoygame.com" },
      // Icones de competences en repli, quand le wiki ne les fournit pas.
      { protocol: "https", hostname: "akmweb.youngjoygame.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
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
