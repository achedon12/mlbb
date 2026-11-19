/**
 * Wiki markup left in synced text.
 *
 * The cleanup in `wikitext.mjs` turns links, templates, headings and tables
 * into plain text. When the wiki starts using a template it does not know,
 * the raw markup reaches the pages: "wants name=Lunox|image=Lunox to join
 * him", "=== Duke of Shards ===" in the middle of a story, "Resource#Rage/
 * Indicator|None" as a hero's resource. This module finds such leftovers in
 * any data tree, so the sync reports them the day they appear.
 */

/** Each kind of leftover, with the pattern that betrays it. */
export const MARKUP_PATTERNS = [
  ["link", /\[\[|\]\]/],
  ["template", /\{\{|\}\}/],
  ["table", /\{\||\|\}/],
  ["heading", /={2,}/],
  ["template parameter", /(?:^|[\s|{])(?:name|image|link|size|alt|caption|icon)\s*=\s*\S/i],
  ["namespace", /\b(?:Category|File|Image):\S/],
  ["HTML entity", /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]{1,7});/i],
  ["HTML tag", /<\/?[a-z][a-z0-9]*\b[^>]*>/i],
  ["section anchor", /\b[A-Za-z]\w*#[A-Za-z]/],
  ["pipe", /\|/],
  ["bold or italic", /''/],
  ["@ separator", /[.!?]@|\s@\s/],
  ["behaviour switch", /__[A-Z]+__/],
];

/** Kinds of markup found in one text, in table order. */
export function markupIn(text) {
  if (typeof text !== "string") return [];
  return MARKUP_PATTERNS.filter(([, re]) => re.test(text)).map(([kind]) => kind);
}

/** Fields that hold identifiers or addresses, never text shown to a reader. */
const NOT_TEXT = new Set(["slug", "id", "image", "icon", "url", "href", "path", "file"]);

/**
 * Every leftover in a data tree: `{ path, kinds, excerpt }`, the path written
 * like `.aamon.lore[1]`. Strings that are addresses (`https://…`, `/visuels/…`)
 * are skipped.
 */
export function findMarkup(tree, path = "") {
  const found = [];
  const walk = (value, at, key) => {
    if (typeof value === "string") {
      if (NOT_TEXT.has(key) || /^(?:https?:\/\/|\/)\S*$/.test(value)) return;
      const kinds = markupIn(value);
      if (kinds.length) {
        const [, re] = MARKUP_PATTERNS.find(([kind]) => kind === kinds[0]);
        const i = value.search(re);
        found.push({ path: at, kinds, excerpt: value.slice(Math.max(0, i - 40), i + 40) });
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${at}[${i}]`, key));
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, `${at}.${k}`, k);
    }
  };
  walk(tree, path, null);
  return found;
}

/**
 * Reports the leftovers of several datasets (`{ name: tree }`): a count per
 * dataset and its first examples. In GitHub Actions each dataset with
 * leftovers becomes a warning annotation on the run, visible without opening
 * the log. Returns the total, so a caller can decide to fail.
 */
export function reportMarkup(datasets, { warn = console.warn, examples = 5, annotate = Boolean(process.env.GITHUB_ACTIONS) } = {}) {
  let total = 0;
  for (const [name, tree] of Object.entries(datasets)) {
    const found = findMarkup(tree);
    if (!found.length) continue;
    total += found.length;
    const byKind = {};
    for (const f of found) for (const k of f.kinds) byKind[k] = (byKind[k] ?? 0) + 1;
    const summary = Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(", ");
    const sample = found.slice(0, examples).map((f) => `${f.path}: "…${f.excerpt}…"`);
    if (annotate) warn(`::warning title=Wiki markup in ${name}::${found.length} texts still hold wiki markup (${summary}). First: ${sample[0]}`);
    warn(`  ${name}: ${found.length} texts with wiki markup left (${summary})`);
    for (const s of sample) warn(`    ${s}`);
  }
  return total;
}
