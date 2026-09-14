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
export async function translateBatch(batch, sl, tl, { tolerant: lenient = false } = {}) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("client", "dict-chrome-ex");
  url.searchParams.set("sl", sl);
  url.searchParams.set("tl", tl);
  for (const t of batch) url.searchParams.append("q", t);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (rep.ok) {
        const data = await rep.json();
        // Un seul texte renvoie ["…"] ; plusieurs renvoient ["…", "…", …].
        const outputs = Array.isArray(data) ? data.flat(Infinity) : [];
        if (outputs.length === batch.length) return outputs.map(String);
        break;
      }
      if (rep.status === 429) await pause(4000 * attempt);
      else throw new Error(`HTTP ${rep.status}`);
    } catch (error) {
      if (attempt === 4) throw error;
      await pause(2000 * attempt);
    }
  }

  if (batch.length === 1) throw new Error("Reponse de traduction incoherente");
  // Repli : chaque texte seul, plus lent mais fiable.
  const outputs = [];
  for (const t of batch) {
    try {
      outputs.push((await translateBatch([t], sl, tl))[0] ?? t);
    } catch (error) {
      if (!lenient) throw error;
      outputs.push(t);
    }
    await pause(200);
  }
  return outputs;
}
