/**
 * Traduction en francais des contenus extraits en anglais (histoires des
 * heros, details des modes).
 *
 * Le wiki et l'API communautaire ne publient qu'en anglais. On traduit une
 * seule fois, a la synchronisation, et on met le resultat en cache : une
 * phrase deja traduite ne repart jamais sur le reseau. Le cache est un simple
 * dictionnaire anglais → francais, versionne avec le depot.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch as translateBatchGoogle } from "./translation-google.mjs";
import { existsSync } from "node:fs";

const CACHE = "scripts/translations.json";


/** Un lot d'au plus dix textes, borne aussi par la longueur totale de l'URL. */
function batches(texts) {
  const groups = [];
  let current = [];
  let size = 0;
  for (const t of texts) {
    if (current.length >= 10 || size + t.length > 3500) {
      if (current.length) groups.push(current);
      current = [];
      size = 0;
    }
    current.push(t);
    size += t.length;
  }
  if (current.length) groups.push(current);
  return groups;
}

const translateBatch = (batch) => translateBatchGoogle(batch, "en", "fr", { tolerant: true });

/**
 * Traducteur a cache. On l'instancie une fois, on lui demande de traduire
 * autant de textes que voulu, puis on enregistre le cache a la fin.
 */
export async function createTranslator() {
  const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

  /** Traduit une liste de textes ; renvoie une Map original → francais. */
  async function translate(texts) {
    const unique = [...new Set(texts.map((t) => String(t).trim()).filter(Boolean))];
    const missing = unique.filter((t) => !(t in cache));

    const groups = batches(missing);
    for (const [i, group] of groups.entries()) {
      const outputs = await translateBatch(group);
      group.forEach((original, k) => {
        cache[original] = outputs[k] ?? original;
      });
      process.stdout.write(`\r    traduction ${i + 1}/${groups.length} lots`);
      await pause(250);
    }
    if (groups.length) process.stdout.write("\n");

    return new Map(unique.map((t) => [t, cache[t] ?? t]));
  }

  /** Traduit une chaine unique (ou renvoie null pour une entree vide). */
  async function translateOne(text) {
    if (!text) return null;
    const m = await translate([text]);
    return m.get(String(text).trim()) ?? text;
  }

  /** Traduit un tableau de chaines, dans l'ordre. */
  async function translateList(list) {
    if (!list?.length) return [];
    const m = await translate(list);
    return list.map((t) => m.get(String(t).trim()) ?? t);
  }

  async function save() {
    // Cache trie par clef : les diffs restent lisibles d'une synchro a l'autre.
    const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
    await writeFile(CACHE, JSON.stringify(sorted, null, 2) + "\n");
  }

  return { translate, translateOne, translateList, save };
}
