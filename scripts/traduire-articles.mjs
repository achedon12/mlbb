/**
 * Traduit les articles Markdown du francais vers en/it/es.
 *
 * Source : `content/fr/<section>/*.md`. Sorties : `content/<langue>/…`. On
 * traduit le titre et le chapeau de l'en-tete YAML, et le corps paragraphe par
 * paragraphe (les titres `##`, listes et emphases sont preserves). Le cache est
 * partage avec les autres donnees. Ne tourne qu'a la main ou en CI.
 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { pause, traduireLot } from "./traduction-google.mjs";
import { existsSync } from "node:fs";

const CIBLES = ["en", "it", "es"];
const CACHE = "scripts/traductions-donnees.json";
const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

async function traduireUn(texte, tl) {
  const t = String(texte);
  if (!t.trim()) return t;
  const cle = `fr|${tl}|${t.trim()}`;
  if (!(cle in cache)) {
    const [sortie] = await traduireLot([t.trim()], "fr", tl);
    cache[cle] = sortie ?? t.trim();
    await pause(150);
  }
  return t.replace(t.trim(), cache[cle]);
}

/** Traduit une ligne de corps, en preservant son marqueur Markdown de tete. */
async function traduireLigne(ligne, tl) {
  if (!ligne.trim()) return ligne;
  // Marqueur de tete : #, -, *, >, chiffres de liste — on le garde tel quel.
  const m = ligne.match(/^(\s*(?:#{1,6}\s+|[-*>]\s+|\d+\.\s+)?)([\s\S]*)$/);
  const prefixe = m[1] ?? "";
  const corps = m[2] ?? ligne;
  if (!corps.trim()) return ligne;
  return prefixe + (await traduireUn(corps, tl));
}

async function traduireCorps(corps, tl) {
  const lignes = corps.split("\n");
  const out = [];
  for (const l of lignes) out.push(await traduireLigne(l, tl));
  return out.join("\n");
}

const SECTIONS = ["actualites", "patch-notes"];

for (const tl of CIBLES) {
  for (const section of SECTIONS) {
    const dossier = `content/fr/${section}`;
    if (!existsSync(dossier)) continue;
    await mkdir(`content/${tl}/${section}`, { recursive: true });
    for (const fichier of await readdir(dossier)) {
      if (!fichier.endsWith(".md")) continue;
      const brut = await readFile(`${dossier}/${fichier}`, "utf8");
      const m = brut.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) continue;
      let entete = m[1];
      const corps = m[2];
      // Titre et chapeau de l'en-tete.
      for (const champ of ["title", "summary"]) {
        const re = new RegExp(`^(${champ}:\\s*)(.+)$`, "m");
        const mm = entete.match(re);
        if (mm) {
          const val = mm[2].replace(/^["']|["']$/g, "");
          const trad = (await traduireUn(val, tl)).replace(/"/g, "'");
          entete = entete.replace(re, `$1"${trad}"`);
        }
      }
      const corpsTrad = await traduireCorps(corps, tl);
      await writeFile(`content/${tl}/${section}/${fichier}`, `---\n${entete}\n---\n${corpsTrad}`);
    }
    await writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");
    console.log(`content/${tl}/${section}`);
  }
}
console.log("Articles traduits.");
