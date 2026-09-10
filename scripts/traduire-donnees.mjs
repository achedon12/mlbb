/**
 * Traduit les donnees de contenu (histoires, competences, modes) du francais
 * vers l'anglais, l'italien et l'espagnol.
 *
 * Source : `src/data/jeu/<type>/fr.json`. Sorties : `<type>/{en,it,es}.json`.
 * Tout est mis en cache (`scripts/traductions-donnees.json`, clef
 * langue+texte) : une phrase deja traduite ne repart jamais sur le reseau. Ce
 * script ne tourne qu'a la main ou en CI ; l'application ne traduit rien.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const CIBLES = ["en", "it", "es"];
const CACHE = "scripts/traductions-donnees.json";
const ENDPOINT = "https://clients5.google.com/translate_a/t";
const UA = "Mozilla/5.0 (compatible; MLBBDex/1.0)";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

async function traduireLot(lot, tl) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("client", "dict-chrome-ex");
  url.searchParams.set("sl", "fr");
  url.searchParams.set("tl", tl);
  for (const t of lot) url.searchParams.append("q", t);
  for (let essai = 1; essai <= 4; essai += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (rep.ok) {
        const donnees = await rep.json();
        const sorties = Array.isArray(donnees) ? donnees.flat(Infinity) : [];
        if (sorties.length === lot.length) return sorties.map(String);
        break;
      }
      if (rep.status === 429) await pause(4000 * essai);
      else throw new Error(`HTTP ${rep.status}`);
    } catch (e) {
      if (essai === 4) throw e;
      await pause(2000 * essai);
    }
  }
  const out = [];
  for (const t of lot) out.push((await traduireLot([t], tl))[0] ?? t);
  return out;
}

/** Traduit un ensemble de textes vers `tl`, en remplissant le cache. */
async function preparer(textes, tl) {
  const uniques = [...new Set(textes.map((t) => String(t).trim()).filter(Boolean))];
  const manquants = uniques.filter((t) => !(`${tl}|${t}` in cache));
  for (let i = 0; i < manquants.length; i += 10) {
    const lot = manquants.slice(i, i + 10);
    const sorties = await traduireLot(lot, tl);
    lot.forEach((o, k) => (cache[`${tl}|${o}`] = sorties[k] ?? o));
    if (i % 200 === 0) process.stdout.write(`\r    ${tl} ${Math.min(i + 10, manquants.length)}/${manquants.length}`);
    await pause(200);
  }
  process.stdout.write("\n");
}

const tr = (tl) => (t) => (t ? (cache[`${tl}|${String(t).trim()}`] ?? t) : t);
const trListe = (tl) => (liste) => (liste ?? []).map(tr(tl));

// ── Collecte des textes par type ───────────────────────────────────
function textesHistoires(d) {
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
function traduireHistoires(d, tl) {
  const t = tr(tl), tl_ = trListe(tl);
  const sortie = {};
  for (const [slug, h] of Object.entries(d)) {
    const f = h.fiche;
    sortie[slug] = {
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
  return sortie;
}

function textesCompetences(d) {
  const out = [];
  for (const liste of Object.values(d)) for (const c of liste) if (c?.description) out.push(c.description);
  return out;
}
function traduireCompetences(d, tl) {
  const t = tr(tl);
  const sortie = {};
  for (const [slug, liste] of Object.entries(d)) {
    sortie[slug] = liste.map((c) => (c ? { nom: c.nom, description: t(c.description) } : c));
  }
  return sortie;
}

function textesModes(d) {
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
function traduireModes(d, tl) {
  const t = tr(tl);
  return d.map((m) => ({
    ...m,
    description: t(m.description),
    sections: (m.sections ?? []).map((s) => ({
      titre: t(s.titre),
      elements: (s.elements ?? []).map((e) => ({ type: e.type, texte: t(e.texte) })),
    })),
  }));
}

const TYPES = {
  histoires: { textes: textesHistoires, traduire: traduireHistoires },
  competences: { textes: textesCompetences, traduire: traduireCompetences },
  modes: { textes: textesModes, traduire: traduireModes },
};

for (const [type, { textes, traduire }] of Object.entries(TYPES)) {
  const source = JSON.parse(await readFile(`src/data/jeu/${type}/fr.json`, "utf8"));
  const tous = textes(source);
  console.log(`${type} : ${new Set(tous.map((t) => String(t).trim())).size} textes uniques`);
  for (const tl of CIBLES) {
    await preparer(tous, tl);
    await writeFile(`src/data/jeu/${type}/${tl}.json`, JSON.stringify(traduire(source, tl), null, 2) + "\n");
    // Cache sauvegarde apres chaque langue : une interruption ne perd rien.
    await writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");
    console.log(`  ${type}/${tl}.json ecrit`);
  }
}
console.log("Donnees traduites.");
