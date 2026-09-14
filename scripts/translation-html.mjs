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

const PROTECTED = String.fromCharCode(0xe000); // zone privee Unicode : preservee par le traducteur
const MARKER = new RegExp(`${PROTECTED}\\s*(\\d+)\\s*${PROTECTED}`, "g");
const ONLINE = new Set([
  "a", "abbr", "b", "br", "code", "em", "font", "i", "img", "s", "small", "span", "strong", "sub", "sup", "u",
]);
const EMPTY = new Set(["br", "img", "hr", "wbr"]);
const TEXT = 3;
const ELEMENT = 1;

const toTranslate = (text) => /\p{L}{2,}/u.test(text);
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const opening = (el) => `<${el.rawTagName}${el.rawAttrs ? ` ${el.rawAttrs}` : ""}>`;
const isEmpty = (el) => EMPTY.has(el.rawTagName.toLowerCase());

function online(node) {
  if (node.nodeType === TEXT) return true;
  if (node.nodeType !== ELEMENT) return false;
  return ONLINE.has(node.rawTagName.toLowerCase()) && node.childNodes.every(online);
}

/** Texte d'une suite, balises remplacees par des marqueurs numerotes dans l'ordre. */
function protect(nodes) {
  const tags = [];
  const mark = (tag) => `${PROTECTED}${tags.push(tag) - 1}${PROTECTED}`;
  const visit = (n) => {
    if (n.nodeType === TEXT) return n.text;
    if (isEmpty(n)) return mark(opening(n));
    return mark(opening(n)) + n.childNodes.map(visit).join("") + mark(`</${n.rawTagName}>`);
  };
  return { on: nodes.map(visit).join(""), tags };
}

/** Remet les balises ; null si les marqueurs ne reviennent pas tous, dans l'ordre. */
function restore(translated, tags) {
  const chunks = translated.split(MARKER);
  let html = "";
  let expected = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    if (i % 2 === 0) html += escape(chunks[i]);
    else if (Number(chunks[i]) === expected) html += tags[expected++];
    else return null;
  }
  return expected === tags.length && !html.includes(PROTECTED) ? html : null;
}

/** Repli : chaque texte traduit seul, balises d'origine en place. */
function textByText(n, t) {
  if (n.nodeType === TEXT) {
    const text = n.text.trim();
    if (!toTranslate(text)) return n.toString();
    const translated = t(text);
    if (!translated || translated === text) return n.toString();
    return n.text.match(/^\s*/)[0] + escape(translated) + n.text.match(/\s*$/)[0];
  }
  if (n.nodeType !== ELEMENT || isEmpty(n)) return n.toString();
  return opening(n) + n.childNodes.map((c) => textByText(c, t)).join("") + `</${n.rawTagName}>`;
}

function translateRun(run, t) {
  const raw = run.map((n) => n.toString()).join("");
  const { on, tags } = protect(run);
  const text = on.trim();
  if (!toTranslate(text.replace(MARKER, " "))) return raw;
  const translated = t(text);
  // Pas (encore) de traduction : le HTML d'origine, a l'identique.
  if (!translated || translated === text) return raw;
  const html = restore(translated, tags);
  if (html === null) return run.map((n) => textByText(n, t)).join("");
  return on.match(/^\s*/)[0] + html + on.match(/\s*$/)[0];
}

/** Traduit une suite de noeuds freres : les suites en ligne d'un bloc, les blocs recursivement. */
function process(nodes, t) {
  let html = "";
  let run = [];
  const clear = () => {
    if (run.length) html += translateRun(run, t);
    run = [];
  };
  for (const n of nodes) {
    if (online(n)) {
      run.push(n);
      continue;
    }
    clear();
    html += n.nodeType === ELEMENT && !isEmpty(n)
      ? opening(n) + process(n.childNodes, t) + `</${n.rawTagName}>`
      : n.toString();
  }
  clear();
  return html;
}

/**
 * Traduit le texte d'un fragment HTML. `t` recoit un texte (marqueurs compris)
 * et rend sa traduction, ou le texte lui-meme s'il n'en a pas : le fragment
 * sort alors inchange. Passer un `t` qui collecte ses entrees donne la liste
 * des textes a traduire.
 */
export function translateHtml(html, t) {
  if (!html) return html;
  return process(parse(html, { comment: true }).childNodes, t);
}
