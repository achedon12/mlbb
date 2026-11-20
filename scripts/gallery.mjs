import { removeTags } from "./tags.mjs";

/**
 * Full-size illustrations from a wiki hero page.
 *
 * Pages do not all follow the same template: the section is called
 * « Splash art », « Splash arts » or « Artwork », it sometimes opens with a
 * note, and often stacks several galleries (current visuals, then older ones).
 * Rows sometimes omit the « File: » prefix, and captions carry markup —
 * links, bold, a second line of detail.
 */
export function extractIllustrations(wikitext) {
  const output = [];
  const seen = new Set();

  for (const section of sections(wikitext, /(?:splash arts?|artworks?)/)) {
    for (const gallery of section.matchAll(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi)) {
      for (const row of gallery[1].matchAll(/^[ \t]*(?:File:|Image:)?([^|\n]+?\.(?:jpg|png))[ \t]*\|(.*)$/gim)) {
        const file = row[1].trim();
        const skin = cleanLegend(row[2]);
        if (!skin || seen.has(file)) continue;
        seen.add(file);
        output.push({ file, skin });
      }
    }
  }
  return output;
}

/**
 * Bodies of the sections whose title matches `title`. A section runs up to
 * the next heading of the same or a higher level; its subsections belong to
 * it.
 */
function sections(wikitext, title) {
  const bodies = [];
  const heading = new RegExp(`^(=+)\\s*${title.source}\\s*=+[ \\t]*$`, "gim");
  for (const match of wikitext.matchAll(heading)) {
    const level = match[1].length;
    const run = wikitext.slice(match.index + match[0].length);
    const end = run.search(new RegExp(`^={1,${level}}[^=]`, "m"));
    bodies.push(end === -1 ? run : run.slice(0, end));
  }
  return bodies;
}

/**
 * Skins listed by the "Avatar icons" gallery of a hero page.
 *
 * Each row names the skin's icon after its game id, `Hero1284-icon.png|Tideborn
 * Sailor`: the same id as the skin module and the shop portrait
 * (`Hero1284-portrait.png`). The module stopped following the game in
 * October 2026, the hero pages did not: this gallery is how a skin newer
 * than the module gets its id. Painted variants (`Hero1284-color01-icon`)
 * are colours of a skin, not skins, and are left out.
 */
export function extractAvatarIcons(wikitext) {
  const output = [];
  const seen = new Set();
  for (const section of sections(wikitext, /avatar icons?/)) {
    for (const gallery of section.matchAll(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi)) {
      for (const row of gallery[1].matchAll(/^[ \t]*(?:File:|Image:)?(Hero(\d+)-icon[^|\n]*\.png)[ \t]*\|(.*)$/gim)) {
        const id = row[2];
        const name = cleanLegend(row[3]);
        if (!name || seen.has(id)) continue;
        seen.add(id);
        output.push({ id, name, file: row[1].trim() });
      }
    }
  }
  return output;
}

/**
 * Words that mark a wiki file as something other than the live game's
 * artwork: an unreleased revamp ("Thamuz (Lord Lava; unreleased revamp).jpg"),
 * a test-server or leaked visual, a fan work, a concept sketch, or the
 * pre-revamp version kept for the record ("Masha Rogue Talon (Original).jpg").
 */
const PROVISIONAL = /\b(unreleased|upcoming|leak(?:ed|s)?|advanced? server|test server|fan[ -]?art|fan[ -]?made|concept|wip)\b|\(original\)|\(old\)|\bpre-revamp\b/i;

/**
 * Whether a wiki file is not the live artwork, from its name, the
 * description of its file page, its upload comment and its categories.
 */
export function isProvisionalFile({ name = "", description = "", comment = "", categories = [] } = {}) {
  return [name, description, comment, ...categories].some((text) => PROVISIONAL.test(String(text ?? "")));
}

/**
 * The live file a provisional one stands next to on the wiki: the same name
 * without its marker. "Thamuz (Lord Lava; unreleased revamp).jpg" sits next
 * to "Thamuz (Lord Lava).jpg", the artwork the game shows; "Masha Rogue Talon
 * (Original).jpg" next to "Masha (Rogue Talon).jpg". Several spellings are
 * returned, the wiki uses them all; none when the name has no marker.
 */
export function fallbackFileNames(file) {
  const ext = file.match(/\.(jpg|png)$/i)?.[0] ?? "";
  const stem = file.slice(0, file.length - ext.length);
  const without = stem
    // "(Lord Lava; unreleased revamp)": the qualifier after the semicolon.
    .replace(/;[^;()]*\b(?:unreleased|upcoming|leak|advance|revamp)\b[^;()]*/i, "")
    // "(Original)", "(unreleased revamp)": a bracket holding only the marker.
    .replace(/\(\s*[^()]*\b(?:unreleased|upcoming|leak|advance|original|old|revamp)\b[^()]*\)/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!without || without === stem) return [];
  const names = new Set([`${without}${ext}`]);
  // "Masha Rogue Talon" → "Masha (Rogue Talon)": hero name, then the skin in brackets.
  const words = without.split(" ");
  if (!without.includes("(") && words.length > 1) names.add(`${words[0]} (${words.slice(1).join(" ")})${ext}`);
  return [...names];
}

function cleanLegend(raw) {
  const wiki = raw
    .split("|")
    .filter((s) => !/^\s*(link|alt|class)\s*=/i.test(s))
    .join("|")
    .replace(/<br\s*\/?>[\s\S]*$/i, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'{2,}/g, "");
  return removeTags(wiki).replace(/\s+/g, " ").trim();
}

/**
 * Comparison key for a skin name. The wiki caption and the data module do not
 * always agree on case or punctuation: « Vessel Of
 * Deceit » and « Vessel of Deceit » refer to the same skin.
 */
export function normalizeNameSkin(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * One id per skin across heroes. The wiki module keys each skin by its id,
 * but a copied entry can keep its model's `id` field: in October 2026, P.ACE
 * Cici (key 1234) still said 1255, P.ACE Zhuxin's id, and the collection
 * calculator, which stores owned skins by id, ticked both. On such a clash
 * between two heroes, the entry whose key differs from its `id` takes its key
 * — the one the wiki itself files it under. Colour variants share their base
 * skin's id within one hero, on purpose: they are left alone.
 *
 * `entries` holds { hero, key, id }; returns the ids to use, in order, and
 * the entries rewritten.
 */
export function distinctSkinIds(entries) {
  const heroesById = new Map();
  for (const e of entries) heroesById.set(e.id, (heroesById.get(e.id) ?? new Set()).add(e.hero));
  const ids = new Set(entries.map((e) => e.id));
  const rewritten = [];
  const result = entries.map((e) => {
    if (heroesById.get(e.id).size < 2 || e.key === e.id || ids.has(e.key)) return e.id;
    rewritten.push(e);
    ids.add(e.key);
    return e.key;
  });
  return { ids: result, rewritten };
}
