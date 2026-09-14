import { cleanDescription } from "./wikitext.mjs";

/**
 * Structured parsing of a patch note.
 *
 * Patch note wikitext follows a regular grammar that HTML rendering
 * flattens: each adjusted hero is introduced by `{{hi|Name}} {{pci|type}}`,
 * its skills by `{{ai|Name|Type}}`, and each change by a
 * `* Label: old → new` line. We turn it into a usable structure rather than
 * a wall of text, which is all a generic display would allow otherwise.
 *
 * What does not fit this grammar — designers' notes, new heroes, map
 * adjustments — is kept as is, as cleaned HTML.
 */

/** Name of the subsection opened for changes listed before any heading. */
export const IMPLICIT_SUBSECTION = "Attributes";

// Two change notations have coexisted across versions: "→" in recent notes,
// ">>" in older tables.
const ARROW = /&#x2192;|&rarr;|→|&gt;&gt;|>>/g;

/** Change type, as annotated by the wiki. */
function typeChange(raw) {
  return { buff: "buff", nerf: "nerf", adjust: "adjust" }[raw] ?? null;
}

/**
 * Makes a `{{scale|...}}` scaling annotation readable.
 *
 * The wiki encodes a value there that grows with level — a base and
 * increments. We render it in plain text ("100 +80 MP") rather than drop it,
 * otherwise an attribute change would shrink to "before → after" with no values.
 */
function renderScale(params) {
  const LABELS = {
    "total-pa": "AD",
    "total-ap": "AP",
    "total-mp": "MP",
    "total-hp": "HP",
    "total-def": "Def",
    "total-mdef": "Def. mag.",
    "extra-pa": "AD suppl.",
    "extra-ap": "AP suppl.",
    "extra-hp": "HP suppl.",
    "extra-mp": "MP suppl.",
  };
  const pairs = {};
  for (const kv of params.split("|")) {
    const i = kv.indexOf("=");
    if (i !== -1) pairs[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }

  const chunks = [];
  if (pairs.base !== undefined) chunks.push(pairs.base);
  for (const [key, value] of Object.entries(pairs)) {
    if (key === "base" || key === "level") continue;
    const lib = LABELS[key] ?? key;
    chunks.push(`+${value}${lib ? ` ${lib}` : ""}`);
  }
  return chunks.join(" ") || params;
}

/**
 * Splits a change line into before / after when it contains them.
 *
 * "Base HP: 2440 → 2500" reads much better in two columns than as a sentence.
 * A line without an arrow stays plain text.
 */
function analyzeChange(row) {
  const text = cleanRow(row);
  const parts = text.split(/\s*(?:→)\s*/);

  if (parts.length === 2) {
    // The label precedes the first ":"; otherwise the whole left part is the
    // old value.
    const sep = parts[0].indexOf(":");
    if (sep !== -1) {
      return {
        label: parts[0].slice(0, sep).trim(),
        before: parts[0].slice(sep + 1).trim(),
        after: parts[1].trim(),
      };
    }
    return { label: null, before: parts[0].trim(), after: parts[1].trim() };
  }

  return { text };
}

/** Cleans a wikitext line, keeping the arrow as a separator. */
function cleanRow(row) {
  // Numeric values go through `{{scale|...}}`: render them before the generic
  // cleanup erases them.
  const withValues = row.replace(/\{\{scale\|([^}]*)\}\}/gi, (_, p) => renderScale(p));
  return cleanDescription(withValues.replace(ARROW, " → ")).replace(/\s*→\s*/g, " → ");
}

/**
 * Extracts hero adjustments from a block of wikitext.
 *
 * Each hero opens a block that runs until the next hero. Inside, the
 * `: {{...}}` subtitles open subsections (attributes, skills), and the
 * `* ...` lines are the changes of the current subsection.
 */
export function heroAdjustments(wikitext) {
  // The heading carries a Roman numeral that changed from version to version
  // ("I.", "II."…), sometimes followed by a space before the "==".
  const header = wikitext.match(/^(==+)\s*(?:[IVXLCDM]+\.\s*)?Hero Adjustments\b.*$/im);
  if (!header) return [];

  const start = header.index + header[0].length;
  const level = header[1].length;
  // Up to the next heading of the same or a higher level.
  const run = wikitext.slice(start);
  const end = run.search(new RegExp(`^={2,${level}}[^=]`, "m"));
  const block = end === -1 ? run : run.slice(0, end);

  const heroes = [];
  let current = null;
  let subSection = null;

  const addSubsection = (name, category, type) => {
    subSection = { name, category, type, changes: [] };
    current.sections.push(subSection);
  };

  for (const raw of block.split("\n")) {
    // Wiki table structure: irrelevant to the content.
    if (/^\s*(?:\{\||\|\}|\|-|!)/.test(raw)) continue;

    // Two layouts have coexisted: table cells ("| …") and definition lists
    // (": …"). We strip the leading marker while remembering whether it was a
    // prose cell.
    let row = raw;
    let cellProse = false;
    if (/^\s*\|/.test(row)) {
      cellProse = true;
      row = row.replace(/^\s*\|\s*/, "");
    } else if (/^\s*:/.test(row)) {
      row = row.replace(/^\s*:+\s*/, "");
    }
    row = row.trim();
    if (!row) continue;

    // Hero opening: {{hi|Name}} {{pci|type}}
    const heroHeader = row.match(/^\{\{hi\|([^}]+)\}\}\s*\{\{pci\|(buff|nerf|adjust)\}\}/i);
    if (heroHeader) {
      current = {
        name: heroHeader[1].trim(),
        type: typeChange(heroHeader[2].toLowerCase()),
        intro: "",
        sections: [],
      };
      heroes.push(current);
      subSection = null;
      continue;
    }
    if (!current) continue;

    // Subtitle: "{{link|Attributes}} {{pci|type}}" or "{{ai|Name|Type}}".
    const subtitle = row.match(
      /^\{\{(?:link|ai)\|([^}|]+)(?:\|([^}]+))?\}\}\s*(?:\{\{pci\|(buff|nerf|adjust)\}\})?\s*$/i,
    );
    if (subtitle) {
      addSubsection(
        subtitle[1].trim(),
        subtitle[2]?.trim() ?? null,
        typeChange(subtitle[3]?.toLowerCase()),
      );
      continue;
    }

    // Change: "* …". With no open subsection — base attribute in tables — we
    // open an implicit one.
    const change = row.match(/^\*+\s*(.+)/);
    if (change) {
      if (!subSection) addSubsection(IMPLICIT_SUBSECTION, null, null);
      const analysis = analyzeChange(change[1]);
      const empty = "text" in analysis ? !analysis.text : !analysis.before && !analysis.after;
      if (!empty) subSection.changes.push(analysis);
      continue;
    }

    // Prose: hero intro (a table's "Change" cell, or a ":" line) as long as
    // no subsection has been opened.
    if (!subSection && (cellProse || true)) {
      const text = cleanDescription(row);
      if (text) current.intro = current.intro ? `${current.intro} ${text}` : text;
    }
  }

  // Keep every adjusted hero, even those whose changes the wiki has not
  // detailed yet: "buffed" without details is still information.
  return heroes;
}

/** Numeric summary for the header: how many buffs, how many nerfs. */
export function summary(heroes) {
  const count = { buff: 0, nerf: 0, adjust: 0 };
  for (const h of heroes) if (h.type) count[h.type] += 1;
  return count;
}
