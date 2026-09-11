/**
 * Traduction d'un fragment HTML du wiki, balisage intact.
 *
 * On traduit par suites de texte (textes et balises en ligne : liens, gras,
 * italique…) plutot que noeud par noeud : une phrase coupee par un lien se
 * traduirait en morceaux sans suite. Les balises en ligne sont remplacees par
 * des marqueurs que le traducteur preserve, puis remises a leur place. Si les
 * marqueurs reviennent incomplets ou dans le desordre, la suite retombe sur une
 * traduction texte par texte : moins fluide, mais le balisage ne peut pas etre
 * casse. Les nombres, les attributs et la structure ne passent jamais par le
 * traducteur.
 */
import { parse } from "node-html-parser";

const PROTEGE = String.fromCharCode(0xe000); // zone privee Unicode : preservee par le traducteur
const MARQUEUR = new RegExp(`${PROTEGE}\\s*(\\d+)\\s*${PROTEGE}`, "g");
const EN_LIGNE = new Set([
  "a", "abbr", "b", "br", "code", "em", "font", "i", "img", "s", "small", "span", "strong", "sub", "sup", "u",
]);
const VIDES = new Set(["br", "img", "hr", "wbr"]);
const TEXTE = 3;
const ELEMENT = 1;

const aTraduire = (texte) => /\p{L}{2,}/u.test(texte);
const echapper = (texte) => texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ouverture = (el) => `<${el.rawTagName}${el.rawAttrs ? ` ${el.rawAttrs}` : ""}>`;
const estVide = (el) => VIDES.has(el.rawTagName.toLowerCase());

function enLigne(noeud) {
  if (noeud.nodeType === TEXTE) return true;
  if (noeud.nodeType !== ELEMENT) return false;
  return EN_LIGNE.has(noeud.rawTagName.toLowerCase()) && noeud.childNodes.every(enLigne);
}

/** Texte d'une suite, balises remplacees par des marqueurs numerotes dans l'ordre. */
function proteger(noeuds) {
  const balises = [];
  const marque = (balise) => `${PROTEGE}${balises.push(balise) - 1}${PROTEGE}`;
  const visiter = (n) => {
    if (n.nodeType === TEXTE) return n.text;
    if (estVide(n)) return marque(ouverture(n));
    return marque(ouverture(n)) + n.childNodes.map(visiter).join("") + marque(`</${n.rawTagName}>`);
  };
  return { sur: noeuds.map(visiter).join(""), balises };
}

/** Remet les balises ; null si les marqueurs ne reviennent pas tous, dans l'ordre. */
function restaurer(traduit, balises) {
  const morceaux = traduit.split(MARQUEUR);
  let html = "";
  let attendu = 0;
  for (let i = 0; i < morceaux.length; i += 1) {
    if (i % 2 === 0) html += echapper(morceaux[i]);
    else if (Number(morceaux[i]) === attendu) html += balises[attendu++];
    else return null;
  }
  return attendu === balises.length && !html.includes(PROTEGE) ? html : null;
}

/** Repli : chaque texte traduit seul, balises d'origine en place. */
function texteParTexte(n, t) {
  if (n.nodeType === TEXTE) {
    const texte = n.text.trim();
    if (!aTraduire(texte)) return n.toString();
    const traduit = t(texte);
    if (!traduit || traduit === texte) return n.toString();
    return n.text.match(/^\s*/)[0] + echapper(traduit) + n.text.match(/\s*$/)[0];
  }
  if (n.nodeType !== ELEMENT || estVide(n)) return n.toString();
  return ouverture(n) + n.childNodes.map((c) => texteParTexte(c, t)).join("") + `</${n.rawTagName}>`;
}

function traduireSuite(suite, t) {
  const brut = suite.map((n) => n.toString()).join("");
  const { sur, balises } = proteger(suite);
  const texte = sur.trim();
  if (!aTraduire(texte.replace(MARQUEUR, " "))) return brut;
  const traduit = t(texte);
  // Pas (encore) de traduction : le HTML d'origine, a l'identique.
  if (!traduit || traduit === texte) return brut;
  const html = restaurer(traduit, balises);
  if (html === null) return suite.map((n) => texteParTexte(n, t)).join("");
  return sur.match(/^\s*/)[0] + html + sur.match(/\s*$/)[0];
}

/** Traduit une suite de noeuds freres : les suites en ligne d'un bloc, les blocs recursivement. */
function traiter(noeuds, t) {
  let html = "";
  let suite = [];
  const vider = () => {
    if (suite.length) html += traduireSuite(suite, t);
    suite = [];
  };
  for (const n of noeuds) {
    if (enLigne(n)) {
      suite.push(n);
      continue;
    }
    vider();
    html += n.nodeType === ELEMENT && !estVide(n)
      ? ouverture(n) + traiter(n.childNodes, t) + `</${n.rawTagName}>`
      : n.toString();
  }
  vider();
  return html;
}

/**
 * Traduit le texte d'un fragment HTML. `t` recoit un texte (marqueurs compris)
 * et rend sa traduction, ou le texte lui-meme s'il n'en a pas : le fragment
 * sort alors inchange. Passer un `t` qui collecte ses entrees donne la liste
 * des textes a traduire.
 */
export function traduireHtml(html, t) {
  if (!html) return html;
  return traiter(parse(html, { comment: true }).childNodes, t);
}
