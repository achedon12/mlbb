/**
 * Translates the interface message catalogue.
 *
 * The source catalogue is `src/i18n/messages/fr.json` (French, the site's
 * original language); every other language of `LOCALES` is derived from it. The
 * `{variable}` markers are shielded before translation so they are not
 * altered, then restored. So are the game's names, which the French writes
 * in English and every language keeps (`translation-official-names.mjs`).
 *
 * Like the rest, this script only runs by hand or in CI: the output is
 * versioned, the application never translates at runtime.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch as translateBatchGoogle } from "./translation-google.mjs";
import { existsSync } from "node:fs";
import { targetLocales } from "./locales.mjs";
import { applyGlossary } from "./translation-glossary.mjs";
import { OFFICIAL_NAMES } from "./translation-official-names.mjs";
import { namesPattern } from "./translation-shield.mjs";

const SOURCE = "src/i18n/messages/fr.json";
// Every site language but French; `--locale id` narrows the run to the named ones.
const TARGETS = targetLocales("fr");

const CACHE = "scripts/translations-messages.json";
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const PROTECTED = String.fromCharCode(0xE000); // Unicode private use area: preserved by the translator

/**
 * The game's names, as the French catalogue writes them: ranks, rarities,
 * emblems, currencies, modes (`OFFICIAL_NAMES`), items, talents and battle
 * spells. The service translated them like words: "Mythical Glory" would come
 * back as "Gloria Mítica", "Fighter Emblem" as "Эмблема Истребителя".
 */
const ITEM_NAMES = JSON.parse(await readFile("src/data/game/items/en.json", "utf8")).map((o) => o.name);
const EMBLEM_NAMES = [...(await readFile("src/data/emblems.ts", "utf8")).matchAll(/\bname: "([^"]+)"/g)].map((m) => m[1]);
const NAMES = namesPattern([...OFFICIAL_NAMES, ...ITEM_NAMES, ...EMBLEM_NAMES]);
const PARTS = new RegExp(`\\{\\w+\\}|\`[^\`]+\`|\\]\\([^)]+\\)|${NAMES.source}`, "gu");

/** Replaces `{var}` with safe markers, returns the text and the table. */
function protect(text) {
  const vars = [];
  // Shielded: variables {x}, code `x`, a link's URL (…) and the game's
  // names. A link's label [text] is still translated.
  const on = text.replace(PARTS, (m) => {
    vars.push(m);
    return `${PROTECTED}${vars.length - 1}${PROTECTED}`;
  });
  return { on, vars };
}

/** Puts the shielded parts back; null when a marker is lost, duplicated or left over. */
function restore(text, vars) {
  const seen = new Set();
  const output = text.replace(new RegExp(`${PROTECTED}\\s*(\\d+)\\s*${PROTECTED}`, "g"), (_, i) => {
    seen.add(Number(i));
    return vars[Number(i)] ?? "";
  });
  const count = (output.match(new RegExp(`${PROTECTED}`, "g")) ?? []).length;
  return seen.size === vars.length && count === 0 && vars.every((v) => output.includes(v)) ? output : null;
}

const translateBatch = (batch, tl) => translateBatchGoogle(batch, "fr", tl);

/** Applies an async function to every leaf (string) of the tree, with its dotted path. */
async function mapTree(tree, fn, path = "") {
  if (typeof tree === "string") return fn(tree, path);
  const output = Array.isArray(tree) ? [] : {};
  for (const [key, val] of Object.entries(tree)) output[key] = await mapTree(val, fn, path ? `${path}.${key}` : key);
  return output;
}

/**
 * Hand corrections, per language and message key: `{ "fr": source, "text":
 * correction }`. They win over the translation and survive every rerun. The
 * cache is keyed by French text, so a word the French uses in two senses
 * ("Or", the lane and the metal) can only be told apart here. A correction
 * whose French source has since changed is ignored, with a warning: it
 * corrected a sentence that no longer exists.
 */
const OVERRIDES = "scripts/translations-messages-overrides.json";
const overrides = existsSync(OVERRIDES) ? JSON.parse(await readFile(OVERRIDES, "utf8")) : {};

const source = JSON.parse(await readFile(SOURCE, "utf8"));

for (const tl of TARGETS) {
  // Collect every leaf, shield, translate in batches, restore.
  const leaves = [];
  await mapTree(source, (s) => {
    leaves.push(s);
    return s;
  });
  const unique = [...new Set(leaves)];
  // A translation cached before the names were shielded, which lost one,
  // goes back to the service (a hand correction still wins over it).
  let lost = 0;
  for (const u of unique) {
    const out = cache[`${tl}|${u}`];
    if (typeof out === "string" && (u.match(NAMES) ?? []).some((n) => !out.includes(n))) {
      delete cache[`${tl}|${u}`];
      lost++;
    }
  }
  if (lost) console.log(`  ${tl}: ${lost} messages had lost a game name, translated again`);
  const missing = unique.filter((u) => !(`${tl}|${u}` in cache));
  const masked = missing.map(protect);
  const failures = [];
  for (let i = 0; i < masked.length; i += 8) {
    const batch = masked.slice(i, i + 8);
    const translated = await translateBatch(batch.map((p) => p.on), tl);
    for (const [k, p] of batch.entries()) {
      let output = restore(translated[k], p.vars);
      // A lost marker: once more on its own, then give up rather than
      // cache a message whose variables were dropped (the French stays).
      if (output === null) output = restore((await translateBatch([p.on], tl))[0] ?? "", p.vars);
      if (output === null) failures.push(missing[i + k]);
      else cache[`${tl}|${missing[i + k]}`] = output;
    }
    process.stdout.write(`\r  ${tl}: ${Math.min(i + 8, masked.length)}/${masked.length} messages`);
    await pause(200);
  }
  if (masked.length) process.stdout.write("\n");
  for (const f of failures) console.warn(`  ${tl}: markers lost, left untranslated: ${f.slice(0, 80)}`);
  // Hand corrections, then the game vocabulary, applied on output: the cache
  // keeps the raw translation.
  const fixes = {};
  for (const [key, fix] of Object.entries(overrides[tl] ?? {})) {
    let node = source;
    for (const part of key.split(".")) node = node?.[part];
    if (node === fix.fr) fixes[key] = fix.text;
    else console.warn(`  ${tl}: correction ignored, French source changed or gone: ${key}`);
  }
  // {ofName} is the French elision ("d'Aamon"): other languages take the bare name.
  const bare = (text) => text.replace(/\{ofName\}/g, "{name}");
  const tree = await mapTree(source, (s, key) => fixes[key] ?? bare(applyGlossary(cache[`${tl}|${s}`] ?? s, tl, "messages")));
  await writeFile(`src/i18n/messages/${tl}.json`, JSON.stringify(tree, null, 2) + "\n");
  // Same shape as the versioned file: one entry per line, readable diffs.
  await writeFile(CACHE, JSON.stringify(cache, null, 2) + "\n");
  console.log(`${tl}.json: ${unique.length} messages (${missing.length} new)`);
}
console.log("Catalogues translated.");
