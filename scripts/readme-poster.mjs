/**
 * Launcher of the README key art (`scripts/readme-poster.tsx`): the poster
 * reuses the share images' pipeline (`src/lib/og`), written in TypeScript
 * with JSX and the `@/` alias, which plain Node does not resolve. jiti
 * compiles it on the fly, as the app's own bundler would.
 *
 *   npm run readme:poster
 */
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  jsx: { runtime: "automatic", importSource: "react" },
});

const entry = process.argv[2] ?? "./readme-poster.tsx";
await jiti.import(new URL(entry, import.meta.url).href);
