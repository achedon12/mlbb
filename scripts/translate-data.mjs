/**
 * Traduit les donnees de contenu vers les autres langues.
 *
 * Chaque jeu de donnees a une langue source (le francais pour ce qui est
 * extrait du wiki puis traduit, l'anglais pour les objets bruts et les patchs) ;
 * on en derive les trois autres langues. Tout est mis en cache
 * (`scripts/translations-data.json`, clef source+cible+texte) : une phrase
 * deja traduite ne repart jamais sur le reseau. Ce script ne tourne qu'a la
 * main ou en CI ; l'application ne traduit rien.
 *
 * `node scripts/translate-data.mjs patchs combos` ne traite que les jeux
 * nommes ; sans argument, tous.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pause, translateBatch } from "./translation-google.mjs";
import { translateHtml } from "./translation-html.mjs";
import { existsSync } from "node:fs";

const LOCALES = ["en", "fr", "it", "es"];
const CACHE = "scripts/translations-data.json";

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const save = () => writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");

/**
 * Lots d'au plus dix textes, bornes aussi en longueur : tout part dans l'URL,
 * et un paragraphe de patch encode (marqueurs compris) peut peser plusieurs Ko.
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
    batch.forEach((o, k) => (cache[`${sl}|${tl}|${o}`] = outputs[k] ?? o));
    process.stdout.write(`\r    ${sl}->${tl} ${i + 1}/${groups.length} lots`);
    // Un long passage (les patchs) ne perd pas tout sur une coupure reseau.
    if (i % 50 === 49) await save();
    await pause(200);
  }
  if (groups.length) process.stdout.write("\n");
}

const tr = (sl, tl) => (t) => (t ? (cache[`${sl}|${tl}|${String(t).trim()}`] ?? t) : t);

/** Textes a traduire d'un jeu : ceux que sa reconstruction demande, dans l'ordre. */
const collect = (rebuild) => (d) => {
  const out = [];
  rebuild(d, (x) => {
    if (x) out.push(x);
    return x;
  });
  return out;
};

// ── Configuration par jeu de donnees ───────────────────────────────
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

/**
 * Patchs detailles : textes des ajustements, nouveaux heros, titres et HTML
 * libre des sections. Restent tels quels : noms de heros et de competences
 * (ceux du jeu, comme sur les fiches), epithetes (elles designent aussi
 * l'illustration), valeurs avant/apres, ancres et liens.
 */
// Le parseur nomme en francais la sous-section implicite des attributs.
const nameSection = (s) => (s.category ? s.name : s.name === "Attributs" ? "Attributes" : s.name);
const patchsRebuild = (d, t) =>
  Object.fromEntries(
    Object.entries(d).map(([version, p]) => [
      version,
      {
        ...p,
        toc: p.toc.map((s) => ({ ...s, title: t(s.title) })),
        sections: p.sections.map((s) => ({ ...s, title: t(s.title), html: translateHtml(s.html, t) })),
        newHeroes: p.newHeroes.map((n) => ({
          ...n,
          lore: n.lore.map(t),
          feature: t(n.feature),
          skills: n.skills.map((c) => ({ ...c, role: t(c.role), description: c.description.map(t) })),
        })),
        adjustments: p.adjustments.map((a) => ({
          ...a,
          intro: t(a.intro),
          sections: a.sections.map((s) => ({
            ...s,
            name: s.category ? s.name : t(nameSection(s)),
            category: t(s.category),
            changes: s.changes.map((c) => ("text" in c ? { ...c, text: t(c.text) } : { ...c, label: t(c.label) })),
          })),
        })),
      },
    ]),
  );

/** Combos : seuls les champs `description` (texte ou liste de textes) se traduisent, ou qu'ils soient. */
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
 * `fichier` : source hors du dossier du jeu (un fichier de synchro qui ne se
 * decoupe pas par langue) ; `extraire` en garde la partie a traduire.
 * `optional` : le jeu est saute tant que sa source n'existe pas.
 */
const GAMES = {
  stories: { source: "fr", texts: storiesTexts, rebuild: storiesRebuild },
  skills: { source: "fr", texts: skillsTexts, rebuild: skillsRebuild },
  modes: { source: "fr", texts: modesTexts, rebuild: modesRebuild },
  items: { source: "en", texts: itemsTexts, rebuild: itemsRebuild },
  "tier-notes": { source: "fr", texts: tierNotesTexts, rebuild: tierNotesRebuild },
  patches: {
    source: "en",
    file: "src/data/game/patches.json",
    extract: (d) => d.details,
    texts: collect(patchsRebuild),
    rebuild: patchsRebuild,
  },
  combos: {
    source: "en",
    file: "src/data/game/combos.json",
    optional: true,
    texts: collect(descriptionsRebuild),
    rebuild: descriptionsRebuild,
  },
};

const requests = process.argv.slice(2);
for (const name of requests) if (!(name in GAMES)) throw new Error(`Jeu inconnu : ${name}`);

for (const [name, cfg] of Object.entries(GAMES)) {
  if (requests.length && !requests.includes(name)) continue;
  const file = cfg.file ?? `src/data/game/${name}/${cfg.source}.json`;
  if (!existsSync(file)) {
    if (cfg.optional) {
      console.log(`${name} : ${file} absent, rien a traduire`);
      continue;
    }
    throw new Error(`Source absente : ${file}`);
  }
  const raw = JSON.parse(await readFile(file, "utf8"));
  const source = cfg.extract ? cfg.extract(raw) : raw;
  const all = cfg.texts(source);
  console.log(`${name} (${cfg.source}) : ${new Set(all.map((x) => String(x).trim())).size} textes uniques`);
  await mkdir(`src/data/game/${name}`, { recursive: true });
  for (const tl of LOCALES.filter((l) => l !== cfg.source)) {
    await prepare(all, cfg.source, tl);
    const t = tr(cfg.source, tl);
    // Seconde passe : un bloc HTML dont la traduction a perdu ses balises
    // retombe sur ses textes un par un, qu'il faut alors traduire aussi.
    const missing = [];
    cfg.rebuild(source, (x) => {
      if (x && !(`${cfg.source}|${tl}|${String(x).trim()}` in cache)) missing.push(x);
      return t(x);
    });
    await prepare(missing, cfg.source, tl);
    const tree = cfg.rebuild(source, t);
    await writeFile(`src/data/game/${name}/${tl}.json`, JSON.stringify(tree, null, 2) + "\n");
    await save();
    console.log(`  ${name}/${tl}.json`);
  }
}
console.log("Donnees traduites.");
