/**
 * Translates the interface message catalogue.
 *
 * The source catalogue is `src/i18n/messages/fr.json` (French, the site's
 * original language). `en.json`, `it.json` and `es.json` are derived from it. The
 * `{variable}` markers are shielded before translation so they are not
 * altered, then restored.
 *
 * Like the rest, this script only runs by hand or in CI: the output is
 * versioned, the application never translates at runtime.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch as translateBatchGoogle } from "./translation-google.mjs";
import { existsSync } from "node:fs";

const SOURCE = "src/i18n/messages/fr.json";
const TARGETS = ["en", "it", "es"];

const CACHE = "scripts/translations-messages.json";
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const PROTECTED = String.fromCharCode(0xE000); // Unicode private use area: preserved by the translator

/** Replaces `{var}` with safe markers, returns the text and the table. */
function protect(text) {
  const vars = [];
  // Shielded: variables {x}, code `x`, and a link's URL (…). A link's
  // label [text] is still translated.
  const on = text.replace(/\{\w+\}|`[^`]+`|\]\([^)]+\)/g, (m) => {
    vars.push(m);
    return `${PROTECTED}${vars.length - 1}${PROTECTED}`;
  });
  return { on, vars };
}

function restore(text, vars) {
  return text.replace(new RegExp(`${PROTECTED}(\\d+)${PROTECTED}`, "g"), (_, i) => vars[Number(i)] ?? "");
}

const translateBatch = (batch, tl) => translateBatchGoogle(batch, "fr", tl);

/** Applies an async function to every leaf (string) of the tree. */
async function mapTree(tree, fn) {
  if (typeof tree === "string") return fn(tree);
  const output = Array.isArray(tree) ? [] : {};
  for (const [key, val] of Object.entries(tree)) output[key] = await mapTree(val, fn);
  return output;
}

const source = JSON.parse(await readFile(SOURCE, "utf8"));

for (const tl of TARGETS) {
  // Collect every leaf, shield, translate in batches, restore.
  const leaves = [];
  await mapTree(source, (s) => {
    leaves.push(s);
    return s;
  });
  const unique = [...new Set(leaves)];
  const missing = unique.filter((u) => !(`${tl}|${u}` in cache));
  const masked = missing.map(protect);
  for (let i = 0; i < masked.length; i += 8) {
    const batch = masked.slice(i, i + 8);
    const translated = await translateBatch(batch.map((p) => p.on), tl);
    batch.forEach((p, k) => (cache[`${tl}|${missing[i + k]}`] = restore(translated[k], p.vars)));
    await pause(200);
  }
  const tree = await mapTree(source, (s) => cache[`${tl}|${s}`] ?? s);
  await writeFile(`src/i18n/messages/${tl}.json`, JSON.stringify(tree, null, 2) + "\n");
  // Same shape as the versioned file: one entry per line, readable diffs.
  await writeFile(CACHE, JSON.stringify(cache, null, 2) + "\n");
  console.log(`${tl}.json: ${unique.length} messages (${missing.length} new)`);
}
console.log("Catalogues translated.");
