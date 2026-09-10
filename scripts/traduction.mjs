/**
 * Traduction en francais des contenus extraits en anglais (histoires des
 * heros, details des modes).
 *
 * Le wiki et l'API communautaire ne publient qu'en anglais. On traduit une
 * seule fois, a la synchronisation, et on met le resultat en cache : une
 * phrase deja traduite ne repart jamais sur le reseau. Le cache est un simple
 * dictionnaire anglais → francais, versionne avec le depot.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pause, traduireLot as traduireLotGoogle } from "./traduction-google.mjs";
import { existsSync } from "node:fs";

const CACHE = "scripts/traductions.json";


/** Un lot d'au plus dix textes, borne aussi par la longueur totale de l'URL. */
function lots(textes) {
  const groupes = [];
  let courant = [];
  let taille = 0;
  for (const t of textes) {
    if (courant.length >= 10 || taille + t.length > 3500) {
      if (courant.length) groupes.push(courant);
      courant = [];
      taille = 0;
    }
    courant.push(t);
    taille += t.length;
  }
  if (courant.length) groupes.push(courant);
  return groupes;
}

const traduireLot = (lot) => traduireLotGoogle(lot, "en", "fr", { tolerant: true });

/**
 * Traducteur a cache. On l'instancie une fois, on lui demande de traduire
 * autant de textes que voulu, puis on enregistre le cache a la fin.
 */
export async function creerTraducteur() {
  const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};

  /** Traduit une liste de textes ; renvoie une Map original → francais. */
  async function traduire(textes) {
    const uniques = [...new Set(textes.map((t) => String(t).trim()).filter(Boolean))];
    const manquants = uniques.filter((t) => !(t in cache));

    const groupes = lots(manquants);
    for (const [i, groupe] of groupes.entries()) {
      const sorties = await traduireLot(groupe);
      groupe.forEach((original, k) => {
        cache[original] = sorties[k] ?? original;
      });
      process.stdout.write(`\r    traduction ${i + 1}/${groupes.length} lots`);
      await pause(250);
    }
    if (groupes.length) process.stdout.write("\n");

    return new Map(uniques.map((t) => [t, cache[t] ?? t]));
  }

  /** Traduit une chaine unique (ou renvoie null pour une entree vide). */
  async function traduireUn(texte) {
    if (!texte) return null;
    const m = await traduire([texte]);
    return m.get(String(texte).trim()) ?? texte;
  }

  /** Traduit un tableau de chaines, dans l'ordre. */
  async function traduireListe(liste) {
    if (!liste?.length) return [];
    const m = await traduire(liste);
    return liste.map((t) => m.get(String(t).trim()) ?? t);
  }

  async function enregistrer() {
    // Cache trie par clef : les diffs restent lisibles d'une synchro a l'autre.
    const trie = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
    await writeFile(CACHE, JSON.stringify(trie, null, 2) + "\n");
  }

  return { traduire, traduireUn, traduireListe, enregistrer };
}
