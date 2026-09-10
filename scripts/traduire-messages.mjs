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

const SOURCE = "src/i18n/messages/fr.json";
const CIBLES = ["en", "it", "es"];
const ENDPOINT = "https://clients5.google.com/translate_a/t";
const UA = "Mozilla/5.0 (compatible; MLBBDex/1.0)";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const PROTEGE = String.fromCharCode(0xE000); // zone privee Unicode : preservee par le traducteur

/** Remplace les `{var}` par des marqueurs surs, renvoie le texte et la table. */
function proteger(texte) {
  const vars = [];
  const sur = texte.replace(/\{\w+\}/g, (m) => {
    vars.push(m);
    return `${PROTEGE}${vars.length - 1}${PROTEGE}`;
  });
  return { sur, vars };
}

function restaurer(texte, vars) {
  return texte.replace(new RegExp(`${PROTEGE}(\\d+)${PROTEGE}`, "g"), (_, i) => vars[Number(i)] ?? "");
}

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
  // Repli un par un
  const out = [];
  for (const t of lot) out.push((await traduireLot([t], tl))[0] ?? t);
  return out;
}

/** Applique une fonction async a chaque feuille (string) de l'arbre. */
async function mapArbre(arbre, fn) {
  if (typeof arbre === "string") return fn(arbre);
  const sortie = Array.isArray(arbre) ? [] : {};
  for (const [cle, val] of Object.entries(arbre)) sortie[cle] = await mapArbre(val, fn);
  return sortie;
}

const source = JSON.parse(await readFile(SOURCE, "utf8"));

for (const tl of CIBLES) {
  // On collecte toutes les feuilles, on protege, on traduit par lots, on remet.
  const feuilles = [];
  await mapArbre(source, (s) => {
    feuilles.push(s);
    return s;
  });
  const uniques = [...new Set(feuilles)];
  const proteges = uniques.map(proteger);
  const cache = new Map();
  for (let i = 0; i < proteges.length; i += 8) {
    const lot = proteges.slice(i, i + 8);
    const traduits = await traduireLot(lot.map((p) => p.sur), tl);
    lot.forEach((p, k) => cache.set(uniques[i + k], restaurer(traduits[k], p.vars)));
    await pause(200);
  }
  const arbre = await mapArbre(source, (s) => cache.get(s) ?? s);
  await writeFile(`src/i18n/messages/${tl}.json`, JSON.stringify(arbre, null, 2) + "\n");
  console.log(`${tl}.json : ${uniques.length} messages`);
}
console.log("Catalogues traduits.");
