/**
 * Traduit en francais les descriptions de competences (`competences.json`).
 *
 * On ne traduit que la description — l'effet du sort. Le nom reste dans sa
 * forme officielle du jeu : c'est sous ce nom que les joueurs le connaissent
 * et le recherchent.
 */
import { readFile, writeFile } from "node:fs/promises";
import { creerTraducteur } from "./traduction.mjs";

const FICHIER = "src/data/jeu/competences.json";

const competences = JSON.parse(await readFile(FICHIER, "utf8"));
const t = await creerTraducteur();

// Rassemblement prealable : le traducteur remplit son cache en un bloc.
const tous = [];
for (const liste of Object.values(competences)) {
  for (const comp of liste) {
    if (comp?.description) tous.push(comp.description);
  }
}
console.log(`${tous.length} descriptions (${new Set(tous).size} uniques) a traduire`);
await t.traduire(tous);

const entrees = Object.entries(competences);
for (const [i, [slug, liste]] of entrees.entries()) {
  for (const comp of liste) {
    if (comp?.description) comp.description = await t.traduireUn(comp.description);
  }
  process.stdout.write(`\r  heros ${i + 1}/${entrees.length} (${slug})        `);
}
process.stdout.write("\n");

await t.enregistrer();
await writeFile(FICHIER, JSON.stringify(competences, null, 2) + "\n");
console.log("competences.json traduit en francais.");
