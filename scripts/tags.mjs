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
export function removeTags(text) {
  let previous;
  let current = String(text);
  do {
    previous = current;
    current = unPassage(current);
  } while (current !== previous);
  return current;
}

const OPEN_TAG = /[a-z/!?]/i;

function unPassage(text) {
  let output = "";
  let inTag = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inTag) {
      if (c === ">") inTag = false;
    } else if (c === "<" && OPEN_TAG.test(text[i + 1] ?? "")) {
      inTag = true;
    } else {
      output += c;
    }
  }
  return output;
}
