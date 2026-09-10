/**
 * Traduit en francais le fichier `histoires.json` deja genere.
 *
 * A lancer apres `npm run sync` (qui produit les histoires en anglais). Le
 * genre est deja normalise en francais a l'extraction ; tout le reste — recit,
 * accroche, fiche, anecdotes — passe par le traducteur a cache.
 */
import { readFile, writeFile } from "node:fs/promises";
import { creerTraducteur } from "./traduction.mjs";

const FICHIER = "src/data/genere/histoires.json";

const histoires = JSON.parse(await readFile(FICHIER, "utf8"));
const t = await creerTraducteur();

// On rassemble d'abord tous les textes, pour que le cache et les lots
// travaillent sur l'ensemble d'un coup.
const tous = [];
for (const h of Object.values(histoires)) {
  if (h.accroche) tous.push(h.accroche);
  tous.push(...h.lore, ...h.anecdotes);
  if (h.fiche) {
    for (const cle of ["titre", "espece", "age", "origine"]) {
      if (h.fiche[cle]) tous.push(h.fiche[cle]);
    }
    tous.push(...h.fiche.affiliations, ...h.fiche.relations, ...h.fiche.pouvoirs);
  }
}
console.log(`${tous.length} textes (${new Set(tous).size} uniques) a traduire`);
await t.traduire(tous);

const fr = (v) => (v ? t.traduireUn(v) : Promise.resolve(v));

const entrees = Object.entries(histoires);
for (const [i, [slug, h]] of entrees.entries()) {
  h.accroche = await fr(h.accroche);
  h.lore = await t.traduireListe(h.lore);
  h.anecdotes = await t.traduireListe(h.anecdotes);
  if (h.fiche) {
    h.fiche.titre = await fr(h.fiche.titre);
    h.fiche.espece = await fr(h.fiche.espece);
    h.fiche.age = await fr(h.fiche.age);
    h.fiche.origine = await fr(h.fiche.origine);
    h.fiche.affiliations = await t.traduireListe(h.fiche.affiliations);
    h.fiche.relations = await t.traduireListe(h.fiche.relations);
    h.fiche.pouvoirs = await t.traduireListe(h.fiche.pouvoirs);
  }
  process.stdout.write(`\r  heros ${i + 1}/${entrees.length} (${slug})        `);
}
process.stdout.write("\n");

await t.enregistrer();
await writeFile(FICHIER, JSON.stringify(histoires, null, 2) + "\n");
console.log("histoires.json traduit en francais.");
