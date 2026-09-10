/**
 * Traduit les donnees de contenu vers les autres langues.
 *
 * Chaque jeu de donnees a une langue source (le francais pour ce qui est
 * extrait du wiki puis traduit, l'anglais pour les objets bruts) ; on en derive
 * les trois autres langues. Tout est mis en cache
 * (`scripts/traductions-donnees.json`, clef source+cible+texte) : une phrase
 * deja traduite ne repart jamais sur le reseau. Ce script ne tourne qu'a la
 * main ou en CI ; l'application ne traduit rien.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pause, traduireLot } from "./traduction-google.mjs";
import { existsSync } from "node:fs";

const LANGUES = ["en", "fr", "it", "es"];
const CACHE = "scripts/traductions-donnees.json";

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};


async function preparer(textes, sl, tl) {
  const uniques = [...new Set(textes.map((t) => String(t).trim()).filter(Boolean))];
  const manquants = uniques.filter((t) => !(`${sl}|${tl}|${t}` in cache));
  for (let i = 0; i < manquants.length; i += 10) {
    const lot = manquants.slice(i, i + 10);
    const sorties = await traduireLot(lot, sl, tl);
    lot.forEach((o, k) => (cache[`${sl}|${tl}|${o}`] = sorties[k] ?? o));
    if (i % 200 === 0) process.stdout.write(`\r    ${sl}->${tl} ${Math.min(i + 10, manquants.length)}/${manquants.length}`);
    await pause(200);
  }
  if (manquants.length) process.stdout.write("\n");
}

const tr = (sl, tl) => (t) => (t ? (cache[`${sl}|${tl}|${String(t).trim()}`] ?? t) : t);
const trL = (sl, tl) => (liste) => (liste ?? []).map(tr(sl, tl));

// ── Configuration par jeu de donnees ───────────────────────────────
function histoiresTextes(d) {
  const out = [];
  for (const h of Object.values(d)) {
    if (h.accroche) out.push(h.accroche);
    out.push(...(h.lore ?? []), ...(h.anecdotes ?? []));
    if (h.fiche) {
      for (const c of ["titre", "espece", "genre", "age", "origine"]) if (h.fiche[c]) out.push(h.fiche[c]);
      out.push(...(h.fiche.affiliations ?? []), ...(h.fiche.relations ?? []), ...(h.fiche.pouvoirs ?? []));
    }
  }
  return out;
}
function histoiresRebuild(d, t, tl_) {
  const o = {};
  for (const [slug, h] of Object.entries(d)) {
    const f = h.fiche;
    o[slug] = {
      accroche: t(h.accroche),
      lore: tl_(h.lore),
      anecdotes: tl_(h.anecdotes),
      fiche: f
        ? {
            nomComplet: f.nomComplet,
            titre: t(f.titre),
            espece: t(f.espece),
            genre: t(f.genre),
            age: t(f.age),
            origine: t(f.origine),
            anniversaire: f.anniversaire,
            affiliations: tl_(f.affiliations),
            relations: tl_(f.relations),
            pouvoirs: tl_(f.pouvoirs),
          }
        : null,
    };
  }
  return o;
}

function competencesTextes(d) {
  const out = [];
  for (const l of Object.values(d)) for (const c of l) if (c?.description) out.push(c.description);
  return out;
}
const competencesRebuild = (d, t) =>
  Object.fromEntries(
    Object.entries(d).map(([s, l]) => [s, l.map((c) => (c ? { nom: c.nom, description: t(c.description) } : c))]),
  );

function modesTextes(d) {
  const out = [];
  for (const m of d) {
    if (m.description) out.push(m.description);
    for (const s of m.sections ?? []) {
      out.push(s.titre);
      for (const e of s.elements ?? []) out.push(e.texte);
    }
  }
  return out;
}
const modesRebuild = (d, t) =>
  d.map((m) => ({
    ...m,
    description: t(m.description),
    sections: (m.sections ?? []).map((s) => ({
      titre: t(s.titre),
      elements: (s.elements ?? []).map((e) => ({ type: e.type, texte: t(e.texte) })),
    })),
  }));

const CHAMPS_OBJET = ["resume", "bonus", "unique", "passif", "actif", "pourQui"];
function objetsTextes(d) {
  const out = [];
  for (const o of d) for (const c of CHAMPS_OBJET) if (o[c]) out.push(o[c]);
  return out;
}
const objetsRebuild = (d, t) =>
  d.map((o) => ({ ...o, ...Object.fromEntries(CHAMPS_OBJET.map((c) => [c, o[c] ? t(o[c]) : o[c]])) }));

const tierNotesTextes = (d) => Object.values(d);
const tierNotesRebuild = (d, t) => Object.fromEntries(Object.entries(d).map(([s, v]) => [s, t(v)]));

const JEUX = {
  histoires: { source: "fr", textes: histoiresTextes, rebuild: histoiresRebuild, liste: true },
  competences: { source: "fr", textes: competencesTextes, rebuild: competencesRebuild },
  modes: { source: "fr", textes: modesTextes, rebuild: modesRebuild },
  objets: { source: "en", textes: objetsTextes, rebuild: objetsRebuild },
  "tier-notes": { source: "fr", textes: tierNotesTextes, rebuild: tierNotesRebuild },
};

for (const [nom, cfg] of Object.entries(JEUX)) {
  const source = JSON.parse(await readFile(`src/data/jeu/${nom}/${cfg.source}.json`, "utf8"));
  const tous = cfg.textes(source);
  console.log(`${nom} (${cfg.source}) : ${new Set(tous.map((x) => String(x).trim())).size} textes uniques`);
  for (const tl of LANGUES.filter((l) => l !== cfg.source)) {
    await preparer(tous, cfg.source, tl);
    const t = tr(cfg.source, tl);
    const arbre = cfg.liste
      ? cfg.rebuild(source, t, trL(cfg.source, tl))
      : cfg.rebuild(source, t);
    await writeFile(`src/data/jeu/${nom}/${tl}.json`, JSON.stringify(arbre, null, 2) + "\n");
    await writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");
    console.log(`  ${nom}/${tl}.json`);
  }
}
console.log("Donnees traduites.");
