/**
 * Demarre le build de production en local.
 *
 * `next start` ne fonctionne pas avec `output: "standalone"` : le serveur
 * autonome attend les ressources statiques a cote de lui, la ou Next les
 * laisse dans `.next/static` et `public/`. En production, c'est le Dockerfile
 * qui fait ce placement ; ce script reproduit la meme chose pour pouvoir
 * verifier un build en local.
 */
import { access, cp, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const ROOT = ".next/standalone";

try {
  await access(`${ROOT}/server.js`);
} catch {
  console.error("Build introuvable. Lancer `npm run build` d'abord.");
  process.exit(1);
}

await cp(".next/static", `${ROOT}/.next/static`, { recursive: true });
await cp("public", `${ROOT}/public`, { recursive: true }).catch(() => {});

/**
 * Charge `.env.local`.
 *
 * Le serveur autonome demarre depuis `.next/standalone/` : il n'y trouve aucun
 * fichier d'environnement, et Next ne remonte pas jusqu'a la racine du projet.
 * On lit donc `.env.local` a la main pour le developpement ; en production,
 * c'est le conteneur qui fournit les variables.
 */
async function environmentLocal() {
  const variables = {};
  try {
    const content = await readFile(".env.local", "utf8");
    for (const row of content.split("\n")) {
      const found = row.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!found) continue;
      // Les valeurs peuvent etre entourees de guillemets.
      variables[found[1]] = found[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Pas de fichier : on laisse l'environnement du shell decider.
  }
  return variables;
}

const local = await environmentLocal();

spawn("node", ["server.js"], {
  cwd: ROOT,
  stdio: "inherit",
  // Le shell l'emporte sur le fichier : on peut surcharger ponctuellement.
  env: { ...local, ...process.env, PORT: process.env.PORT ?? "3001", HOSTNAME: "127.0.0.1" },
}).on("exit", (code) => process.exit(code ?? 0));
