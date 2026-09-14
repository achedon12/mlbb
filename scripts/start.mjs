/**
 * Starts the production build locally.
 *
 * `next start` does not work with `output: "standalone"`: the standalone
 * server expects static assets next to it, whereas Next leaves them
 * in `.next/static` and `public/`. In production, the Dockerfile does
 * that placement; this script reproduces it so a build can be
 * checked locally.
 */
import { access, cp, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const ROOT = ".next/standalone";

try {
  await access(`${ROOT}/server.js`);
} catch {
  console.error("Build not found. Run `npm run build` first.");
  process.exit(1);
}

await cp(".next/static", `${ROOT}/.next/static`, { recursive: true });
await cp("public", `${ROOT}/public`, { recursive: true }).catch(() => {});

/**
 * Loads `.env.local`.
 *
 * The standalone server starts from `.next/standalone/`: it finds no
 * environment file there, and Next does not walk up to the project root.
 * So `.env.local` is read by hand for development; in production,
 * the container provides the variables.
 */
async function environmentLocal() {
  const variables = {};
  try {
    const content = await readFile(".env.local", "utf8");
    for (const row of content.split("\n")) {
      const found = row.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!found) continue;
      // Values may be wrapped in quotes.
      variables[found[1]] = found[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No file: let the shell environment decide.
  }
  return variables;
}

const local = await environmentLocal();

spawn("node", ["server.js"], {
  cwd: ROOT,
  stdio: "inherit",
  // The shell wins over the file: values can be overridden one-off.
  env: { ...local, ...process.env, PORT: process.env.PORT ?? "3001", HOSTNAME: "127.0.0.1" },
}).on("exit", (code) => process.exit(code ?? 0));
