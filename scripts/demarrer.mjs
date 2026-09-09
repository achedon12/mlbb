/**
 * Demarre le build de production en local.
 *
 * `next start` ne fonctionne pas avec `output: "standalone"` : le serveur
 * autonome attend les ressources statiques a cote de lui, la ou Next les
 * laisse dans `.next/static` et `public/`. En production, c'est le Dockerfile
 * qui fait ce placement ; ce script reproduit la meme chose pour pouvoir
 * verifier un build en local.
 */
import { access, cp } from "node:fs/promises";
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

spawn("node", ["server.js"], {
  cwd: RACINE,
  stdio: "inherit",
  env: { ...process.env, PORT: process.env.PORT ?? "3001", HOSTNAME: "127.0.0.1" },
}).on("exit", (code) => process.exit(code ?? 0));
