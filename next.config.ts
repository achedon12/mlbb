import type { NextConfig } from "next";

/**
 * Le site a une partie serveur — sessions, base SQLite, verification
 * d'identifiant — donc pas d'export statique. `standalone` produit un dossier
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
  // Le module SQLite est natif : il doit rester requis au runtime plutot
  // qu'etre inclus dans le bundle.
  serverExternalPackages: ["better-sqlite3"],

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
