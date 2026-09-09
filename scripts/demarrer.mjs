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

const RACINE = ".next/standalone";

try {
  await access(`${RACINE}/server.js`);
} catch {
  console.error("Build introuvable. Lancer `npm run build` d'abord.");
  process.exit(1);
}

await cp(".next/static", `${RACINE}/.next/static`, { recursive: true });
await cp("public", `${RACINE}/public`, { recursive: true }).catch(() => {});

/**
 * Charge `.env.local`.
 *
 * Le serveur autonome demarre depuis `.next/standalone/` : il n'y trouve
 * aucun fichier d'environnement, et Next ne remonte pas jusqu'a la racine du
 * projet. Sans cela, SESSION_SECRET est absent et toutes les pages de compte
 * echouent. En production, c'est le conteneur qui fournit ces variables.
 */
async function environnementLocal() {
  const variables = {};
  try {
    const contenu = await readFile(".env.local", "utf8");
    for (const ligne of contenu.split("\n")) {
      const trouve = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!trouve) continue;
      // Les valeurs peuvent etre entourees de guillemets.
      variables[trouve[1]] = trouve[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Pas de fichier : on laisse l'environnement du shell decider.
  }
  return variables;
}

const local = await environnementLocal();

if (!local.SESSION_SECRET && !process.env.SESSION_SECRET) {
  console.error(
    "SESSION_SECRET absent. Copier .env.example vers .env.local et le renseigner :\n" +
      "  echo \"SESSION_SECRET=$(openssl rand -hex 32)\" >> .env.local",
  );
  process.exit(1);
}

spawn("node", ["server.js"], {
  cwd: RACINE,
  stdio: "inherit",
  // Le shell l'emporte sur le fichier : on peut surcharger ponctuellement.
  env: { ...local, ...process.env, PORT: process.env.PORT ?? "3001", HOSTNAME: "127.0.0.1" },
}).on("exit", (code) => process.exit(code ?? 0));
