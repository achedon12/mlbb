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
      // Emphasis templates: only the text matters.
      .replace(/\{\{[Bb]\|([^}]*)\}\}/g, "$1")
      .replace(/\{\{(?:hi|ii|Hi|II)\|([^}]*)\}\}/g, "$1")
      // Internal links, with or without a label.
      .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
      .replace(/\[\[([^\]]*)\]\]/g, "$1")
      .replace(/<nowiki>([\s\S]*?)<\/nowiki>/g, "$1")
      .replace(/<br\s*\/?>/gi, " "),
  );
  return (
    withoutHtml
      // Wikitext italics and bold.
      .replace(/'{2,}/g, "")
      .replace(/&ndash;/g, "–")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      // Unknown template: keep its first argument, which is the displayed text
      // by convention. Taking everything after the first pipe would leave the
      // separators of multi-argument templates —
      // "cannot be targeted|untargetable" instead of "cannot be targeted".
      .replace(/\{\{[^}|]*\|([^}|]*)(?:\|[^}]*)?\}\}/g, "$1")
      // Template without arguments: it carries no text.
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\s+/g, " ")
      // Removing annotations leaves a space before the percent sign.
      .replace(/\s+%/g, "%")
      .replace(/\s+([.,;:])/g, "$1")
      .trim()
  );
}

// ─────────────────────────────────────────────────────────────
// Hero story: lore, story sheet, trivia
// ─────────────────────────────────────────────────────────────

const MONTH = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
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

/** Removes a `{{Name ...}}` template from the text entirely, nested ones included. */
function removeTemplate(text, name) {
  const re = new RegExp(`\\{\\{${name}\\b`, "i");
  const m = re.exec(text);
  if (!m) return text;
  const start = m.index;
  let depth = 0;
  for (let k = start; k < text.length; k += 1) {
    if (text[k] === "{" && text[k + 1] === "{") { depth += 1; k += 1; }
    else if (text[k] === "}" && text[k + 1] === "}") {
      depth -= 1;
      k += 1;
      if (depth === 0) return text.slice(0, start) + text.slice(k + 1);
    }
  }
  return text;
}

/**
 * A hero's lore, rendered as readable paragraphs.
 *
 * We first split on blank lines, then clean each paragraph like a
 * description: paragraph breaks survive the process, where `cleanDescription`
 * alone would flatten everything onto one line.
 */
export function cleanLore(raw) {
  return withoutCruft(raw)
    .split(/\n{2,}/)
    .map((p) => cleanDescription(p))
    .filter((p) => p && p.length > 1);
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
  if (/^\s*\*/.test(raw)) {
    return raw
      .split(/\n(?=\s*\*)/)
      .map((l) => cleanDescription(l.replace(/^\s*\*+\s*/, "")))
      .filter((l) => l && l.length > 1);
  }
  const alone = cleanDescription(raw);
  return alone ? [alone] : [];
}

/** `{{birthday|7|28}}` becomes "28 juillet"; other forms stay raw. */
function anniversary(value) {
  if (!value) return null;
  const m = value.match(/\{\{birthday\|(\d{1,2})\|(\d{1,2})\}\}/i);
  if (m) {
    const month = MONTH[Number(m[1]) - 1];
    if (month) return `${Number(m[2])} ${month}`;
  }
  const light = cleanDescription(withoutCruft(value));
  return light || null;
}

const GENRES = { male: "Homme", female: "Femme", "n/a": null, none: null };

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
  // it directly under "Story", mixed with the sheet template: we strip the
  // template to keep only the narrative.
  const rawLore = sectionWiki(wikitext, ["Lore", "Story"]);
  const lore = rawLore ? cleanLore(removeTemplate(rawLore, "Infobox hero story")) : [];

  const rawTrivia = sectionWiki(wikitext, ["Trivia"]);
  const trivia = rawTrivia
    ? withoutCruft(rawTrivia)
        .split(/\n(?=\s*\*)/)
        .map((l) => cleanDescription(l.replace(/^\s*\*+\s*/, "")))
        .filter((l) => l && l.length > 4)
    : [];

  const sheet = sheetStory(wikitext);

  if (!lore.length && !trivia.length && !sheet) return null;
  return { lore, sheet, trivia };
}

// ─────────────────────────────────────────────────────────────
// Page sections (game modes)
// ─────────────────────────────────────────────────────────────

/** Strips wiki tables `{| … |}`, nested ones included. */
function withoutTables(text) {
  let output = String(text);
  let before;
  do {
    before = output;
    output = output.replace(/\{\|(?:[^{]|\{(?!\|))*?\|\}/g, "");
  } while (output !== before);
  return output;
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
