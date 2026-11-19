/**
 * Converts wikitext into readable text.
 *
 * Skill descriptions mix internal links, formatting templates and scaling
 * annotations (`{{scale|...}}`) that only make sense on the wiki. We keep the
 * sentence and drop the display machinery.
 */
/**
 * Strips every HTML tag, until stable.
 *
 * A single pass would let nested tags through — stripping `<a<b>c>` can
 * recreate a valid tag. So we repeat while the string changes, so that no
 * `<...>` remains.
 */
export function withoutTags(text) {
  let output = String(text);
  let before;
  do {
    before = output;
    output = output.replace(/<[^>]*>/g, "");
  } while (output !== before);
  return output;
}

export function cleanDescription(raw) {
  const withoutHtml = withoutTags(
    String(raw)
      // Scaling annotations: they describe a formula, not an effect.
      .replace(/\{\{scale\|[^}]*\}\}/gi, "")
      .replace(/<nowiki>([\s\S]*?)<\/nowiki>/g, "$1")
      .replace(/<br\s*\/?>/gi, " "),
  );
  return (
    decodeEntities(expandTemplates(plainLinks(withoutTables(withoutHtml))))
      // Wikitext italics and bold.
      .replace(/'{2,}/g, "")
      // Behaviour switches (`__NOTOC__`) display nothing.
      .replace(/__[A-Z]+__/g, "")
      // A heading left inside a flat text keeps its words, not its markers.
      .replace(/={2,}\s*([^=]*?)\s*={2,}/g, "$1")
      .replace(/\s+/g, " ")
      // Removing annotations leaves a space before the percent sign.
      .replace(/\s+%/g, "%")
      .replace(/\s+([.,;:])/g, "$1")
      .trim()
  );
}

/** Named and numeric HTML entities the wiki writes in its text. */
const ENTITIES = {
  nbsp: " ", ndash: "–", mdash: "—", hellip: "…", quot: '"', apos: "'", lt: "<", gt: ">",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", sect: "§",
  times: "×", deg: "°", middot: "·", bull: "•", eacute: "é", egrave: "è", approx: "≈",
};

/** Turns entities into characters; `&amp;` last, so `&amp;lt;` stays the text "&lt;". */
export function decodeEntities(text) {
  return String(text)
    .replace(/&#(\d+);/g, (m, n) => safeCodePoint(Number(n)) ?? m)
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => safeCodePoint(parseInt(n, 16)) ?? m)
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/&amp;/g, "&");
}

function safeCodePoint(n) {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : null;
}

/**
 * Internal links become their label, innermost first: `[[Target|Label]]`
 * gives "Label", `[[Target#Section]]` gives "Target". Category, file and
 * interlanguage links display nothing in the text, so they are dropped. A
 * bracket pair left unmatched by a broken edit on the wiki goes too.
 */
export function plainLinks(text) {
  let output = String(text);
  let before;
  do {
    before = output;
    output = output.replace(/\[\[([^[\]]*)\]\]/g, (_, inner) => {
      const [target, ...labels] = inner.split("|");
      const page = target.trim();
      if (/^:?(?:Category|File|Image|Media):/i.test(page) || /^[a-z]{2,3}(?:-[a-z]+)?:/.test(page)) return "";
      const label = labels.length ? labels.at(-1).trim() : "";
      if (label) return label;
      return page.replace(/^:/, "").split("#")[0].trim() || page.split("#").pop().trim();
    });
  } while (output !== before);
  return output
    // External links: keep the label, drop the URL.
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/\[\[|\]\]/g, "");
}

/** Templates that only lay out or annotate the page: they show no text. */
const SILENT_TEMPLATES = new Set([
  "clr", "clear", "cite", "cite web", "retcon", "translation", "main", "see also", "scale",
  "reflist", "toc", "notoc", "stub", "spoiler", "anchor", "-",
]);

/**
 * The text a template shows in place, by convention.
 *
 * - `{{b|Locked On|mark}}`, `{{hi|Alpha|Alpha}}`: the first unnamed argument.
 * - `{{ai|name=Basic Attack|Basic Attacks}}`: an unnamed argument wins over
 *   the `name=` one, which only picks the icon.
 * - `{{Hi|name=Lunox|image=Lunox}}`: no unnamed argument, so the `name`
 *   (or `text`, `label`) parameter. Other parameters (`image=`, `size=`)
 *   never reach the text.
 * - `{{icon|a|Contract Soul Steal|Soul Steal}}`: icon templates put the label
 *   last.
 * - A template laid out on several lines (`{{Infobox character\n| name = …`)
 *   is a data block, not a word: it shows nothing.
 */
function renderTemplate(body) {
  if (/\n\s*\|/.test(body)) return "";
  const parts = body.split("|");
  const name = parts[0].trim().toLowerCase().replace(/_/g, " ");
  // Parser functions (`{{#if:…}}`) and magic words (`{{PAGENAME}}`) only
  // make sense on the wiki.
  const magic = parts.length === 1 && /^[A-Z]{3,}$/.test(parts[0].trim());
  if (!name || SILENT_TEMPLATES.has(name) || name.startsWith("#") || magic) return "";
  const positional = [];
  const named = {};
  for (const part of parts.slice(1)) {
    const m = part.match(/^\s*([a-z][\w -]*?)\s*=([\s\S]*)$/i);
    if (m) named[m[1].toLowerCase()] = m[2].trim();
    else if (part.trim()) positional.push(part.trim());
  }
  if (name === "icon" && positional.length) return positional.at(-1);
  if (positional.length) return positional[0];
  return named.name ?? named.text ?? named.label ?? named.title ?? named["1"] ?? "";
}

/** Expands every `{{…}}`, innermost first, so a nested template is resolved before its parent splits on pipes. */
export function expandTemplates(text) {
  let output = String(text);
  let before;
  do {
    before = output;
    output = output.replace(/\{\{([^{}]*)\}\}/g, (_, body) => renderTemplate(body));
  } while (output !== before);
  // An unbalanced brace pair from a broken edit carries no text either.
  return output.replace(/\{\{|\}\}/g, "");
}

/**
 * A short field taken from a wiki module (a release date, a resource, a skin's
 * acquisition note), as plain text: `[[Patch Notes/1.6.66|22 March 2022]]`
 * gives "22 March 2022".
 */
export function plainValue(value) {
  if (value === null || value === undefined) return null;
  const text = cleanDescription(String(value));
  return text || null;
}

// ─────────────────────────────────────────────────────────────
// Hero story: lore, story sheet, trivia
// ─────────────────────────────────────────────────────────────

// The story is kept in English, the wiki's language: the translation step
// derives every other language from it.
const MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Strips what only makes sense on the wiki: references (often long blocks
 * with galleries), annotation templates and layout markers. The rest of the
 * cleanup is left to the caller.
 */
function withoutCruft(raw) {
  return removeLinksFile(String(raw))
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<gallery[^>]*>[\s\S]*?<\/gallery>/gi, "")
    .replace(/\{\{(?:clr|cite|retcon|translation|main|see also)\b[^}]*\}\}/gi, "")
    // External links: keep the label, drop the URL.
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/&sect;/g, "§")
    .replace(/&mdash;/g, "—");
}

const EXTENSIONS_IMAGE = /\.(?:png|jpe?g|gif|svg|webp)$/i;

/**
 * Strips image links by counting brackets: their caption may contain nested
 * links that a simple regular expression would cut in the wrong place. The
 * wiki writes them two ways — prefixed (`[[File:...]]`, `[[Image:...]]`) or
 * as a bare file name (`[[Layla lore.png|center|512px]]`) — recognised here
 * by their extension.
 */
function removeLinksFile(text) {
  const re = /\[\[/g;
  let output = text;
  let m;
  while ((m = re.exec(output)) !== null) {
    const start = m.index;
    let depth = 0;
    let k = start;
    for (; k < output.length; k += 1) {
      if (output[k] === "[" && output[k + 1] === "[") { depth += 1; k += 1; }
      else if (output[k] === "]" && output[k + 1] === "]") {
        depth -= 1;
        k += 1;
        if (depth === 0) { k += 1; break; }
      }
    }
    const target = output.slice(start + 2, k - 2).split("|")[0].trim();
    if (/^(?:File|Image):/i.test(target) || EXTENSIONS_IMAGE.test(target)) {
      output = output.slice(0, start) + output.slice(k);
      re.lastIndex = start;
    } else {
      re.lastIndex = start + 2;
    }
  }
  return output;
}

/**
 * Removes every template laid out on several lines, one `| field = value`
 * per line (`{{Infobox hero story`, `{{Infobox character`): a data block, not
 * prose. Braces are counted, so nested templates go with their parent. It runs
 * before the text is cut into lines, which would split such a block apart and
 * leave its fields (`| name = Detona`) as sentences.
 */
function removeBlockTemplates(text) {
  let output = String(text);
  let from = 0;
  for (;;) {
    const start = output.indexOf("{{", from);
    if (start === -1) return output;
    let depth = 0;
    let end = -1;
    for (let k = start; k < output.length; k += 1) {
      if (output[k] === "{" && output[k + 1] === "{") { depth += 1; k += 1; }
      else if (output[k] === "}" && output[k + 1] === "}") {
        depth -= 1;
        k += 1;
        if (depth === 0) { end = k + 1; break; }
      }
    }
    if (end === -1) return output;
    if (/\n\s*\|/.test(output.slice(start, end))) output = output.slice(0, start) + output.slice(end);
    else from = start + 2;
  }
}

/** A heading line, `=== Duke of Shards ===`, with or without spaces. */
const HEADING = /^\s*={2,6}\s*(.*?)\s*=+\s*$/;

/**
 * A hero's lore as a sequence of blocks: paragraphs (`p`) and the headings
 * (`h`) the wiki puts between chapters ("Duke of Shards", "Fate Deniers").
 *
 * The text is read line by line. A blank line ends a paragraph; a heading line
 * ends it too and becomes a block of its own, so its `===` markers never end
 * up in the middle of a sentence. Every block is cleaned like a description.
 */
export function loreBlocks(raw) {
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    const text = cleanDescription(paragraph.join("\n"));
    if (text && text.length > 1) blocks.push({ type: "p", text });
    paragraph = [];
  };
  for (const line of removeBlockTemplates(withoutCruft(raw)).split("\n")) {
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      const text = cleanDescription(heading[1]);
      if (text) blocks.push({ type: "h", text });
    } else if (!line.trim()) {
      flush();
    } else {
      // A list or indent marker opening a line is layout, not text.
      paragraph.push(line.replace(/^\s*[*#:]+\s*/, ""));
    }
  }
  flush();
  // A heading followed by nothing to read is dropped, as is the first of two
  // headings in a row: neither introduces any text.
  return blocks.filter((b, i) => b.type === "p" || blocks[i + 1]?.type === "p");
}

/**
 * A hero's lore, rendered as readable paragraphs (headings left out).
 *
 * Paragraph breaks survive the process, where `cleanDescription` alone would
 * flatten everything onto one line.
 */
export function cleanLore(raw) {
  return loreBlocks(raw).filter((b) => b.type === "p").map((b) => b.text);
}

/**
 * Extracts the body of a `{{Name ...}}` template by counting braces, the only
 * reliable way when the template nests others.
 */
function bodyTemplate(wikitext, name) {
  const re = new RegExp(`\\{\\{${name}\\b`, "i");
  const m = re.exec(wikitext);
  if (!m) return null;

  const start = m.index;
  let depth = 0;
  for (let k = start; k < wikitext.length; k += 1) {
    if (wikitext[k] === "{" && wikitext[k + 1] === "{") {
      depth += 1;
      k += 1;
    } else if (wikitext[k] === "}" && wikitext[k + 1] === "}") {
      depth -= 1;
      k += 1;
      if (depth === 0) return wikitext.slice(start + 2, k - 1);
    }
  }
  return null;
}

/**
 * Splits a template body into `name = value` fields. The split happens on
 * top-level pipes: a pipe inside a nested template or a link belongs to the
 * value, not to the structure.
 */
function fieldsTemplate(body) {
  const fields = {};
  let depth = 0;
  let brackets = 0;
  let start = 0;
  const chunks = [];
  for (let k = 0; k < body.length; k += 1) {
    const a = body[k];
    const b = body[k + 1];
    if (a === "{" && b === "{") { depth += 1; k += 1; }
    else if (a === "}" && b === "}") { depth -= 1; k += 1; }
    else if (a === "[" && b === "[") { brackets += 1; k += 1; }
    else if (a === "]" && b === "]") { brackets -= 1; k += 1; }
    else if (a === "|" && depth === 0 && brackets === 0) {
      chunks.push(body.slice(start, k));
      start = k + 1;
    }
  }
  chunks.push(body.slice(start));

  for (const chunk of chunks) {
    const equal = chunk.indexOf("=");
    if (equal === -1) continue;
    const key = chunk.slice(0, equal).trim().toLowerCase();
    const value = chunk.slice(equal + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

/** A field whose value is a `*item` list becomes a cleaned array. */
function elementsList(value) {
  if (!value) return [];
  const raw = withoutCruft(value);
  // A list may start on the field's own line ("Azrya Woodlands\n*The Abyss"):
  // any line starting with a star opens an item.
  if (/(?:^|\n)\s*\*/.test(raw)) {
    return raw
      .split(/\n(?=\s*\*)/)
      .map((l) => cleanDescription(l.replace(/^\s*\*+\s*/, "")))
      .filter((l) => l && l.length > 1);
  }
  const alone = cleanDescription(raw);
  return alone ? [alone] : [];
}

/** `{{birthday|7|28}}` becomes "July 28"; other forms stay raw. */
function anniversary(value) {
  if (!value) return null;
  const m = value.match(/\{\{birthday\|(\d{1,2})\|(\d{1,2})\}\}/i);
  if (m) {
    const month = MONTH[Number(m[1]) - 1];
    if (month) return `${month} ${Number(m[2])}`;
  }
  const light = cleanDescription(withoutCruft(value));
  return light || null;
}

const GENRES = { male: "Male", female: "Female", "n/a": null, none: null };

/** Localises the sheet entries: the raw value first, otherwise nothing. */
function textField(value) {
  if (!value) return null;
  const light = cleanDescription(withoutCruft(value));
  return light || null;
}

/**
 * Rebuilds a hero's story sheet from its `{{Infobox hero story}}` template.
 * Every field is optional: the wiki fills them unevenly from one hero to
 * another.
 */
export function sheetStory(wikitext) {
  const body = bodyTemplate(wikitext, "Infobox hero story");
  if (!body) return null;
  // Strip references and galleries before splitting: their inner pipes are
  // not field separators and would break the split.
  const c = fieldsTemplate(withoutCruft(body));

  const genreRaw = textField(c.gender)?.toLowerCase();
  const sheet = {
    fullName: textField(c.full_name),
    title: textField(c.title),
    species: textField(c.species),
    gender: genreRaw ? (GENRES[genreRaw] ?? textField(c.gender)) : null,
    age: textField(c.age),
    origin: textField(c.born),
    birthday: anniversary(c.birthday),
    affiliations: elementsList(c.affiliation),
    relations: elementsList(c.relationships),
    powers: elementsList(c.abilities),
  };

  // An entirely empty sheet is not worth keeping.
  const useful = Object.values(sheet).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v),
  );
  return useful ? sheet : null;
}

/**
 * Returns the content of a top-level section, bounded by the next heading of
 * the same or a higher level. `titles` lists the accepted headings, tried in
 * order.
 */
export function sectionWiki(wikitext, titles) {
  const headers = [
    ...wikitext.matchAll(/^(=+)\s*(.+?)\s*=+\s*$/gm),
  ].map((m) => ({ position: m.index, end: m.index + m[0].length, level: m[1].length, title: m[2].trim().toLowerCase() }));

  for (const wanted of titles.map((t) => t.toLowerCase())) {
    const i = headers.findIndex((e) => e.title === wanted);
    if (i === -1) continue;
    const current = headers[i];
    const next = headers.slice(i + 1).find((e) => e.level <= current.level);
    return wikitext.slice(current.end, next ? next.position : undefined).trim();
  }
  return null;
}

/**
 * Assembles a hero's story: the lore as paragraphs, the story sheet and the
 * trivia. Returns `null` if the page offers nothing usable.
 */
export function extractStory(wikitext) {
  // The prose lives in the "Lore" subsection. Failing that, some heroes put
  // it directly under "Story", mixed with the sheet template, which
  // `loreBlocks` strips with every other data block.
  const rawLore = sectionWiki(wikitext, ["Lore", "Story"]);
  const blocks = rawLore ? loreBlocks(rawLore) : [];
  // `lore` stays a list of strings, the shape every language file shares;
  // `headings` lists the entries that are chapter titles, not paragraphs.
  const lore = blocks.map((b) => b.text);
  const headings = blocks.flatMap((b, i) => (b.type === "h" ? [i] : []));

  const rawTrivia = sectionWiki(wikitext, ["Trivia"]);
  const trivia = rawTrivia
    ? withoutCruft(rawTrivia)
        .split(/\n(?=\s*\*)/)
        .map((l) => cleanDescription(l.replace(/^\s*\*+\s*/, "")))
        .filter((l) => l && l.length > 4)
    : [];

  const sheet = sheetStory(wikitext);

  if (!lore.length && !trivia.length && !sheet) return null;
  return { lore, headings, sheet, trivia };
}

// ─────────────────────────────────────────────────────────────
// Page sections (game modes)
// ─────────────────────────────────────────────────────────────

/**
 * Strips wiki tables `{| … |}`, nested ones included. A table the page never
 * closes (the Brawl page's hero table) runs to the end of the text.
 */
function withoutTables(text) {
  let output = String(text);
  let before;
  do {
    before = output;
    output = output.replace(/\{\|(?:[^{]|\{(?!\|))*?\|\}/g, "");
  } while (output !== before);
  return output.replace(/\{\|[\s\S]*$/, "");
}

/**
 * Turns a section body into a sequence of blocks: each block is a paragraph
 * (`p`) or a list item (`li`), already cleaned. Tables, galleries, images and
 * references are dropped.
 */
export function blocksSection(body) {
  const clean = withoutTables(withoutCruft(body));
  const blocks = [];
  let paragraph = [];

  const clearParagraph = () => {
    if (!paragraph.length) return;
    const text = cleanDescription(paragraph.join(" "));
    if (text && text.length > 1) blocks.push({ type: "p", text });
    paragraph = [];
  };

  for (const row of clean.split("\n")) {
    const l = row.trim();
    if (!l) {
      clearParagraph();
      continue;
    }
    if (/^[*#]+/.test(l)) {
      clearParagraph();
      const text = cleanDescription(l.replace(/^[*#]+\s*/, ""));
      if (text && text.length > 1) blocks.push({ type: "li", text });
      continue;
    }
    // Leftover headings, standalone templates: of no interest here.
    if (/^=+/.test(l) || /^\{\{/.test(l) || /^\|/.test(l)) {
      clearParagraph();
      continue;
    }
    paragraph.push(l);
  }
  clearParagraph();
  return blocks;
}

/**
 * Splits a page into top-level sections (`==`), each rendered as blocks.
 * Headings listed in `ignore` (lowercase) are skipped.
 */
export function sectionsPage(wikitext, ignore = []) {
  const toSkip = new Set(ignore.map((s) => s.toLowerCase()));
  const headers = [
    ...wikitext.matchAll(/^(={2,})\s*(.+?)\s*=+\s*$/gm),
  ].map((m) => ({ position: m.index, end: m.index + m[0].length, level: m[1].length, title: m[2].trim() }));

  const sections = [];
  for (let i = 0; i < headers.length; i += 1) {
    const e = headers[i];
    if (e.level !== 2) continue;
    if (toSkip.has(e.title.toLowerCase())) continue;

    const next = headers.slice(i + 1).find((x) => x.level <= 2);
    const body = wikitext.slice(e.end, next ? next.position : undefined);
    const elements = blocksSection(body);
    if (elements.length) sections.push({ title: e.title, elements });
  }
  return sections;
}
