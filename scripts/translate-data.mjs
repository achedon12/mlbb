/**
 * Translates the content data into the other languages.
 *
 * Each dataset has a source language (French for what is
 * extracted from the wiki then translated, English for raw items and patches);
 * the other site languages are derived from it. Everything is cached
 * (`scripts/translations-data.json`, key source+target+text): a sentence
 * already translated never goes back over the network. This script only runs by
 * hand or in CI; the application translates nothing.
 *
 * `node scripts/translate-data.mjs patches combos` only processes the named
 * datasets; with no argument, all of them. `--locale id` narrows the run to the
 * named target languages (default: every site language but the source).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch } from "./translation-google.mjs";
import { patchesRebuild } from "./patch-translation.mjs";
import { existsSync } from "node:fs";
import { argsWithoutLocale, targetLocales } from "./locales.mjs";
import { applyGlossary } from "./translation-glossary.mjs";

const CACHE = "scripts/translations-data.json";

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const save = () => writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");

/**
 * Batches of at most ten texts, also capped in length: everything goes in the URL,
 * and an encoded patch paragraph (markers included) can weigh several KB.
 */
function batches(texts) {
  const groups = [];
  let current = [];
  let size = 0;
  for (const t of texts) {
    const weight = encodeURIComponent(t).length;
    if (current.length >= 10 || (current.length && size + weight > 6000)) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(t);
    size += weight;
  }
  if (current.length) groups.push(current);
  return groups;
}

async function prepare(texts, sl, tl) {
  const unique = [...new Set(texts.map((t) => String(t).trim()).filter(Boolean))];
  const missing = unique.filter((t) => !(`${sl}|${tl}|${t}` in cache));
  const groups = batches(missing);
  for (const [i, batch] of groups.entries()) {
    const outputs = await translateBatch(batch, sl, tl);
    // An empty answer is not cached: the text stays in the source language
    // until a later run gets a real translation.
    batch.forEach((o, k) => {
      if (outputs[k]?.trim()) cache[`${sl}|${tl}|${o}`] = outputs[k];
    });
    process.stdout.write(`\r    ${sl}->${tl} ${i + 1}/${groups.length} batches`);
    // A long run (the patches) does not lose everything on a network drop.
    if (i % 50 === 49) await save();
    await pause(200);
  }
  if (groups.length) process.stdout.write("\n");
}

const tr = (sl, tl) => (t) => (t ? (cache[`${sl}|${tl}|${String(t).trim()}`] ?? t) : t);

/** Same, with the target language's game vocabulary (`translation-glossary.mjs`) applied. */
const trGame = (sl, tl) => {
  const t = tr(sl, tl);
  return (x) => (x ? applyGlossary(t(x), tl, "data") : x);
};

/** Texts to translate for a dataset: those its rebuild asks for, in order. */
const collect = (rebuild) => (d) => {
  const out = [];
  rebuild(d, (x) => {
    if (x) out.push(x);
    return x;
  });
  return out;
};

// ── Per-dataset configuration ──────────────────────────────────────
function storiesTexts(d) {
  const out = [];
  for (const h of Object.values(d)) {
    if (h.tagline) out.push(h.tagline);
    out.push(...(h.lore ?? []), ...(h.trivia ?? []));
    if (h.profile) {
      for (const c of ["title", "species", "gender", "age", "origin"]) if (h.profile[c]) out.push(h.profile[c]);
      out.push(...(h.profile.affiliations ?? []), ...(h.profile.relations ?? []), ...(h.profile.powers ?? []));
    }
  }
  return out;
}
function storiesRebuild(d, t) {
  const tl_ = (list) => (list ?? []).map(t);
  const o = {};
  for (const [slug, h] of Object.entries(d)) {
    const f = h.profile;
    o[slug] = {
      tagline: t(h.tagline),
      lore: tl_(h.lore),
      trivia: tl_(h.trivia),
      profile: f
        ? {
            fullName: f.fullName,
            title: t(f.title),
            species: t(f.species),
            gender: t(f.gender),
            age: t(f.age),
            origin: t(f.origin),
            birthday: f.birthday,
            affiliations: tl_(f.affiliations),
            relations: tl_(f.relations),
            powers: tl_(f.powers),
          }
        : null,
    };
  }
  return o;
}

function skillsTexts(d) {
  const out = [];
  for (const l of Object.values(d)) for (const c of l) if (c?.description) out.push(c.description);
  return out;
}
const skillsRebuild = (d, t) =>
  Object.fromEntries(
    Object.entries(d).map(([s, l]) => [s, l.map((c) => (c ? { name: c.name, description: t(c.description) } : c))]),
  );

function modesTexts(d) {
  const out = [];
  for (const m of d) {
    if (m.description) out.push(m.description);
    for (const s of m.sections ?? []) {
      out.push(s.title);
      for (const e of s.elements ?? []) out.push(e.text);
    }
  }
  return out;
}
const modesRebuild = (d, t) =>
  d.map((m) => ({
    ...m,
    description: t(m.description),
    sections: (m.sections ?? []).map((s) => ({
      title: t(s.title),
      elements: (s.elements ?? []).map((e) => ({ type: e.type, text: t(e.text) })),
    })),
  }));

const FIELDS_ITEM = ["summary", "bonus", "unique", "passive", "active", "bestFor"];
function itemsTexts(d) {
  const out = [];
  for (const o of d) for (const c of FIELDS_ITEM) if (o[c]) out.push(o[c]);
  return out;
}
const itemsRebuild = (d, t) =>
  d.map((o) => ({ ...o, ...Object.fromEntries(FIELDS_ITEM.map((c) => [c, o[c] ? t(o[c]) : o[c]])) }));

const tierNotesTexts = (d) => Object.values(d);
const tierNotesRebuild = (d, t) => Object.fromEntries(Object.entries(d).map(([s, v]) => [s, t(v)]));

/** Combos: only `description` fields (text or list of texts) are translated, wherever they are. */
function descriptionsRebuild(d, t) {
  if (Array.isArray(d)) return d.map((x) => descriptionsRebuild(x, t));
  if (!d || typeof d !== "object") return d;
  return Object.fromEntries(
    Object.entries(d).map(([k, v]) => {
      if (k !== "description") return [k, descriptionsRebuild(v, t)];
      return [k, typeof v === "string" ? t(v) : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? t(x) : x)) : v];
    }),
  );
}

/**
 * `file`: source outside the dataset folder (a sync file that is not
 * split per language); `extract` keeps the part to translate.
 * `optional`: the dataset is skipped as long as its source does not exist.
 */
const GAMES = {
  // `narrative`: prose where game words are ordinary words, no glossary.
  stories: { source: "fr", narrative: true, texts: storiesTexts, rebuild: storiesRebuild },
  skills: { source: "fr", texts: skillsTexts, rebuild: skillsRebuild },
  modes: { source: "fr", texts: modesTexts, rebuild: modesRebuild },
  items: { source: "en", texts: itemsTexts, rebuild: itemsRebuild },
  "tier-notes": { source: "fr", texts: tierNotesTexts, rebuild: tierNotesRebuild },
  patches: {
    source: "en",
    file: "src/data/game/patches.json",
    extract: (d) => d.details,
    texts: collect(patchesRebuild),
    rebuild: patchesRebuild,
  },
  combos: {
    source: "en",
    file: "src/data/game/combos.json",
    optional: true,
    texts: collect(descriptionsRebuild),
    rebuild: descriptionsRebuild,
  },
};

const requests = argsWithoutLocale();
for (const name of requests) if (!(name in GAMES)) throw new Error(`Unknown dataset: ${name}`);

for (const [name, cfg] of Object.entries(GAMES)) {
  if (requests.length && !requests.includes(name)) continue;
  const file = cfg.file ?? `src/data/game/${name}/${cfg.source}.json`;
  if (!existsSync(file)) {
    if (cfg.optional) {
      console.log(`${name}: ${file} missing, nothing to translate`);
      continue;
    }
    throw new Error(`Missing source: ${file}`);
  }
  const raw = JSON.parse(await readFile(file, "utf8"));
  const source = cfg.extract ? cfg.extract(raw) : raw;
  const all = cfg.texts(source);
  console.log(`${name} (${cfg.source}): ${new Set(all.map((x) => String(x).trim())).size} unique texts`);
  await mkdir(`src/data/game/${name}`, { recursive: true });
  for (const tl of targetLocales(cfg.source)) {
    await prepare(all, cfg.source, tl);
    const t = tr(cfg.source, tl);
    // Second pass: an HTML block whose translation lost its tags
    // falls back to its texts one by one, which then need translating too.
    const missing = [];
    cfg.rebuild(source, (x) => {
      if (x && !(`${cfg.source}|${tl}|${String(x).trim()}` in cache)) missing.push(x);
      return t(x);
    });
    await prepare(missing, cfg.source, tl);
    const tree = cfg.rebuild(source, cfg.narrative ? t : trGame(cfg.source, tl));
    await writeFile(`src/data/game/${name}/${tl}.json`, JSON.stringify(tree, null, 2) + "\n");
    await save();
    console.log(`  ${name}/${tl}.json`);
  }
}
console.log("Data translated.");
