/**
 * Texte brut d'une chaine qui peut porter du HTML : legendes du wiki,
 * descriptions de l'API des mesures.
 *
 * Un remplacement par expression reguliere en un seul passage laisserait se
 * reformer une balise imbriquee (« <scr<b>ipt> » redonne « <script> »). Ici,
 * un parcours caractere par caractere retire chaque balise, et recommence
 * jusqu'a ce que rien ne bouge : aucun « < » suivi d'une lettre, de « / », de
 * « ! » ou de « ? » ne sort jamais. Un chevron de texte (« PV < 30 % ») reste.
 */
export function retirerBalises(texte) {
  let precedent;
  let courant = String(texte);
  do {
    precedent = courant;
    courant = unPassage(courant);
  } while (courant !== precedent);
  return courant;
}

const OUVRE_BALISE = /[a-z/!?]/i;

function unPassage(texte) {
  let sortie = "";
  let dansBalise = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansBalise) {
      if (c === ">") dansBalise = false;
    } else if (c === "<" && OUVRE_BALISE.test(texte[i + 1] ?? "")) {
      dansBalise = true;
    } else {
      sortie += c;
    }
  }
  return sortie;
}
