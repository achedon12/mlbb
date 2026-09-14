/**
 * Traduit le catalogue de messages de l'interface.
 *
 * Le catalogue source est `src/i18n/messages/fr.json` (le francais, langue
 * d'origine du site). On en derive `en.json`, `it.json` et `es.json`. Les
 * marqueurs `{variable}` sont mis a l'abri avant traduction pour ne pas etre
 * alteres, puis restaures.
 *
 * Comme le reste, ce script ne tourne qu'a la main ou en CI : le resultat est
 * versionne, l'application ne traduit jamais a l'execution.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch as translateBatchGoogle } from "./translation-google.mjs";
import { existsSync } from "node:fs";

const SOURCE = "src/i18n/messages/fr.json";
const TARGETS = ["en", "it", "es"];

const CACHE = "scripts/translations-messages.json";
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const PROTECTED = String.fromCharCode(0xE000); // zone privee Unicode : preservee par le traducteur

/** Remplace les `{var}` par des marqueurs surs, renvoie le texte et la table. */
function protect(text) {
  const vars = [];
  // On met a l'abri : variables {x}, code `x`, et l'URL d'un lien (…). Le
  // libelle d'un lien [texte] reste, lui, traduit.
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

/** Applique une fonction async a chaque feuille (string) de l'arbre. */
async function mapTree(tree, fn) {
  if (typeof tree === "string") return fn(tree);
  const output = Array.isArray(tree) ? [] : {};
  for (const [key, val] of Object.entries(tree)) output[key] = await mapTree(val, fn);
  return output;
}

const source = JSON.parse(await readFile(SOURCE, "utf8"));

for (const tl of TARGETS) {
  // On collecte toutes les feuilles, on protege, on traduit par lots, on remet.
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
  // Meme forme que le fichier versionne : une entree par ligne, diffs lisibles.
  await writeFile(CACHE, JSON.stringify(cache, null, 2) + "\n");
  console.log(`${tl}.json : ${unique.length} messages (${missing.length} nouveaux)`);
}
console.log("Catalogues traduits.");
