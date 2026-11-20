/**
 * Translates the content data into the other languages.
 *
 * Each dataset has a source language: English for everything taken from the
 * wiki and the game (stories, skills, modes, items, patches, combos), French
 * for what the site writes itself (tier notes, hero analyses). The other site
 * languages are derived from it, never from one another. Everything is cached
 * (`scripts/translations-data.json`, key source+target+text): a sentence
 * already translated never goes back over the network, and a sentence the
 * sync rewrote (a cleanup fix, a wiki edit) is a new key, so it is translated
 * again. This script only runs by hand or in CI; the application translates
 * nothing.
 *
 * `node scripts/translate-data.mjs patches combos` only processes the named
 * datasets; with no argument, all of them. `--locale id` narrows the run to the
 * named target languages (default: every site language but the source).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch } from "./translation-google.mjs";
import { patchesRebuild } from "./patch-translation.mjs";
import { existsSync } from "node:fs";
import { argsWithoutLocale, targetLocales } from "./locales.mjs";
import { applyGlossary, nameRules, restoreNames } from "./translation-glossary.mjs";
import { forgetLost, namesPattern, shieldWith } from "./translation-shield.mjs";

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

/**
 * Translates the texts not in the cache yet. `shield` (optional) hides parts
 * of a text from the service and puts them back in its answer; the cache key
 * stays the original text. A text whose hidden parts did not come back is
 * sent again as is, rather than cached with a part missing.
 */
async function prepare(texts, sl, tl, { shield } = {}) {
  const unique = [...new Set(texts.map((t) => String(t).trim()).filter(Boolean))];
  const missing = unique.filter((t) => !(`${sl}|${tl}|${t}` in cache));
  const groups = batches(missing);
  const lost = [];
  for (const [i, batch] of groups.entries()) {
    const sent = shield ? batch.map(shield) : null;
    const outputs = await translateBatch(sent ? sent.map((s) => s.text) : batch, sl, tl);
    // An empty answer is not cached: the text stays in the source language
    // until a later run gets a real translation.
    batch.forEach((o, k) => {
      if (!outputs[k]?.trim()) return;
      const out = sent ? sent[k].restore(outputs[k]) : outputs[k];
      if (out === null) lost.push(o);
      else cache[`${sl}|${tl}|${o}`] = out;
    });
    process.stdout.write(`\r    ${sl}->${tl} ${i + 1}/${groups.length} batches`);
    // A long run (the patches) does not lose everything on a network drop.
    if (i % 50 === 49) await save();
    await pause(200);
  }
  if (groups.length) process.stdout.write("\n");
  if (lost.length) await prepare(lost, sl, tl);
}

/**
 * Short values the service gets wrong out of context: a story sheet's
 * "Female" came back as "Femelle", an animal's sex. They are set here per
 * language, ahead of the cache.
 */
const FIXED = {
  fr: { Male: "Homme", Female: "Femme" },
  it: { Male: "Uomo", Female: "Donna" },
  es: { Male: "Hombre", Female: "Mujer" },
  pt: { Male: "Homem", Female: "Mulher" },
  id: { Male: "Laki-laki", Female: "Perempuan" },
  fil: { Male: "Lalaki", Female: "Babae" },
  th: { Male: "ชาย", Female: "หญิง" },
  ru: { Male: "Мужской", Female: "Женский" },
};

const tr = (sl, tl) => (t) => {
  if (!t) return t;
  const key = String(t).trim();
  return (sl === "en" ? FIXED[tl]?.[key] : undefined) ?? cache[`${sl}|${tl}|${key}`] ?? t;
};

/**
 * Hero names as the service writes them in each language, to put the game's
 * own back (`restoreNames`). Translated once, cached like the rest.
 */
const HERO_NAMES = JSON.parse(await readFile("src/data/game/heroes.json", "utf8")).map((h) => h.name);
const heroNames = new Map();
const HERO_SET = new Set(HERO_NAMES);

/**
 * Hero names and the game's own name, hidden from the service in narrative
 * text (`translation-shield.mjs`). In a sentence it translates them like
 * words ("Novaria (teacher)" came back as "Novarie (enseignant)", the game as
 * "Légendes mobiles"), which no rule on its answer can reliably undo in a
 * Latin alphabet. Behind numbered markers, the name comes back as the game
 * writes it.
 */
const NAMES_RE = namesPattern(HERO_NAMES);
const shieldNames = shieldWith(NAMES_RE);

/**
 * Drops the cached translations that lost a protected name of their source
 * (a translation made before the name was shielded): the next `prepare`
 * translates them again, names shielded.
 */
function forgetLostNames(texts, sl, tl, pattern) {
  const dropped = forgetLost(cache, texts, sl, tl, pattern).length;
  if (dropped) console.log(`    ${tl}: ${dropped} translations had lost a protected name, translated again`);
  return dropped;
}

async function heroNameRules(tl) {
  if (!heroNames.has(tl)) {
    await prepare(HERO_NAMES, "en", tl);
    heroNames.set(tl, nameRules(new Map(HERO_NAMES.map((n) => [n, cache[`en|${tl}|${n}`]])), tl));
  }
  return heroNames.get(tl);
}

/** Same, with the hero names restored. Hero stories stop there: a narrative. */
const trNames = (sl, tl, names) => {
  const t = tr(sl, tl);
  // A text that is only a hero name stays as the game writes it: its cache
  // entry is the service's guess at the name (Joy as "Joie", Lukas as
  // "Lucas"), kept to recognise the name in sentences, never to show it.
  return (x) => (x ? (HERO_SET.has(String(x).trim()) ? x : restoreNames(t(x), x, names)) : x);
};

/** Same, with the target language's game vocabulary (`translation-glossary.mjs`) applied. */
const trGame = (sl, tl, names) => {
  const t = trNames(sl, tl, names);
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
      headings: h.headings ?? [],
      trivia: tl_(h.trivia),
      profile: f
        ? {
            fullName: f.fullName,
            title: t(f.title),
            species: t(f.species),
            gender: t(f.gender),
            age: t(f.age),
            origin: t(f.origin),
            // "December 29", written in English by the sync.
            birthday: t(f.birthday),
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
    // Name, cooldown and cost stay as in the game: only the description is prose.
    Object.entries(d).map(([s, l]) => [s, l.map((c) => (c ? { ...c, description: t(c.description) } : c))]),
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

/**
 * Hand-written hero analyses (`src/data/heroes/`), written in French.
 *
 * Only the prose is translated; slugs, items, spells, cooldowns and the
 * order of the skills stay with the source, which the application merges back
 * (`analysisFor` in `src/lib/data.ts`). The output is keyed by slug.
 */
/** A data file written in TypeScript: it only imports types, so once transpiled it is plain data. */
async function importTs(file) {
  const { default: ts } = await import("typescript");
  const js = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

async function loadAnalyses() {
  const dir = "src/data/heroes";
  const out = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".ts") && f !== "index.ts").sort()) {
    for (const list of Object.values(await importTs(`${dir}/${file}`))) if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

/**
 * Item, talent and battle spell names, which the site writes in English
 * (the style rule), and the game's name: sent behind markers so the service
 * leaves them alone, instead of turning "sans Flicker" into "without
 * flickering" or "Mobile Legends" into "Légendes mobiles".
 */
const PRIVATE = String.fromCharCode(0xe000);
const { talents, battleSpells } = await importTs("src/data/emblems.ts");
const GAME_TERMS = [
  ...new Set([
    ...JSON.parse(await readFile("src/data/game/items/en.json", "utf8")).map((o) => o.name),
    ...talents.map((x) => x.name),
    ...battleSpells.map((x) => x.name),
    // Blessings the patch notes name: the items of the roam and jungle boots.
    "Roaming Blessings",
    "Roaming Blessing",
    "Ice Retribution",
    "Flame Retribution",
    "Bloody Retribution",
  ]),
]
  .filter((n) => n.length > 3)
  .sort((a, b) => b.length - a.length);
const TERMS_RE = namesPattern(GAME_TERMS);
/**
 * Game data from the wiki (patches, skills, items, modes, combos): hero names,
 * the game's name and the item, talent and battle spell names all stay as the
 * game writes them. "[Book of Sages]" had come back as "[Livre des Sages]".
 */
const GAME_RE = namesPattern([...HERO_NAMES, ...GAME_TERMS]);
const shieldGame = shieldWith(GAME_RE);
/**
 * Names whose loss sends a cached game text back to the service. A Latin
 * alphabet that lost a hero name translated it ("Joie" for Joy); Russian and
 * Thai write the names in their own alphabet, which `restoreNames` undoes, so
 * there only the other protected names count.
 */
const forgetGame = (tl) => (tl === "ru" || tl === "th" ? TERMS_RE : GAME_RE);
function shieldTerms(text) {
  const terms = [];
  const shielded = text.replace(TERMS_RE, (m) => `${PRIVATE}${terms.push(m) - 1}${PRIVATE}`);
  return { shielded, terms };
}
/** Terms back in place; a marker the service dropped takes its term with it, so the text is kept only if all came back. */
function unshieldTerms(output, terms, fallback) {
  const found = new Set();
  const text = output.replace(new RegExp(`${PRIVATE}\\s*(\\d+)\\s*${PRIVATE}`, "g"), (_, n) => {
    found.add(Number(n));
    return terms[Number(n)] ?? "";
  });
  return found.size === terms.length ? text : fallback;
}
/**
 * French MOBA jargon the service reads as everyday French, reworded before
 * it is sent: "un tank d'engagement" came back as a betrothal tank in
 * Russian, Thai and Indonesian, "la file classée" as a classified line. Only
 * the nouns: the verb "engager" also means "to involve" in the analyses.
 */
const JARGON = [
  [/\b(Tank|Roam) d'engagement\b/g, "$1 initiateur"],
  [/\b([dl])'engagement\b/g, "$1'initiation"],
  [/\bL'engagement\b/g, "L'initiation"],
  [/\bun engagement\b/g, "une initiation"],
  [/\bEngagement\b/g, "Initiation"],
  [/\bengagements?\b/g, (m) => (m.endsWith("s") ? "initiations" : "initiation")],
  [/\bfiles? classées?\b/g, (m) => (m.startsWith("files") ? "parties classées" : "partie classée")],
];
const clarifyJargon = (text) => JARGON.reduce((s, [pattern, by]) => s.replace(pattern, by), text);

const analysesRebuild = (d, tr) => {
  const t = (x) => {
    const { shielded, terms } = shieldTerms(clarifyJargon(x));
    // A text whose markers did not survive stays in French (the application
    // falls back to the source), rather than lose an item name.
    return unshieldTerms(tr(shielded), terms, x);
  };
  return Object.fromEntries(
    d.map((a) => [
      a.slug,
      {
        summary: t(a.summary),
        // Paragraph by paragraph: the blank line between them survives.
        analysis: a.analysis.split("\n\n").map(t).join("\n\n"),
        skills: a.skills.map((c) => t(c.description)),
        strengths: a.strengths.map(t),
        weaknesses: a.weaknesses.map(t),
        builds: a.builds.map((b) => ({ name: t(b.name), context: t(b.context) })),
      },
    ]),
  );
};

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
  // Stories, skills and modes: English source, which the sync writes to
  // `stories/en.json`, `skills/en.json` (official skill texts) and
  // `modes/en.json`. Every other language, French included, is translated
  // from it, never from another translation: English rebuilt from the French
  // turned "The aloof Duke of Castle Aberleen" into "The distant Duke of
  // Aberleen Castle".
  //
  // `shield`: the names hidden from the service (`translation-shield.mjs`).
  // `forget`: the names whose loss sends a cached translation back to the
  // service, shielded this time (a pattern, or one per target language).
  // Stories only drop a translation that lost the game's name; the game data
  // one that lost a protected name (`forgetGame`).
  stories: { source: "en", narrative: true, shield: shieldNames, forget: namesPattern([]), texts: storiesTexts, rebuild: storiesRebuild },
  skills: { source: "en", shield: shieldGame, forget: forgetGame, texts: skillsTexts, rebuild: skillsRebuild },
  modes: { source: "en", shield: shieldGame, forget: forgetGame, texts: modesTexts, rebuild: modesRebuild },
  items: { source: "en", shield: shieldGame, forget: forgetGame, texts: itemsTexts, rebuild: itemsRebuild },
  "tier-notes": { source: "fr", shield: shieldGame, texts: tierNotesTexts, rebuild: tierNotesRebuild },
  analyses: { source: "fr", load: loadAnalyses, texts: collect(analysesRebuild), rebuild: analysesRebuild },
  // Patch notes list heroes by name, and the service turned Chip into "Puce",
  // Joy into "Joie" and Lukas into "Lucas": every protected name counts.
  patches: {
    source: "en",
    shield: shieldGame,
    forget: GAME_RE,
    file: "src/data/game/patches.json",
    extract: (d) => d.details,
    texts: collect(patchesRebuild),
    rebuild: patchesRebuild,
  },
  combos: {
    source: "en",
    file: "src/data/game/combos.json",
    optional: true,
    shield: shieldGame,
    forget: forgetGame,
    texts: collect(descriptionsRebuild),
    rebuild: descriptionsRebuild,
  },
};

const requests = argsWithoutLocale();
for (const name of requests) if (!(name in GAMES)) throw new Error(`Unknown dataset: ${name}`);

for (const [name, cfg] of Object.entries(GAMES)) {
  if (requests.length && !requests.includes(name)) continue;
  const file = cfg.file ?? `src/data/game/${name}/${cfg.source}.json`;
  if (!cfg.load && !existsSync(file)) {
    if (cfg.optional) {
      console.log(`${name}: ${file} missing, nothing to translate`);
      continue;
    }
    throw new Error(`Missing source: ${file}`);
  }
  const raw = cfg.load ? await cfg.load() : JSON.parse(await readFile(file, "utf8"));
  const source = cfg.extract ? cfg.extract(raw) : raw;
  const all = cfg.texts(source);
  console.log(`${name} (${cfg.source}): ${new Set(all.map((x) => String(x).trim())).size} unique texts`);
  await mkdir(`src/data/game/${name}`, { recursive: true });
  for (const tl of targetLocales(cfg.source)) {
    const shield = cfg.shield ? { shield: cfg.shield } : {};
    const forget = typeof cfg.forget === "function" ? cfg.forget(tl) : cfg.forget;
    if (forget) forgetLostNames(all, cfg.source, tl, forget);
    await prepare(all, cfg.source, tl, shield);
    const t = tr(cfg.source, tl);
    // Second pass: an HTML block whose translation lost its tags
    // falls back to its texts one by one, which then need translating too.
    const missing = [];
    cfg.rebuild(source, (x) => {
      if (x && !(`${cfg.source}|${tl}|${String(x).trim()}` in cache)) missing.push(x);
      return t(x);
    });
    await prepare(missing, cfg.source, tl, shield);
    const names = await heroNameRules(tl);
    const tree = cfg.rebuild(source, cfg.narrative ? trNames(cfg.source, tl, names) : trGame(cfg.source, tl, names));
    await writeFile(`src/data/game/${name}/${tl}.json`, JSON.stringify(tree, null, 2) + "\n");
    await save();
    console.log(`  ${name}/${tl}.json`);
  }
}
console.log("Data translated.");
