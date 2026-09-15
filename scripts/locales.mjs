/**
 * Site languages, for the Node scripts.
 *
 * The list lives in `src/i18n/config.ts` (`LOCALES`); the scripts cannot import
 * TypeScript, so they read the array literal from that file. Adding a language
 * there is then enough for the translate scripts to produce it.
 */
import { readFileSync } from "node:fs";

const CONFIG = new URL("../src/i18n/config.ts", import.meta.url);

/** Reads `export const LOCALES = [...]` from the config source. */
export function readLocales(source = readFileSync(CONFIG, "utf8")) {
  const match = source.match(/export const LOCALES\s*=\s*\[([^\]]*)\]/);
  if (!match) throw new Error("LOCALES not found in src/i18n/config.ts");
  const locales = [...match[1].matchAll(/["']([a-z]{2,3})["']/g)].map((m) => m[1]);
  if (!locales.length) throw new Error("LOCALES is empty in src/i18n/config.ts");
  return locales;
}

export const LOCALES = readLocales();

/**
 * Target languages for a run: every language but the source, narrowed to
 * those named on the command line (`--locale id`, repeatable or comma
 * separated). A named language not yet in `LOCALES` is accepted: a new
 * language is translated before it is switched on in the config.
 */
export function targetLocales(source, argv = process.argv.slice(2)) {
  const requested = [];
  argv.forEach((arg, i) => {
    if (arg === "--locale" && argv[i + 1]) requested.push(...argv[i + 1].split(","));
    else if (arg.startsWith("--locale=")) requested.push(...arg.slice("--locale=".length).split(","));
  });
  for (const l of requested) {
    if (!/^[a-z]{2,3}$/.test(l)) throw new Error(`Invalid locale code: ${l}`);
    if (!LOCALES.includes(l)) console.warn(`Note: ${l} is not in LOCALES yet (src/i18n/config.ts)`);
  }
  if (!requested.length) return LOCALES.filter((l) => l !== source);
  return [...new Set(requested)].filter((l) => l !== source);
}

/** Command-line arguments without the `--locale` option and its value. */
export function argsWithoutLocale(argv = process.argv.slice(2)) {
  return argv.filter((arg, i) => arg !== "--locale" && argv[i - 1] !== "--locale" && !arg.startsWith("--locale="));
}
