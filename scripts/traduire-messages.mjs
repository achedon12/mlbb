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
import { pause, traduireLot as traduireLotGoogle } from "./traduction-google.mjs";
import { existsSync } from "node:fs";

const SOURCE = "src/i18n/messages/fr.json";
const CIBLES = ["en", "it", "es"];

const CACHE = "scripts/traductions-messages.json";
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const PROTEGE = String.fromCharCode(0xE000); // zone privee Unicode : preservee par le traducteur

/** Remplace les `{var}` par des marqueurs surs, renvoie le texte et la table. */
function proteger(texte) {
  const vars = [];
  // On met a l'abri : variables {x}, code `x`, et l'URL d'un lien (…). Le
  // libelle d'un lien [texte] reste, lui, traduit.
  const sur = texte.replace(/\{\w+\}|`[^`]+`|\]\([^)]+\)/g, (m) => {
    vars.push(m);
    return `${PROTEGE}${vars.length - 1}${PROTEGE}`;
  });
  return { sur, vars };
}

function restaurer(texte, vars) {
  return texte.replace(new RegExp(`${PROTEGE}(\\d+)${PROTEGE}`, "g"), (_, i) => vars[Number(i)] ?? "");
}

const traduireLot = (lot, tl) => traduireLotGoogle(lot, "fr", tl);

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
  const manquants = uniques.filter((u) => !(`${tl}|${u}` in cache));
  const proteges = manquants.map(proteger);
  for (let i = 0; i < proteges.length; i += 8) {
    const lot = proteges.slice(i, i + 8);
    const traduits = await traduireLot(lot.map((p) => p.sur), tl);
    lot.forEach((p, k) => (cache[`${tl}|${manquants[i + k]}`] = restaurer(traduits[k], p.vars)));
    await pause(200);
  }
  const arbre = await mapArbre(source, (s) => cache[`${tl}|${s}`] ?? s);
  await writeFile(`src/i18n/messages/${tl}.json`, JSON.stringify(arbre, null, 2) + "\n");
  await writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");
  console.log(`${tl}.json : ${uniques.length} messages (${manquants.length} nouveaux)`);
}
console.log("Catalogues traduits.");
