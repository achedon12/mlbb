/**
 * Traduit en francais le fichier `modes.json` (description et sections
 * detaillees des modes de jeu). L'accroche editoriale de la page reste ecrite
 * a la main ; ici on traduit le contenu repris du wiki.
 */
import { readFile, writeFile } from "node:fs/promises";
import { creerTraducteur } from "./traduction.mjs";

const FICHIER = "src/data/genere/modes.json";

const modes = JSON.parse(await readFile(FICHIER, "utf8"));
const t = await creerTraducteur();

// Rassemblement prealable de tous les textes.
const tous = [];
for (const m of modes) {
  if (m.description) tous.push(m.description);
  for (const s of m.sections ?? []) {
    tous.push(s.titre);
    for (const e of s.elements) tous.push(e.texte);
  }
}
console.log(`${tous.length} textes (${new Set(tous).size} uniques) a traduire`);
await t.traduire(tous);

for (const m of modes) {
  if (m.description) m.description = await t.traduireUn(m.description);
  for (const s of m.sections ?? []) {
    s.titre = await t.traduireUn(s.titre);
    for (const e of s.elements) e.texte = await t.traduireUn(e.texte);
  }
  process.stdout.write(`\r  ${m.slug}        `);
}
process.stdout.write("\n");

await t.enregistrer();
await writeFile(FICHIER, JSON.stringify(modes, null, 2) + "\n");
console.log("modes.json traduit en francais.");
