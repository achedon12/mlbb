/**
 * French translation of content extracted in English (hero
 * stories, mode details).
 *
 * The wiki and the community API only publish in English. Translation happens
 * once, at sync time, and the result is cached: a
 * sentence already translated never goes back over the network. The cache is a plain
 * English → French dictionary, versioned with the repository.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch as translateBatchGoogle } from "./translation-google.mjs";
import { existsSync } from "node:fs";

const CACHE = "scripts/translations.json";


/** A batch of at most ten texts, also capped by the total URL length. */
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
 * Caching translator. Instantiate it once, ask it to translate
 * as many texts as needed, then save the cache at the end.
 */
export async function createTranslator() {
  const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

  /** Translates a list of texts; returns a Map original → French. */
  async function translate(texts) {
    const unique = [...new Set(texts.map((t) => String(t).trim()).filter(Boolean))];
    const missing = unique.filter((t) => !(t in cache));

    const groups = batches(missing);
    for (const [i, group] of groups.entries()) {
      const outputs = await translateBatch(group);
      group.forEach((original, k) => {
        cache[original] = outputs[k] ?? original;
      });
      process.stdout.write(`\r    translation ${i + 1}/${groups.length} batches`);
      await pause(250);
    }
    if (groups.length) process.stdout.write("\n");

    return new Map(unique.map((t) => [t, cache[t] ?? t]));
  }

  /** Translates a single string (or returns null for an empty input). */
  async function translateOne(text) {
    if (!text) return null;
    const m = await translate([text]);
    return m.get(String(text).trim()) ?? text;
  }

  /** Translates an array of strings, in order. */
  async function translateList(list) {
    if (!list?.length) return [];
    const m = await translate(list);
    return list.map((t) => m.get(String(t).trim()) ?? t);
  }

  async function save() {
    // Cache sorted by key: diffs stay readable from one sync to the next.
    const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
    await writeFile(CACHE, JSON.stringify(sorted, null, 2) + "\n");
  }

  return { translate, translateOne, translateList, save };
}
