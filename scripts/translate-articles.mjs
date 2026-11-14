/**
 * Translates the Markdown articles from French to the other site languages.
 *
 * Source: `content/fr/<section>/*.md`. Outputs: `content/<locale>/…`. The
 * title and summary of the YAML front matter are translated, and the body paragraph by
 * paragraph (`##` headings, lists and emphasis are preserved). The cache is
 * shared with the other data. Only runs by hand or in CI.
 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { pause, translateBatch } from "./translation-google.mjs";
import { existsSync } from "node:fs";
import { targetLocales } from "./locales.mjs";
import { applyGlossary } from "./translation-glossary.mjs";

// Every site language but French; `--locale id` narrows the run to the named ones.
const TARGETS = targetLocales("fr");
const CACHE = "scripts/translations-data.json";
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

const PROTECTED = String.fromCharCode(0xe000);

/**
 * Shields what the service must not touch: a link's address `](/heroes/ling)`
 * and inline code. The link's label is still translated. Guides link to the
 * site's pages on almost every line; a translated or respaced address would
 * be a dead link.
 */
function protect(text) {
  const parts = [];
  const on = text.replace(/`[^`]+`|\]\([^)]+\)/g, (m) => {
    parts.push(m);
    return `${PROTECTED}${parts.length - 1}${PROTECTED}`;
  });
  return { on, parts };
}

/** Puts the shielded parts back; null when a marker was lost, duplicated or left over. */
function restore(text, parts) {
  const seen = new Set();
  const output = text
    .replace(new RegExp(`${PROTECTED}\\s*(\\d+)\\s*${PROTECTED}`, "g"), (_, i) => {
      seen.add(Number(i));
      return parts[Number(i)] ?? "";
    })
    // The service sometimes closes the label itself, or puts a space between
    // the label and the address: `[label]](/x)`, `[label] (/x)`.
    .replace(/\]\s*\]\(/g, "](")
    .replace(/\]\s+\(/g, "](");
  const left = output.includes(PROTECTED);
  return seen.size === parts.length && !left && parts.every((p) => output.includes(p)) ? output : null;
}

async function translate(text, tl) {
  const t = String(text);
  if (!t.trim()) return t;
  const key = `fr|${tl}|${t.trim()}`;
  if (!(key in cache)) {
    // The cache keeps the restored text: a hand correction is written in
    // plain Markdown, never with markers.
    const { on, parts } = protect(t.trim());
    const [raw] = await translateBatch([on], "fr", tl);
    const restored = parts.length ? restore(raw ?? "", parts) : raw;
    // An empty answer happens on long lines: keeping it would drop a whole
    // paragraph or list item without a trace.
    const output = restored?.trim() ? restored : null;
    if (output === null) {
      console.warn(`Translation unusable (${tl}), French kept: ${t.trim().slice(0, 80)}`);
    }
    cache[key] = output ?? t.trim();
    await pause(150);
  }
  // Game vocabulary applied on output; the cache keeps the raw translation.
  const output = applyGlossary(cache[key], tl, "data");
  return t.replace(t.trim(), () => output);
}

/** Translates a body line, preserving its leading Markdown marker. */
async function translateRow(row, tl) {
  if (!row.trim()) return row;
  // A guide's live block marker (`<!-- guide:heroes -->`) is not text.
  if (/^\s*<!--[\s\S]*-->\s*$/.test(row)) return row;
  // Leading marker: #, -, *, >, list numbers — kept as is.
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

const SECTIONS = ["news", "patch-notes", "guides"];
// Guides are evergreen pages found through search: their keywords are
// translated too, where a news post keeps its French ones.
const KEYWORDS_TRANSLATED = new Set(["guides"]);

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
      // Front matter title and summary.
      for (const field of ["title", "short", "summary"]) {
        const re = new RegExp(`^(${field}:\\s*)(.+)$`, "m");
        const mm = header.match(re);
        if (mm) {
          const val = mm[2].replace(/^["']|["']$/g, "");
          const translated = (await translate(val, tl)).replace(/"/g, "'");
          header = header.replace(re, `$1"${translated}"`);
        }
      }
      const keywords = KEYWORDS_TRANSLATED.has(section) ? header.match(/^(keywords:\s*)(\[.*\])$/m) : null;
      if (keywords) {
        const list = [];
        for (const k of JSON.parse(keywords[2])) list.push((await translate(k, tl)).replace(/"/g, "'"));
        // Two French keywords often share one translation ("tireur", "marksman").
        const unique = [...new Set(list.map((k) => k.trim()))];
        header = header.replace(keywords[0], () => `${keywords[1]}[${unique.map((k) => `"${k}"`).join(", ")}]`);
      }
      const bodyTranslated = await translateBody(body, tl);
      await writeFile(`content/${tl}/${section}/${file}`, `---\n${header}\n---\n${bodyTranslated}`);
    }
    await writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");
    console.log(`content/${tl}/${section}`);
  }
}
console.log("Articles translated.");
