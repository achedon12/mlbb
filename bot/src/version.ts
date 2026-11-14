import { readFileSync } from "node:fs";

/**
 * The bot's version, from its package.json: one level above `src/` when
 * tested, above `dist/` when running (the image copies package.json next to
 * `dist/`). Read once; "dev" when it cannot be found.
 */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "dev";
  } catch {
    return "dev";
  }
}

export const VERSION = readVersion();
