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
import { existsSync } from "node:fs";

const ENDPOINT = "https://clients5.google.com/translate_a/t";
const UA = "Mozilla/5.0 (compatible; MLBBDex/1.0)";
const CACHE = "scripts/traductions.json";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function traduireLot(lot) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("client", "dict-chrome-ex");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "fr");
  for (const t of lot) url.searchParams.append("q", t);

  for (let essai = 1; essai <= 4; essai += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (rep.ok) {
        const donnees = await rep.json();
        // Un seul texte renvoie ["fr"] ; plusieurs renvoient ["fr", "fr", …].
        const sorties = Array.isArray(donnees) ? donnees.flat(Infinity) : [];
        if (sorties.length === lot.length) return sorties.map(String);
        // Longueur inattendue : on retombe sur un traitement un par un.
        break;
      }
      if (rep.status === 429) await pause(4000 * essai);
      else throw new Error(`HTTP ${rep.status}`);
    } catch (erreur) {
      if (essai === 4) throw erreur;
      await pause(2000 * essai);
    }
  }
  // Repli : chaque texte seul, plus lent mais fiable.
  const sorties = [];
  for (const t of lot) {
    const [seul] = await traduireLot([t]).catch(() => [t]);
    sorties.push(seul ?? t);
    await pause(200);
  }
  return sorties;
}

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
