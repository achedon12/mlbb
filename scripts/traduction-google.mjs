/**
 * Appel au traducteur Google, commun a tous les scripts de traduction.
 *
 * Un lot de textes part en une requete. En cas de limite de debit (429), on
 * attend et on reessaie ; si la reponse ne compte pas autant de traductions
 * que de textes, on retombe sur un traitement texte par texte. Un texte seul
 * dont la reponse reste incoherente leve une erreur, plutot que de se
 * relancer sans fin.
 */
const ENDPOINT = "https://clients5.google.com/translate_a/t";
const UA = "Mozilla/5.0 (compatible; MLBBDex/1.0)";

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Traduit un lot de textes de `sl` vers `tl`, dans l'ordre.
 *
 * `tolerant` : dans le repli texte par texte, un texte intraduisible garde sa
 * forme d'origine au lieu d'interrompre tout le lot.
 */
export async function traduireLot(lot, sl, tl, { tolerant = false } = {}) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("client", "dict-chrome-ex");
  url.searchParams.set("sl", sl);
  url.searchParams.set("tl", tl);
  for (const t of lot) url.searchParams.append("q", t);

  for (let essai = 1; essai <= 4; essai += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (rep.ok) {
        const donnees = await rep.json();
        // Un seul texte renvoie ["…"] ; plusieurs renvoient ["…", "…", …].
        const sorties = Array.isArray(donnees) ? donnees.flat(Infinity) : [];
        if (sorties.length === lot.length) return sorties.map(String);
        break;
      }
      if (rep.status === 429) await pause(4000 * essai);
      else throw new Error(`HTTP ${rep.status}`);
    } catch (erreur) {
      if (essai === 4) throw erreur;
      await pause(2000 * essai);
    }
  }

  if (lot.length === 1) throw new Error("Reponse de traduction incoherente");
  // Repli : chaque texte seul, plus lent mais fiable.
  const sorties = [];
  for (const t of lot) {
    try {
      sorties.push((await traduireLot([t], sl, tl))[0] ?? t);
    } catch (erreur) {
      if (!tolerant) throw erreur;
      sorties.push(t);
    }
    await pause(200);
  }
  return sorties;
}
