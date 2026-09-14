/**
 * Traduit les articles Markdown du francais vers en/it/es.
 *
 * Source : `content/fr/<section>/*.md`. Sorties : `content/<langue>/…`. On
 * traduit le titre et le chapeau de l'en-tete YAML, et le corps paragraphe par
 * paragraphe (les titres `##`, listes et emphases sont preserves). Le cache est
 * partage avec les autres donnees. Ne tourne qu'a la main ou en CI.
 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { pause, translateBatch } from "./translation-google.mjs";
import { existsSync } from "node:fs";

const TARGETS = ["en", "it", "es"];
const CACHE = "scripts/translations-data.json";
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

async function translate(text, tl) {
  const t = String(text);
  if (!t.trim()) return t;
  const key = `fr|${tl}|${t.trim()}`;
  if (!(key in cache)) {
    const [output] = await translateBatch([t.trim()], "fr", tl);
    cache[key] = output ?? t.trim();
    await pause(150);
  }
  return t.replace(t.trim(), cache[key]);
}

/** Traduit une ligne de corps, en preservant son marqueur Markdown de tete. */
async function translateRow(row, tl) {
  if (!row.trim()) return row;
  // Marqueur de tete : #, -, *, >, chiffres de liste — on le garde tel quel.
  const m = row.match(/^(\s*(?:#{1,6}\s+|[-*>]\s+|\d+\.\s+)?)([\s\S]*)$/);
  const prefix = m[1] ?? "";
  const body = m[2] ?? row;
  if (!body.trim()) return row;
  return prefix + (await translate(body, tl));
}

async function translateBody(body, tl) {
  const rows = body.split("\n");
  const out = [];
  for (const l of rows) out.push(await translateRow(l, tl));
  return out.join("\n");
}

const SECTIONS = ["news", "patch-notes"];

for (const tl of TARGETS) {
  for (const section of SECTIONS) {
    const folder = `content/fr/${section}`;
    if (!existsSync(folder)) continue;
    await mkdir(`content/${tl}/${section}`, { recursive: true });
    for (const file of await readdir(folder)) {
      if (!file.endsWith(".md")) continue;
      const raw = await readFile(`${folder}/${file}`, "utf8");
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) continue;
      let header = m[1];
      const body = m[2];
      // Titre et chapeau de l'en-tete.
      for (const field of ["title", "summary"]) {
        const re = new RegExp(`^(${field}:\\s*)(.+)$`, "m");
        const mm = header.match(re);
        if (mm) {
          const val = mm[2].replace(/^["']|["']$/g, "");
          const translated = (await translate(val, tl)).replace(/"/g, "'");
          header = header.replace(re, `$1"${translated}"`);
        }
      }
      const bodyTranslated = await translateBody(body, tl);
      await writeFile(`content/${tl}/${section}/${file}`, `---\n${header}\n---\n${bodyTranslated}`);
    }
    await writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");
    console.log(`content/${tl}/${section}`);
  }
}
console.log("Articles traduits.");
