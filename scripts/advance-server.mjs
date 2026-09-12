/**
 * Advance Server patch notes (the Mobile Legends test server).
 *
 * The wiki publishes one page per test build: "Patch Notes 1.8.92 (Advanced
 * Server)", "(Advance Server)" on the oldest ones. We turn them into
 * structured data (hero, item, emblem, spell and system changes) with the
 * date and link of each page. Events, skins and free heroes are left out:
 * they say nothing about the balance changes to come.
 *
 *     node scripts/advance-server.mjs                     data + translations
 *     node scripts/advance-server.mjs --no-translation    data only
 *
 * Writes `src/data/jeu/advance-server.json` (English, the wiki's language)
 * and `src/data/jeu/advance-server/{fr,it,es}.json`. If the wiki does not
 * answer, the script fails before writing anything: the previous data stays.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ajustementsHeros } from "./patch-parser.mjs";
import { pause, traduireLot } from "./traduction-google.mjs";
import { nettoyerDescription } from "./wikitexte.mjs";

const WIKI = "https://mobilelegends.fandom.com";
const API = `${WIKI}/api.php`;
const USER_AGENT = "MLBBDex/1.0 (+https://mlbbdex.com)";
const OUTPUT = "src/data/jeu/advance-server.json";
const TRANSLATIONS_DIR = "src/data/jeu/advance-server";
const CACHE = "scripts/advance-server-translations.json";
const TARGET_LANGUAGES = ["fr", "it", "es"];

/**
 * Versions whose content is kept. Older ones stay listed with a link to the
 * wiki: test notes several years old would weigh a lot for content nobody
 * looks for anymore.
 */
export const DETAILED_VERSIONS = 24;

// ─────────────────────────────────────────────────────────────
// Finding the pages
// ─────────────────────────────────────────────────────────────

/** "Patch Notes 1.8.92 (Advanced Server)", "Patch Notes 1.3.08 (Advance Server)". */
export function isAdvancePage(title) {
  return /^Patch\b/i.test(title) && /\badvanced?\s+server\b/i.test(title);
}

/** Three-part version number; "1.5.0.2" is not one. */
export function versionFromTitle(title) {
  return String(title).match(/(?<![\d.])(\d+\.\d+\.\d+)(?![\d.])/)?.[1] ?? null;
}

/** Sorts 1.8.100 after 1.8.92, which an alphabetical sort does not. */
export function compareVersions(a, b) {
  const x = String(a).split(".").map(Number);
  const y = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

export function wikiUrl(title) {
  return `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/**
 * One page per version, newest first. When two titles name the same version,
 * the wiki's current spelling ("Advanced") wins, then the longest page.
 */
export function pickPages(pages) {
  const byVersion = new Map();
  const rank = (p) => (/advanced server/i.test(p.title) ? 1 : 0);
  for (const page of pages) {
    const current = byVersion.get(page.version);
    if (
      !current ||
      rank(page) > rank(current) ||
      (rank(page) === rank(current) && page.length > current.length)
    ) {
      byVersion.set(page.version, page);
    }
  }
  return [...byVersion.values()].sort((a, b) => compareVersions(b.version, a.version));
}

// ─────────────────────────────────────────────────────────────
// Infobox: date and summary
// ─────────────────────────────────────────────────────────────

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Release date announced by the infobox (`release_date`), as ISO. The field
 * is free text: "7 February 2024", "March 28, 2024 (server time)", "April
 * 1st, 2022, 19:00". An incomplete ("February ??th") or impossible date is
 * null rather than a guess.
 */
export function releaseDate(wikitext) {
  const raw = String(wikitext).match(/\|\s*release_date\s*=([^|\n}]*)/i)?.[1] ?? "";
  const text = raw
    .replace(/\(.*?\)/g, " ")
    .replace(/(\d+)(?:st|nd|rd|th)\b/gi, "$1")
    .trim();
  let day;
  let month;
  let year;
  let m = text.match(/^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})\b/i);
  if (m) [, day, month, year] = m;
  else {
    m = text.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
    if (m) [, month, day, year] = m;
  }
  if (!m) return null;
  const number = MONTHS[month.toLowerCase()];
  if (!number) return null;
  const iso = `${year}-${String(number).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

/** The infobox "what's new" summary on one line; null when empty. */
export function infoboxSummary(wikitext) {
  const m = String(wikitext).match(
    /\|\s*what's_new\s*=([\s\S]*?)(?=\n\s*\|\s*[a-z_']+\s*=|\|\s*[a-z_']+\s*=|\n?\}\})/i,
  );
  if (!m) return null;
  const parts = m[1]
    .split(/\n|<br\s*\/?>/i)
    .map((l) => nettoyerDescription(l.replace(/^\s*[#*:]+\s*/, "")))
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// ─────────────────────────────────────────────────────────────
// Wikitext normalization
// ─────────────────────────────────────────────────────────────

/**
 * Brings the spellings that changed over the years down to one: template
 * case, `name=` parameter, merged cells (`rowspan`), image files, nested
 * templates. The parsing then only has one grammar to know.
 */
export function normalizeWikitext(wikitext) {
  return String(wikitext)
    .replace(/\r/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\{(hi|ii|ai|pci)\|/gi, (_, g) => `{{${g.toLowerCase()}|`)
    .replace(/\{\{Hero Icon\|\s*name\s*=\s*([^}|]+)\}\}/gi, "{{hi|$1}}")
    .replace(/\{\{(hi|ii|ai)\|\s*name\s*=\s*/g, "{{$1|")
    // "{{ai|Dispersion Yang|{{ai|...}}}}": the nested display text is noise.
    .replace(/\{\{(hi|ii|ai)\|([^{}|]+)\|\{\{[^{}]*\}\}\}\}/g, "{{$1|$2}}")
    .replace(/\{\{pci\|([A-Za-z]+)\|?\s*\}\}/g, (_, v) => `{{pci|${v.toLowerCase()}}}`)
    // A two-argument hero or item link displays its second argument ("Basic
    // Attacks"); the second argument of a skill link is its slot.
    .replace(/\{\{(hi|ii)\|([^{}|]+)\|([^{}|]+)\}\}/g, "{{$1|$3}}")
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "")
    .replace(/\{\{clr\}\}/gi, "")
    .replace(/^(\s*\|)\s*(?:(?:rowspan|colspan)\s*=\s*"?\d+"?\s*)+\|/gim, "$1");
}

/** `{{pci|…}}` values the site keeps, split into a direction and a tag. */
const DIRECTIONS = new Set(["buff", "nerf", "adjust"]);
const TAGS = new Set(["new", "removed", "rework", "merge", "fix", "split"]);
const ARROW = /→|&rarr;|&#x2192;|>>|&gt;&gt;/;

/** Direction (buff, nerf, adjust) and tag (new, removed…) of the `{{pci}}` markers of a text. */
export function readPci(text) {
  let type = null;
  let tag = null;
  for (const [, value] of String(text).matchAll(/\{\{pci\|(\w+)\}\}/g)) {
    const key = value.toLowerCase();
    if (!type && DIRECTIONS.has(key)) type = key;
    if (!tag && TAGS.has(key)) tag = key;
  }
  return { type, tag };
}

const withoutPci = (text) => String(text).replace(/\s*\{\{pci\|[^}]*\}\}\s*/g, " ").trim();

const SUBTITLE_SKILL = /^[*:|]*\s*(\{\{ai\|([^{}|]+)(?:\|[^{}]*)?\}\})\s*((?:\{\{pci\|\w+\}\}\s*)*)$/;
const SUBTITLE_BOLD = /^[:|]*\s*'''\s*([^'{}[\]]+?)\s*:?\s*'''\s*:?\s*((?:\{\{pci\|\w+\}\}\s*)*)$/;
const SUBTITLE_PCI = /^[:|]*\s*([^'{}*#:|=<>[\]]{2,60}?)\s*:?\s*((?:\{\{pci\|\w+\}\}\s*)+)$/;

/**
 * Body of an entry (a hero, an item…) rewritten in the grammar that
 * `ajustementsHeros` reads: subtitles as `{{link|…}}` or `{{ai|…}}`, changes
 * as `* …`. The notes write subtitles several ways (bold, followed by a
 * `{{pci}}`, or a short plain line followed by a list) and only their
 * position tells them apart from a sentence.
 *
 * Also returns the subtitles in order, with their tag ("removed", "new"…),
 * which the parser's grammar does not keep.
 */
export function normalizeBody(lines) {
  const clean = lines
    .map((l) => l.replace(/<br\s*\/?>\s*$/i, "").trimEnd())
    .filter((l) => l.trim() && !/^\s*<br\s*\/?>\s*$/i.test(l) && !/^\s*=+.*=+\s*$/.test(l));
  const output = [];
  const subtitles = [];

  const subtitle = (markup, name, pci, generic) => {
    const { type, tag } = readPci(pci);
    output.push(`:${markup}${type ? ` {{pci|${type}}}` : ""}`);
    subtitles.push({ name: name.trim(), tag, generic });
  };

  for (const [i, raw] of clean.entries()) {
    if (/^\s*(?:\{\||\|\}|\|-|!)/.test(raw)) continue;
    const bare = raw.trim().replace(/^\|\s*/, "");
    let m;

    if ((m = bare.match(SUBTITLE_SKILL))) {
      subtitle(m[1], m[2], m[3], false);
      continue;
    }
    if ((m = bare.match(SUBTITLE_BOLD)) || (m = bare.match(SUBTITLE_PCI))) {
      const name = m[1].trim();
      subtitle(`{{link|${name}}}`, name, m[2], true);
      continue;
    }

    // A short line with no final punctuation, followed by a deeper list: a
    // heading written without markup ("Unique Passive - Immortal", "Creep
    // Reward:", "*Attribute" above "**" lines).
    const next = (clean[i + 1] ?? "").trim();
    const depth = bare.match(/^[*#]*/)[0].length;
    const text = bare.slice(depth).trim().replace(/:$/, "").trim();
    const nextDepth = next.match(/^[*#]*/)[0].length;
    if (
      nextDepth > depth &&
      text.length >= 2 &&
      text.length <= 60 &&
      !/[{}[\]'|]/.test(text) &&
      !/[.!?]$/.test(text) &&
      !ARROW.test(text)
    ) {
      subtitle(`{{link|${text}}}`, text, "", true);
      continue;
    }

    if (depth > 0 || ARROW.test(bare)) {
      const change = withoutPci(bare.slice(depth));
      if (change) output.push(`* ${change}`);
      continue;
    }
    const prose = withoutPci(bare);
    if (prose) output.push(prose);
  }

  return { text: output.join("\n"), subtitles };
}

/** The live parser's change, with English field names. */
function toChange(c) {
  return "text" in c ? { text: c.text } : { label: c.label, before: c.before, after: c.after };
}

const LIVE_TYPES = { amelioration: "buff", affaiblissement: "nerf", ajustement: "adjust" };

/**
 * Intro and change groups of an entry, read by the live patch parser: the
 * "before → after" changes and `{{scale}}` values then look exactly like the
 * ones of the Official Server notes.
 */
export function analyzeBody(lines) {
  const { text, subtitles } = normalizeBody(lines);
  const [entry] = ajustementsHeros(`==Hero Adjustments==\n:{{hi|_}} {{pci|adjust}}\n${text}\n`);
  const remaining = [...subtitles];
  const sections = (entry?.sections ?? []).map((s) => {
    const i = remaining.findIndex((r) => r.name === s.name);
    const found = i === -1 ? null : remaining.splice(i, 1)[0];
    return {
      // Changes listed before any subtitle get a group the parser names
      // "Attributes": the source has no heading there, so neither do we.
      name: found ? s.name : null,
      slot: s.category,
      type: LIVE_TYPES[s.type] ?? null,
      tag: found?.tag ?? null,
      // A generic heading ("Attributes", "Price") gets translated; a skill
      // name stays the game's own.
      generic: found ? found.generic : false,
      changes: s.changes.map(toChange),
    };
  });
  return { intro: entry?.intro ?? "", sections };
}

// ─────────────────────────────────────────────────────────────
// Splitting the page
// ─────────────────────────────────────────────────────────────

function cleanHeading(title) {
  return nettoyerDescription(title)
    .replace(/^[IVXLC]+\.?\s+(?=\S)/, "")
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/:$/, "")
    .trim();
}

/**
 * Blocks of the page, one per heading: the chain of headings containing it
 * (h2 then subheadings) and its text up to the next heading of any level.
 */
export function splitHeadings(wikitext) {
  const blocks = [];
  const stack = [];
  let current = null;
  for (const line of String(wikitext).split("\n")) {
    const heading = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (heading) {
      const level = heading[1].length - 2;
      stack.length = level;
      stack[level] = cleanHeading(heading[2]);
      current = { titles: stack.filter((x) => x !== undefined && x !== ""), body: [] };
      blocks.push(current);
      continue;
    }
    current?.body.push(line);
  }
  return blocks.map((b) => ({ titles: b.titles, body: b.body.join("\n") }));
}

const OFF_TOPIC =
  /event|free hero|skin|fragment|undocumented|draw|summon|star ?light|allstar|magic chess|aspirant|lucky|diamond|emote|bingo|recharge|album/i;

/**
 * Category of a block from its headings: heroes, items, emblems, spells,
 * system, designer notes, new heroes — or null for what does not touch the
 * balance (events, skins, free heroes).
 */
export function sectionCategory(titles) {
  const h2 = titles[0] ?? "";
  const leaf = titles.at(-1) ?? "";
  const all = titles.join(" / ");
  if (/from the designers?/i.test(h2)) return "designers";
  if (OFF_TOPIC.test(all)) return null;
  if (/^(?:new|revamp(?:ed)?)\s+hero(?:es)?\s*:/i.test(leaf)) return "newHeroes";
  if (/hero adjust|other heroes|hero changes|new\/revamp/i.test(all)) return "heroes";
  if (/\b(?:new|revamp(?:ed)?)\b.*\bhero/i.test(all)) return null;
  if (/equipment|\bitems?\b|\bbuilds?\b/i.test(leaf)) return "items";
  if (/emblem|talent/i.test(leaf)) return "emblems";
  if (/\bspells?\b/i.test(leaf)) return "spells";
  if (/battlefield|system|balance|bug|optimi|adjust|function|gameplay|\bother/i.test(all)) return "system";
  return null;
}

/** Templates that open an entry in each category. */
const OPENERS = {
  heroes: ["hi"],
  items: ["ii"],
  emblems: ["ai"],
  spells: ["ai"],
  system: ["ii", "ai"],
};

/**
 * Does a line open an entry? In a table, it is the first cell of a row that
 * names a hero (or an item…). Outside a table, the line must hold nothing
 * but the template and its `{{pci}}`; the definition lists of the oldest
 * notes (`:{{hi|Name}}`) go without one.
 */
function isOpener(line, templates, { firstCell = false, pciOptional = false } = {}) {
  const names = templates.join("|");
  if (firstCell) return new RegExp(`\\{\\{(?:${names})\\|`).test(line);
  const t = `\\{\\{(?:${names})\\|[^{}]+\\}\\}`;
  const m = line.match(new RegExp(`^(:*)\\s*(${t}(?:\\s*(?:&|,|and)\\s*${t})*)\\s*((?:\\{\\{pci\\|\\w+\\}\\}\\s*)*)$`));
  if (!m) return false;
  return Boolean(m[3].trim()) || (pciOptional && m[1].length > 0);
}

/**
 * Cuts a block into entries (a hero, an item…) and free lines. In a table,
 * an entry runs until the next opener: a merged cell (`rowspan`) spreads one
 * hero over several rows.
 */
export function splitBlock(body, templates, { heroes = false } = {}) {
  const entries = [];
  const free = [];
  let current = null;
  let inTable = false;
  let rowStart = false;
  const close = () => {
    if (current) entries.push(current);
    current = null;
  };

  for (const line of String(body).split("\n")) {
    const bare = line.trim();
    if (!bare) continue;
    if (/^\{\|/.test(bare)) {
      close();
      inTable = true;
      rowStart = true;
      continue;
    }
    if (/^\|\}/.test(bare)) {
      close();
      inTable = false;
      continue;
    }
    if (/^\|-/.test(bare)) {
      rowStart = true;
      continue;
    }
    if (/^!/.test(bare)) continue;

    if (inTable && rowStart && bare.startsWith("|")) {
      rowStart = false;
      // Two cells on one line: "|head || body".
      const [head, ...rest] = bare.slice(1).split("||");
      if (isOpener(head, templates, { firstCell: true })) {
        close();
        current = { head: head.trim(), lines: rest.length ? [`|${rest.join("||")}`] : [] };
        continue;
      }
    }
    if (!inTable && isOpener(bare, templates, { pciOptional: heroes })) {
      close();
      current = { head: bare, lines: [] };
      continue;
    }
    (current ? current.lines : free).push(line);
  }
  close();
  return { entries, free };
}

/**
 * A raw entry (head and lines) turned into data. A hero is named by its
 * template alone: "Revamped {{hi|Phoveus}}" is Phoveus.
 */
export function readEntry({ head, lines }, { heroes = false } = {}) {
  const { type, tag } = readPci(head);
  const heroLinks = [...head.matchAll(/\{\{hi\|([^{}|]+)\}\}/g)];
  const source = heroes && heroLinks.length === 1 ? heroLinks[0][1] : withoutPci(head).replace(/^[:|]+/, "");
  const name = nettoyerDescription(source).replace(/[\s:.]+$/, "");
  const { intro, sections } = analyzeBody(lines);
  return { name, type, tag, intro, sections };
}

/**
 * Lines outside any entry ("Optimized the targeting logic…"), each read as a
 * change: a "before >> after" line looks like the hero ones, the rest stays
 * text. A `<br>` starts a sub-line.
 */
export function freeLines(lines) {
  const output = [];
  for (const raw of lines) {
    const bare = raw.trim();
    if (!bare || /^(?:\{\||\|\}|\|-|!)/.test(bare) || /^\[\[Category:/i.test(bare)) continue;
    const marker = bare.match(/^[*#:]*/)[0];
    const level = Math.min(marker.replace(/:/g, "").length, 2);
    const body = bare.slice(marker.length).replace(/^\|\s*/, "");
    body.split(/<br\s*\/?>/i).forEach((part, i) => {
      const text = nettoyerDescription(withoutPci(part));
      if (!text || /^[―—-]?\s*Mobile Legends: Bang Bang$/i.test(text)) return;
      const { type } = readPci(part);
      const [read] = analyzeBody([`* ${withoutPci(part)}`]).sections[0]?.changes ?? [];
      output.push({ ...(read ?? { text }), level: i === 0 ? level : Math.min(level + 1, 2), type });
    });
  }
  return output;
}

/** Paragraphs of the designers' notes. */
function paragraphs(body) {
  return String(body)
    .split(/\n|<br\s*\/?>/i)
    .map((l) => nettoyerDescription(l.replace(/^\s*[*#:]+\s*/, "")))
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Matching the site's data
// ─────────────────────────────────────────────────────────────

/** Comparison key for names: no case, accents or punctuation. */
export const nameKey = (name) =>
  String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Same rule as the sync: "Chang'e" gives "chang-e", "X.Borg" "x-borg". */
function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Name → slug index, from a `{ slug, name }` list (the site's data files). */
export function buildIndex(list) {
  return new Map(list.map((x) => [nameKey(x.name), x.slug]));
}

/**
 * Hero announced by a heading ("New Hero: Cici, the Buoyant Performer",
 * "Revamped Hero: Frost Oracle - Aurora"): first a piece that is exactly a
 * hero name, then a run of one to three words that is one ("Popol and Kupa"
 * has three).
 */
export function newHeroFromTitle(title, heroIndex) {
  const kind = /revamp/i.test(title) ? "revamp" : "new";
  const rest = title.replace(/^[^:]*:\s*/, "");
  const pieces = rest.split(/\s*[,–—]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  let slug = pieces.map((p) => heroIndex.get(nameKey(p))).find(Boolean) ?? null;
  const words = rest.split(/\s+/);
  for (let n = 3; !slug && n >= 1; n -= 1) {
    for (let i = 0; !slug && i + n <= words.length; i += 1) {
      slug = heroIndex.get(nameKey(words.slice(i, i + n).join(" "))) ?? null;
    }
  }
  return { title, slug, kind };
}

/** Heroes per direction; a hero with no marker counts as an adjustment. */
export function balance(heroes) {
  const count = { buff: 0, nerf: 0, adjust: 0 };
  for (const h of heroes) count[h.type ?? "adjust"] += 1;
  return count;
}

// ─────────────────────────────────────────────────────────────
// Whole page
// ─────────────────────────────────────────────────────────────

/**
 * Everything an Advance Server notes page says about the balance: summary,
 * designers' notes, new heroes, hero changes, then items, emblems, spells
 * and system, in page order.
 */
export function analyzePage(wikitext, { heroes = new Map(), items = new Map() } = {}) {
  const w = normalizeWikitext(wikitext);
  const result = { summary: infoboxSummary(w), designerNotes: [], newHeroes: [], heroes: [], sections: [] };

  for (const block of splitHeadings(w)) {
    let category = sectionCategory(block.titles);
    if (!category) continue;
    if (category === "designers") {
      result.designerNotes.push(...paragraphs(block.body));
      continue;
    }
    if (category === "newHeroes") {
      result.newHeroes.push(newHeroFromTitle(block.titles.at(-1), heroes));
      continue;
    }

    const isHeroes = category === "heroes";
    const { entries, free } = splitBlock(block.body, OPENERS[category], { heroes: isHeroes });
    const read = entries.map((e) => readEntry(e, { heroes: isHeroes }));

    if (isHeroes) {
      // Free lines of a hero section ("The following uses…") are a legend.
      for (const e of read) result.heroes.push({ ...e, slug: heroes.get(nameKey(e.name)) ?? slugify(e.name) });
      continue;
    }

    // An item table placed right under "Battlefield Adjustments".
    if (category === "system" && entries.length && entries.every((e) => /\{\{ii\|/.test(e.head))) {
      category = "items";
    }
    const section = {
      category,
      title: block.titles.at(-1),
      entries: read.map((e) => ({ ...e, slug: category === "items" ? (items.get(nameKey(e.name)) ?? null) : null })),
      lines: freeLines(free),
    };
    if (section.entries.length || section.lines.length) result.sections.push(section);
  }

  return { ...result, balance: balance(result.heroes) };
}

// ─────────────────────────────────────────────────────────────
// Translation
// ─────────────────────────────────────────────────────────────

/**
 * Translated copy of a version. Left as is: hero, item and skill names (the
 * game's own, as on the hero pages), before/after values, links and dates.
 * `t` returns its argument when it has no translation.
 */
export function translateVersion(v, t) {
  const tr = (x) => (x ? t(x) : x);
  const change = (c) => ("text" in c ? { ...c, text: tr(c.text) } : { ...c, label: tr(c.label) });
  const entry = (e) => ({
    ...e,
    intro: tr(e.intro),
    sections: e.sections.map((s) => ({
      ...s,
      name: s.generic ? tr(s.name) : s.name,
      slot: tr(s.slot),
      changes: s.changes.map(change),
    })),
  });
  return {
    ...v,
    summary: tr(v.summary),
    designerNotes: v.designerNotes.map(tr),
    newHeroes: v.newHeroes.map((n) => ({ ...n, title: tr(n.title) })),
    heroes: v.heroes.map(entry),
    sections: v.sections.map((s) => ({
      ...s,
      title: tr(s.title),
      entries: s.entries.map(entry),
      lines: s.lines.map(change),
    })),
  };
}

/** Texts to translate in a version, in the order the rebuild asks for them. */
export function versionTexts(v) {
  const texts = [];
  translateVersion(v, (x) => {
    texts.push(x);
    return x;
  });
  return texts;
}

/** Batches of at most ten texts, also capped in length: everything goes in the URL. */
function batches(texts) {
  const groups = [];
  let current = [];
  let size = 0;
  for (const t of texts) {
    const weight = encodeURIComponent(t).length;
    if (current.length >= 10 || (current.length && size + weight > 6000)) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(t);
    size += weight;
  }
  if (current.length) groups.push(current);
  return groups;
}

async function translate(versions) {
  const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
  const save = () => writeFile(CACHE, JSON.stringify(cache, null, 0) + "\n");
  const texts = [...new Set(versions.flatMap(versionTexts).map((x) => String(x).trim()).filter(Boolean))];
  await mkdir(TRANSLATIONS_DIR, { recursive: true });

  for (const tl of TARGET_LANGUAGES) {
    const missing = texts.filter((x) => !(`en|${tl}|${x}` in cache));
    const groups = batches(missing);
    for (const [i, batch] of groups.entries()) {
      const results = await traduireLot(batch, "en", tl, { tolerant: true });
      batch.forEach((o, k) => (cache[`en|${tl}|${o}`] = results[k] ?? o));
      process.stdout.write(`\r  en->${tl} ${i + 1}/${groups.length} batches`);
      // A network cut in the middle of a long run does not lose everything.
      if (i % 50 === 49) await save();
      await pause(250);
    }
    if (groups.length) process.stdout.write("\n");
    await save();

    const t = (x) => cache[`en|${tl}|${String(x).trim()}`] ?? x;
    const translated = Object.fromEntries(versions.map((v) => [v.version, translateVersion(v, t)]));
    await writeFile(`${TRANSLATIONS_DIR}/${tl}.json`, JSON.stringify(translated, null, 2) + "\n");
    console.log(`  ${TRANSLATIONS_DIR}/${tl}.json`);
  }
}

// ─────────────────────────────────────────────────────────────
// Wiki access
// ─────────────────────────────────────────────────────────────

async function api(params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ ...params, format: "json", formatversion: "2" })) {
    url.searchParams.set(k, v);
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(45000) });
      if (response.ok) return response.json();
      if (response.status === 429) await pause(3000 * attempt);
      else throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3) throw error;
      await pause(1500 * attempt);
    }
  }
  throw new Error("Wiki unreachable.");
}

/**
 * Advance Server notes pages: by title, and by the wiki's categories for any
 * page with an unexpected title. Redirects and empty pages (created with no
 * content) are dropped.
 */
async function advancePages() {
  const titles = new Set();
  let next;
  do {
    const d = await api({ action: "query", list: "allpages", apprefix: "Patch", aplimit: "500", ...(next ? { apcontinue: next } : {}) });
    for (const p of d.query?.allpages ?? []) if (isAdvancePage(p.title)) titles.add(p.title);
    next = d.continue?.apcontinue;
    await pause(500);
  } while (next);

  for (const category of ["Category:Advanced Server", "Category:Patch Notes (Advanced Server)"]) {
    let more;
    do {
      const d = await api({
        action: "query",
        list: "categorymembers",
        cmtitle: category,
        cmnamespace: "0",
        cmlimit: "500",
        ...(more ? { cmcontinue: more } : {}),
      });
      for (const p of d.query?.categorymembers ?? []) if (versionFromTitle(p.title) && /advance/i.test(p.title)) titles.add(p.title);
      more = d.continue?.cmcontinue;
      await pause(500);
    } while (more);
  }

  const pages = [];
  const list = [...titles];
  for (let i = 0; i < list.length; i += 50) {
    const d = await api({ action: "query", prop: "info", titles: list.slice(i, i + 50).join("|") });
    for (const p of d.query?.pages ?? []) {
      const version = versionFromTitle(p.title);
      if (p.missing || p.redirect || !version || (p.length ?? 0) < 500) continue;
      pages.push({ version, title: p.title, url: wikiUrl(p.title), length: p.length });
    }
    await pause(500);
  }
  return pickPages(pages);
}

async function pageContent(title) {
  const d = await api({ action: "query", prop: "revisions", titles: title, rvprop: "content", rvslots: "main" });
  return d.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? null;
}

/** First revision of the page: the day the wiki published the notes. */
async function firstRevision(title) {
  const d = await api({ action: "query", prop: "revisions", titles: title, rvprop: "timestamp", rvdir: "newer", rvlimit: "1" });
  return d.query?.pages?.[0]?.revisions?.[0]?.timestamp?.slice(0, 10) ?? null;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const withTranslation = !process.argv.includes("--no-translation");
  const heroes = buildIndex(await readJson("src/data/jeu/heros.json"));
  const items = buildIndex(await readJson("src/data/jeu/objets/en.json"));

  console.log("Advance Server pages…");
  const pages = await advancePages();
  if (!pages.length) throw new Error("No page found: the wiki may have changed, data kept.");
  const detailed = Math.min(DETAILED_VERSIONS, pages.length);
  console.log(`  ${pages.length} versions, content of the ${detailed} most recent`);

  const versions = [];
  for (const [i, page] of pages.slice(0, DETAILED_VERSIONS).entries()) {
    const wikitext = await pageContent(page.title);
    await pause(400);
    if (!wikitext) continue;
    const announced = releaseDate(normalizeWikitext(wikitext));
    const published = announced ? null : await firstRevision(page.title);
    versions.push({
      version: page.version,
      title: page.title,
      url: page.url,
      // The date announced by the notes wins; failing that, the day they
      // were published on the wiki, within a few days.
      date: announced ?? published,
      dateSource: announced ? "notes" : published ? "wiki" : null,
      ...analyzePage(wikitext, { heroes, items }),
    });
    process.stdout.write(`\r  versions ${i + 1}/${detailed}`);
    await pause(400);
  }
  process.stdout.write("\n");

  const data = {
    source: `${WIKI}/wiki/Advanced_Server`,
    syncedAt: new Date().toISOString().slice(0, 10),
    versions,
    archive: pages.slice(DETAILED_VERSIONS).map(({ version, title, url }) => ({ version, title, url })),
  };
  // Nothing new: the file stays as is, sync date included, so that a run
  // with no change produces no diff.
  const previous = existsSync(OUTPUT) ? await readJson(OUTPUT) : null;
  const unchanged =
    previous && JSON.stringify({ ...previous, syncedAt: null }) === JSON.stringify({ ...data, syncedAt: null });
  if (!unchanged) await writeFile(OUTPUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`${OUTPUT} ${unchanged ? "unchanged" : "written"} (${versions.length} detailed versions)`);

  if (withTranslation) {
    console.log("Translations…");
    await translate(versions);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
