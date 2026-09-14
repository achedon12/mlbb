/**
 * Translation of a wiki HTML fragment, markup intact.
 *
 * Translation works on text runs (texts and inline tags: links, bold,
 * italic…) rather than node by node: a sentence split by a link would
 * translate into disconnected pieces. Inline tags are replaced with
 * markers the translator preserves, then put back in place. If the
 * markers come back incomplete or out of order, the run falls back to
 * text-by-text translation: less fluent, but the markup cannot be
 * broken. Numbers, attributes and structure never go through the
 * translator.
 */
import { parse } from "node-html-parser";

const PROTECTED = String.fromCharCode(0xe000); // Unicode private use area: preserved by the translator
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

/** Text of a run, tags replaced with markers numbered in order. */
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

/** Puts the tags back; null if the markers do not all come back, in order. */
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

/** Fallback: each text translated alone, original tags in place. */
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
  // No translation (yet): the original HTML, unchanged.
  if (!translated || translated === text) return raw;
  const html = restore(translated, tags);
  if (html === null) return run.map((n) => textByText(n, t)).join("");
  return on.match(/^\s*/)[0] + html + on.match(/\s*$/)[0];
}

/** Translates a sequence of sibling nodes: a block's inline runs, blocks recursively. */
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
 * Translates the text of an HTML fragment. `t` receives a text (markers included)
 * and returns its translation, or the text itself if it has none: the fragment
 * then comes out unchanged. Passing a `t` that collects its inputs yields the list
 * of texts to translate.
 */
export function translateHtml(html, t) {
  if (!html) return html;
  return process(parse(html, { comment: true }).childNodes, t);
}
