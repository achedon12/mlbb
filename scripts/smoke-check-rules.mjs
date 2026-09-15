/**
 * Content checks shared by the smoke check (`scripts/smoke-check.mjs`) and the
 * browser spec (`tests/e2e/content.spec.ts`).
 *
 * A green HTTP status says nothing about what the page shows: a raw
 * `{placeholder}` in a title, an empty legal page or an untranslated label all
 * answer 200. The rules here read the HTML (or JSON) and say what is wrong, in
 * words a person can act on. Everything in this module is pure: no network, no
 * file system, so it can be unit tested.
 */

// Same list as LOCALES in src/i18n/config.ts: this module stays pure (no file
// reading), and tests/unit/translation-scripts.test.mjs checks they match.
export const LOCALES = ["en", "fr", "it", "es", "id"];
const ALL = LOCALES;
const EN_FR = ["en", "fr"];

/** Placeholder left by a message that was not interpolated: `{plural}`, `{count}`. */
export const PLACEHOLDER = /\{[A-Za-z_][A-Za-z0-9_]*\}/g;

/** Below this many words in the main content, a page is considered empty. */
export const MIN_WORDS = 40;

/**
 * Pages to check, as paths without the locale prefix (`""` is the home page).
 *
 * Static paths come from `src/lib/sitemap.ts`, and the runner checks they are
 * still listed in the sitemap (the union of the child sitemaps), so a moved route fails loudly instead of being
 * silently skipped. Entries with `discover` have no fixed path: the runner
 * picks one from the sitemap (compare pairs and patch versions change).
 *
 * Options:
 * - `locales`: languages to check the page in;
 * - `browser`: also opened in a real browser by the Playwright spec;
 * - `minWords`: minimum word count of the main content (default `MIN_WORDS`);
 *   the fixed text pages ask for more, so a page that renders only its
 *   heading fails;
 * - `allowedPlaceholders`: placeholders the page shows on purpose (the API
 *   documentation lists `/api/v1/heroes/{slug}`);
 * - `includes` / `excludes`: per locale, phrases the main content must (or
 *   must not) contain, matched as whole words.
 */
export const PAGES = [
  { path: "", locales: ALL, browser: true },
  { path: "/heroes", locales: ALL, browser: true },
  { path: "/heroes/khufra", locales: ALL, browser: true },
  { path: "/heroes/khufra/counters", locales: EN_FR },
  { path: "/heroes/khufra/duos", locales: EN_FR },
  {
    // Rarity names come from the message catalog: a French label leaking into
    // every language (or the raw English key) fails here.
    path: "/heroes/khufra/skins",
    locales: ALL,
    includes: {
      en: ["Exquisite", "Exceptional"],
      fr: ["Exquis", "Exceptionnel"],
      it: ["Squisita", "Eccezionale"],
      es: ["Exquisita", "Excepcional"],
      // Indonesian keeps the game's English rarity names.
      id: ["Exquisite", "Exceptional"],
    },
    excludes: {
      en: ["Exquis", "Exceptionnel"],
      it: ["Exquis", "Exceptionnel"],
      es: ["Exquis", "Exceptionnel"],
      id: ["Exquis", "Exceptionnel"],
    },
  },
  { path: "/tier-list", locales: ALL, browser: true },
  { path: "/tier-list/role/fighter", locales: ALL, browser: true },
  { path: "/tier-list/role/mage", locales: EN_FR },
  { path: "/tier-list/lane/jungle", locales: EN_FR },
  { path: "/tier-list/mythic", locales: EN_FR },
  { path: "/heroes/role/tank", locales: EN_FR },
  { path: "/statistics", locales: ALL },
  { path: "/meta", locales: EN_FR },
  { path: "/items", locales: EN_FR, browser: true },
  { path: "/items/blade-of-despair", locales: EN_FR },
  { path: "/emblems", locales: ALL, browser: true },
  {
    // Emblem names are translated: an untranslated fallback shows the English
    // name in every language.
    path: "/emblems/fighter",
    locales: ALL,
    browser: true,
    includes: {
      en: ["Fighter Emblem"],
      fr: ["Emblème de combattant"],
      it: ["Emblema Combattente"],
      es: ["Emblema de luchador"],
      // Indonesian keeps the game's English emblem names.
      id: ["Fighter Emblem"],
    },
    excludes: { fr: ["Fighter Emblem"], it: ["Fighter Emblem"], es: ["Fighter Emblem"], id: ["Emblème de combattant"] },
  },
  { path: "/spells", locales: EN_FR },
  { path: "/spells/flicker", locales: EN_FR },
  { path: "/skins", locales: EN_FR },
  { path: "/ranks", locales: EN_FR },
  { path: "/patch-notes", locales: EN_FR },
  { discover: "latest-patch", path: "/patch-notes/<latest version>", locales: EN_FR },
  { path: "/game-modes", locales: EN_FR },
  { path: "/news", locales: EN_FR },
  { path: "/tools/retribution", locales: EN_FR },
  { path: "/tools/team", locales: EN_FR, browser: true },
  { path: "/draft", locales: ALL, browser: true },
  { path: "/tools/build", locales: EN_FR },
  { path: "/tools/timer", locales: EN_FR },
  { path: "/tools/tier-list-maker", locales: EN_FR },
  { path: "/map", locales: EN_FR },
  { path: "/esports", locales: EN_FR },
  { path: "/events", locales: EN_FR },
  { path: "/quiz", locales: EN_FR, browser: true },
  { path: "/mlbbdle", locales: EN_FR },
  { path: "/about", locales: ALL, browser: true, minWords: 150 },
  { path: "/legal", locales: ALL, browser: true, minWords: 150 },
  { path: "/privacy", locales: ALL, browser: true, minWords: 150 },
  { path: "/api-doc", locales: EN_FR, allowedPlaceholders: ["{slug}"] },
  { discover: "compare-pair", path: "/compare/<a>-vs-<b>", locales: EN_FR },
];

/** A path that exists in no route: must answer 404. */
export const MISSING_PAGE = "/en/smoke-check-missing-page";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Decodes the common named entities and every numeric one, in a single pass. */
export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return ENTITIES[body.toLowerCase()] ?? entity;
  });
}

/**
 * Text a visitor sees: scripts, styles and templates dropped (the React
 * payload repeats every message, placeholders included), tags stripped,
 * entities decoded, whitespace collapsed.
 */
export function visibleText(html) {
  return decodeEntities(
    String(html)
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Main content (`<main>`), or the whole body when the page has none. */
export function mainHtml(html) {
  const main = String(html).match(/<main\b[^>]*>([\s\S]*)<\/main\s*>/i);
  if (main) return main[1];
  const body = String(html).match(/<body\b[^>]*>([\s\S]*)<\/body\s*>/i);
  return body ? body[1] : String(html);
}

/** Every distinct placeholder in a text, minus the allowed ones. */
export function findPlaceholders(text, allowed = []) {
  const found = new Set(String(text ?? "").match(PLACEHOLDER) ?? []);
  for (const a of allowed) found.delete(a);
  return [...found];
}

/** Content of the document `<title>` (in the head, not an SVG one), decoded; null when there is none. */
export function extractTitle(html) {
  const head = String(html).match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)?.[0] ?? String(html);
  const found = head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return found ? decodeEntities(found[1]).replace(/\s+/g, " ").trim() : null;
}

/** Content of `<meta name="description">`, decoded; null when there is none. */
export function extractDescription(html) {
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bname\s*=\s*["']description["']/i.test(tag)) continue;
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i);
    return content ? decodeEntities(content[1] ?? content[2]) : "";
  }
  return null;
}

/** Value of `<html lang>`; null when missing. */
export function extractLang(html) {
  const tag = String(html).match(/<html\b[^>]*>/i);
  const lang = tag?.[0].match(/\blang\s*=\s*["']([^"']*)["']/i);
  return lang ? lang[1] : null;
}

export const countWords = (text) => (String(text).match(/[\p{L}\p{N}]+/gu) ?? []).length;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `phrase` appears in `text` as whole words ("Exquis" is not in "Exquisite"). */
export function containsPhrase(text, phrase) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "u").test(text);
}

/**
 * Checks one rendered page. Returns the list of problems, empty when the
 * page is fine.
 *
 * @param {{ html: string, status: number, locale: string, page: object, expectedStatus?: number }} input
 */
export function inspectPage({ html, status, locale, page, expectedStatus = 200 }) {
  const problems = [];
  if (status !== expectedStatus) problems.push(`status ${status}, expected ${expectedStatus}`);
  if (typeof html !== "string" || html.length === 0) {
    problems.push("empty response body");
    return problems;
  }
  const allowed = page.allowedPlaceholders ?? [];

  const title = extractTitle(html);
  if (!title) problems.push("missing or empty <title>");
  else if (title.includes("{")) problems.push(`title contains "{": "${title}"`);

  const description = extractDescription(html);
  const inDescription = findPlaceholders(description, allowed);
  if (inDescription.length) problems.push(`placeholder in meta description: ${inDescription.join(", ")}`);

  const lang = extractLang(html);
  if (!lang) problems.push("missing <html lang>");
  else if (lang.split("-")[0].toLowerCase() !== locale) problems.push(`<html lang="${lang}">, expected ${locale}`);

  // The whole document minus its head: header, navigation and footer count too.
  const placeholders = findPlaceholders(visibleText(html.replace(/<head\b[\s\S]*?<\/head\s*>/i, " ")), allowed);
  if (placeholders.length) problems.push(`placeholder in visible text: ${placeholders.join(", ")}`);

  const main = visibleText(mainHtml(html));
  const words = countWords(main);
  const minWords = page.minWords ?? MIN_WORDS;
  if (words < minWords) problems.push(`main content has ${words} words, expected at least ${minWords}`);

  for (const phrase of page.includes?.[locale] ?? []) {
    if (!containsPhrase(main, phrase)) problems.push(`missing text "${phrase}"`);
  }
  for (const phrase of page.excludes?.[locale] ?? []) {
    if (containsPhrase(main, phrase)) problems.push(`unexpected text "${phrase}" (untranslated?)`);
  }
  return problems;
}

/** Former French response keys the client no longer reads: their return is a regression. */
const FRENCH_KEYS = ["connecte", "cle", "clé"];

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** English lane tokens the public API must return. */
export const API_LANES = ["Gold", "Jungle", "Mid", "Exp", "Roam"];

/**
 * Non-HTML endpoints. `check` receives the parsed body (JSON) or the text,
 * and returns the list of problems. `placeholders: false` skips the
 * placeholder scan (llms.txt documents `{slug}` URL patterns on purpose).
 */
export const ENDPOINTS = [
  {
    path: "/api/health",
    type: "json",
    check: (body) => (isObject(body) ? [] : ["body is not a JSON object"]),
  },
  {
    // The account button reads `connected`: any other key leaves it signed out.
    path: "/api/session",
    type: "json",
    check: (body) => {
      if (!isObject(body)) return ["body is not a JSON object"];
      const problems = [];
      if (typeof body.connected !== "boolean") problems.push(`"connected" is ${JSON.stringify(body.connected)}, expected a boolean`);
      const french = Object.keys(body).filter((k) => FRENCH_KEYS.includes(k.toLowerCase()));
      if (french.length) problems.push(`unexpected key(s) ${french.map((k) => `"${k}"`).join(", ")}`);
      return problems;
    },
  },
  {
    // The notification opt-in reads `key`: null disables it, a string enables it.
    path: "/api/push",
    type: "json",
    check: (body) => {
      if (!isObject(body)) return ["body is not a JSON object"];
      const problems = [];
      if (!("key" in body)) problems.push('missing "key"');
      else if (body.key !== null && typeof body.key !== "string") problems.push(`"key" is ${typeof body.key}, expected a string or null`);
      const french = Object.keys(body).filter((k) => FRENCH_KEYS.includes(k.toLowerCase()));
      if (french.length) problems.push(`unexpected key(s) ${french.map((k) => `"${k}"`).join(", ")}`);
      return problems;
    },
  },
  {
    // Same URL as `measuresUrl("mythic")` in src/lib/composition.ts.
    path: "/composition/mythic.json?v=2",
    type: "json",
    check: (body) => {
      if (!isObject(body)) return ["body is not a JSON object"];
      return typeof body.rank === "string" && body.rank ? [] : ['missing "rank"'];
    },
  },
  {
    path: "/api/v1/heroes",
    type: "json",
    check: (body) => {
      if (!isObject(body) || !Array.isArray(body.data)) return ['missing "data" array'];
      if (body.data.length < 100) return [`only ${body.data.length} heroes`];
      const lanes = [...new Set(body.data.flatMap((h) => (Array.isArray(h?.lanes) ? h.lanes : [null])))];
      const unknown = lanes.filter((l) => !API_LANES.includes(l));
      return unknown.length ? [`non-English lane(s): ${unknown.map((l) => JSON.stringify(l)).join(", ")}`] : [];
    },
  },
  {
    // A sitemap index; the runner then fetches each child it lists.
    path: "/sitemap.xml",
    type: "text",
    check: (text) => checkSitemapIndex(text),
  },
  {
    path: "/llms.txt",
    type: "text",
    placeholders: false,
    check: (text) => (countWords(text) >= 50 ? [] : ["almost empty"]),
  },
];

/**
 * Child sitemaps `/sitemap.xml` must list, as `/sitemaps/<name>.xml`: same
 * names and order as `SITEMAPS` in `src/lib/sitemap.ts`
 * (tests/unit/smoke-check.test.mjs checks they match).
 */
export const SITEMAP_CHILDREN = [
  "pages",
  "tier-lists",
  "heroes",
  "hero-counters",
  "hero-duos",
  "hero-skins",
  "compare",
  "items",
  "emblems-spells",
  "events",
  "patch-notes",
  "news",
];

/** Below this many URLs across every child sitemap, the sitemap is considered broken. */
export const MIN_SITEMAP_URLS = 1000;

const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

/**
 * Well-formedness problems of an XML document, for the flat documents a
 * sitemap is: balanced and properly nested tags, no stray `<` or unescaped `&`
 * in text, a single root. Not a full parser (no DTD, CDATA or comments, which
 * sitemaps do not use).
 */
export function xmlProblems(xml) {
  const text = String(xml);
  const stack = [];
  let roots = 0;
  let last = 0;
  const strayText = (chunk) => /<|&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(chunk);
  for (const match of text.matchAll(/<(\?[^>]*\?|\/?[A-Za-z_][\w:.-]*(?:\s[^>]*)?\/?)>/g)) {
    if (strayText(text.slice(last, match.index))) return ["malformed XML: stray markup or unescaped & in text"];
    last = match.index + match[0].length;
    const tag = match[1];
    if (tag.startsWith("?")) {
      if (match.index !== 0 || !tag.startsWith("?xml")) return ["malformed XML: misplaced declaration"];
      continue;
    }
    const name = tag.match(/^\/?([\w:.-]+)/)[1];
    if (tag.startsWith("/")) {
      const open = stack.pop();
      if (open !== name) return [`malformed XML: </${name}> closes <${open ?? "nothing"}>`];
    } else if (!tag.endsWith("/")) {
      if (stack.length === 0) roots++;
      stack.push(name);
    }
  }
  if (strayText(text.slice(last)) || text.slice(last).trim()) return ["malformed XML: text after the root element"];
  if (stack.length) return [`malformed XML: <${stack.at(-1)}> never closed`];
  if (roots !== 1) return [`malformed XML: ${roots} root elements, expected 1`];
  return [];
}

/**
 * Structure problems of a sitemap document: well-formed, rooted at `root`
 * (`urlset` or `sitemapindex`) in the sitemaps.org namespace, every entry
 * (`url` or `sitemap`) holding exactly one absolute http(s) `<loc>`.
 */
export function sitemapStructureProblems(xml, root) {
  const text = String(xml);
  const problems = xmlProblems(text);
  if (problems.length) return problems;
  const opening = text.match(new RegExp(`<${root}(\\s[^>]*)?>`));
  if (!opening) return [`root element is not <${root}>`];
  if (!new RegExp(`\\sxmlns="${SITEMAP_NAMESPACE.replace(/[./]/g, "\\$&")}"`).test(opening[1] ?? "")) {
    return [`<${root}> lacks the ${SITEMAP_NAMESPACE} namespace`];
  }
  const entry = root === "urlset" ? "url" : "sitemap";
  const entries = [...text.matchAll(new RegExp(`<${entry}>([\\s\\S]*?)</${entry}>`, "g"))];
  if (entries.length === 0) return [`no <${entry}> entry`];
  for (const [, body] of entries) {
    const locs = [...body.matchAll(/<loc>\s*([^<\s]*)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]));
    if (locs.length !== 1) return [`a <${entry}> holds ${locs.length} <loc>, expected 1`];
    if (!/^https?:\/\/[^/\s]+\//.test(locs[0] + "/")) return [`relative or invalid <loc>: ${locs[0]}`];
  }
  return [];
}

/** Child sitemap addresses listed by a sitemap index. */
export function sitemapIndexLocs(xml) {
  return [...String(xml).matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/g)].map((m) =>
    decodeEntities(m[1]),
  );
}

/** Problems of `/sitemap.xml`: a valid index listing every child of `children`, and nothing else. */
export function checkSitemapIndex(xml, children = SITEMAP_CHILDREN) {
  const problems = sitemapStructureProblems(xml, "sitemapindex");
  if (problems.length) return problems;
  const listed = sitemapIndexLocs(xml).map((loc) => {
    try {
      return new URL(loc).pathname;
    } catch {
      return loc;
    }
  });
  const expected = children.map((name) => `/sitemaps/${name}.xml`);
  const missing = expected.filter((path) => !listed.includes(path));
  const unexpected = listed.filter((path) => !expected.includes(path));
  const duplicated = [...new Set(listed.filter((path, i) => listed.indexOf(path) !== i))];
  return [
    ...(missing.length ? [`child sitemap(s) not listed: ${missing.join(", ")}`] : []),
    ...(unexpected.length ? [`unexpected child sitemap(s): ${unexpected.join(", ")}`] : []),
    ...(duplicated.length ? [`child sitemap(s) listed twice: ${duplicated.join(", ")}`] : []),
  ];
}

/** Problems of a child sitemap: a valid `<urlset>` with at least one URL. */
export function checkSitemapChild(xml) {
  return sitemapStructureProblems(xml, "urlset");
}

/**
 * Problems of the child sitemaps taken together (`{ name: paths }`): enough
 * URLs overall, and no URL listed by two children (or twice by one).
 */
export function checkSitemapUnion(pathsByChild) {
  const all = Object.values(pathsByChild).flat();
  const problems = all.length > MIN_SITEMAP_URLS ? [] : [`only ${all.length} URLs, expected more than ${MIN_SITEMAP_URLS}`];
  const seen = new Map();
  const duplicates = [];
  for (const [child, paths] of Object.entries(pathsByChild)) {
    for (const path of paths) {
      if (seen.has(path)) duplicates.push(`${path} (${seen.get(path)}, ${child})`);
      else seen.set(path, child);
    }
  }
  if (duplicates.length) {
    problems.push(`${duplicates.length} URL(s) listed more than once: ${duplicates.slice(0, 5).join("; ")}${duplicates.length > 5 ? "…" : ""}`);
  }
  return problems;
}

/** Paths listed in a sitemap, whatever host it was generated for. */
export function sitemapPaths(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
    const loc = decodeEntities(m[1]);
    try {
      const url = new URL(loc);
      return url.pathname + url.search;
    } catch {
      return loc;
    }
  });
}

const versionParts = (v) => v.split(".").map(Number);
function compareVersions(a, b) {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Turns the page table into concrete paths (locale-less) using the sitemap.
 * Returns `{ pages, problems }`: a static path missing from the sitemap, or a
 * discovery that finds nothing, is a problem.
 */
export function resolvePages(paths, table = PAGES) {
  const english = new Set(paths.filter((p) => p === "/en" || p.startsWith("/en/")).map((p) => p.slice(3)));
  const pages = [];
  const problems = [];
  for (const page of table) {
    if (!page.discover) {
      if (english.has(page.path)) pages.push(page);
      else problems.push(`/en${page.path}: not listed in the sitemap (route moved or removed?)`);
      continue;
    }
    let path = null;
    if (page.discover === "latest-patch") {
      const versions = [...english]
        .map((p) => p.match(/^\/patch-notes\/(\d+(?:\.\d+)+)$/)?.[1])
        .filter(Boolean)
        .sort(compareVersions);
      if (versions.length) path = `/patch-notes/${versions.at(-1)}`;
    } else if (page.discover === "compare-pair") {
      path = [...english].find((p) => /^\/compare\/[a-z0-9-]+-vs-[a-z0-9-]+$/.test(p)) ?? null;
    }
    if (path) pages.push({ ...page, path });
    else problems.push(`${page.path}: no matching URL in the sitemap`);
  }
  return { pages, problems };
}
