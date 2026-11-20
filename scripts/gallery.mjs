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
 * a test-server, advanced-server, beta or leaked visual, a pre-release
 * teaser or sneak peek, a draft or a prototype, a fan work, a
 * concept sketch, or the pre-revamp version kept for the record ("Masha
 * Rogue Talon (Original).jpg"). Skin names carry none of these words (checked
 * against the catalogue of November 2026: "Proto Sentinel", "Angelic Fan" and
 * "New Moon" are not caught).
 */
const PROVISIONAL =
  /\b(unreleased|upcoming|leak(?:ed|s)?|advanced?[ -]server|test[ -]server|beta|pre-?release|sneak[ -]?peeks?|teasers?|drafts?|prototypes?|work in progress|fan[ -]?art|fan[ -]?made|concept|wip)\b|\(original\)|\(old\)|\bpre-revamp\b/i;

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
    .replace(/;[^;()]*\b(?:unreleased|upcoming|leak|advance|revamp|beta|teaser|draft)\b[^;()]*/i, "")
    // "(Original)", "(unreleased revamp)": a bracket holding only the marker.
    .replace(/\(\s*[^()]*\b(?:unreleased|upcoming|leak|advance|original|old|revamp|beta|teaser|draft)\b[^()]*\)/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!without || without === stem) return [];
  const names = new Set([`${without}${ext}`]);
  // "Masha Rogue Talon" → "Masha (Rogue Talon)": hero name, then the skin in brackets.
  const words = without.split(" ");
  if (!without.includes("(") && words.length > 1) names.add(`${words[0]} (${words.slice(1).join(" ")})${ext}`);
  return [...names];
}

/**
 * Words that mark a wiki file as an altered copy of an artwork rather than
 * the artwork Moonton published: a beta or unfinished version ("Arlott
 * Splash Art Unfinished.png"), an edit ("Aldous Death-picsay.png", PicSay
 * being a phone photo editor), a crop or an upscale, and an older version
 * the wiki keeps under its years of use ("Kadita (Ocean Goddess;
 * 2018-2026).jpg"); a third party's copy too: a screenshot, a watermarked,
 * resized or stretched copy, a wallpaper cut from the artwork, a fan edit.
 * Only checked for full-size artwork: an icon's description has no reason
 * to use these words.
 */
const ALTERED =
  /\b(?:beta|unfinished|edit(?:ed)?|crop(?:ped)?|upscaled?|retouched|resized|stretched|watermark(?:ed)?|screen(?:shot|cap)s?|wallpapers?|fan[ -]?edit)\b|picsay|[(;]\s*\d{4}\s*[-–]\s*\d{4}\s*\)/i;

/**
 * Smallest width of an artwork the site shows full size. The official
 * artworks the wiki keeps are 1280 to 4000 pixels wide; the few below 960
 * (Miya "Captain Thorns", 554 x 334) are crops of a screenshot or of a
 * social media post.
 */
export const ARTWORK_MIN_WIDTH = 960;
/** Splash arts are drawn 16:9 (1.78), a few 16:10 or a little wider: anything else is a crop or a poster. */
const ARTWORK_RATIO = [1.5, 2.1];

/**
 * Why a full-size artwork is not the published one, or null: an altered
 * copy (`ALTERED`, from its name, description, upload comment or
 * categories), or a picture too small or of the wrong shape to be the
 * artwork itself. `width` and `height` are those of the wiki's current
 * version; unknown, they are not held against the file.
 */
export function alteredArtwork({ name = "", description = "", comment = "", categories = [], width, height } = {}) {
  if ([name, description, comment, ...categories].some((text) => ALTERED.test(String(text ?? "")))) return "altered";
  if (width && height) {
    const ratio = width / height;
    if (width < ARTWORK_MIN_WIDTH || ratio < ARTWORK_RATIO[0] || ratio > ARTWORK_RATIO[1]) return "low-resolution";
  }
  return null;
}

/**
 * The hero a wiki file is named after, out of `names`, or null: the longest
 * name the file starts with ("Selena (Gemini - Shadow).jpg" → "Selena").
 */
export function heroOfFile(file, names) {
  const stem = file.replace(/^File:/i, "").toLowerCase();
  let found = null;
  for (const name of names) {
    const n = name.toLowerCase();
    const next = stem.charAt(n.length);
    if (stem.startsWith(n) && (next === "" || next === " " || next === "(") && (!found || n.length > found.length)) found = name;
  }
  return found;
}

/**
 * The wiki's usual name for a skin's artwork, "Karina (Gemini - Halo).jpg":
 * the file a hero page should point to. Tried when the gallery points to an
 * altered copy, to another hero's artwork (Karina's "Gemini - Halo" row shows
 * "Selena (Gemini - Shadow).jpg") or to a file that does not exist.
 */
export function usualFileName(hero, skin) {
  return `${hero} (${skin}).jpg`;
}

/**
 * Gallery rows of a hero page, in the order the sync tries them for each
 * skin: the first file that exists and is neither provisional nor altered
 * is the skin's artwork. A provisional or altered row gives way to the live
 * files it stands next to and to the usual name; a row that shows another
 * hero's artwork tries the hero's own file first, and is kept after it for
 * a shared artwork (Freya's "Christmas Carnival" is "Zilong (Christmas
 * Carnival).jpg", drawn for both); any other row is tried first, the usual
 * name after it in case the file is gone. `heroes` holds every hero name.
 */
export function candidateRows(rows, hero, heroes) {
  return rows.flatMap(({ file, skin }) => {
    const usual = usualFileName(hero, skin);
    const own = usual === file ? [] : [{ file: usual, skin, fallback: true }];
    if (isProvisionalFile({ name: file }) || alteredArtwork({ name: file })) {
      return [...fallbackFileNames(file).map((f) => ({ file: f, skin, fallback: true })), ...own].filter(
        (r, i, all) => all.findIndex((o) => o.file === r.file) === i,
      );
    }
    const of = heroOfFile(file, heroes);
    if (of && of !== hero) return [...own, { file, skin }];
    return [{ file, skin }, ...own];
  });
}

/**
 * Artworks checked by hand, kept off the site by hero and wiki file: each
 * one is caught by the rules above at the next sync (and replaced by the
 * hero's own file when the wiki has it), but a catalogue an older sync wrote
 * still holds it. Evidence is the wiki's file page, as of November 2026.
 */
export const WITHHELD_ARTWORKS = [
  {
    hero: "karina",
    file: "File:Selena (Gemini - Shadow).jpg",
    reason: "Selena's artwork under Karina's Gemini - Halo; Karina's own is File:Karina (Gemini - Halo).jpg",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Karina_(Gemini_-_Halo).jpg",
  },
  {
    hero: "alucard",
    file: "File:Miya (Sweet Fantasy).jpg",
    reason: "Miya's artwork under Alucard's Romantic Fantasy; Alucard's own is File:Alucard (Romantic Fantasy).jpg",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Alucard_(Romantic_Fantasy).jpg",
  },
  {
    hero: "akai",
    file: "File:Akai (Street Enforcer).jpg",
    reason: "696 x 392 crop",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Akai_(Street_Enforcer).jpg",
  },
  {
    hero: "baxia",
    file: "File:Baxia (Black Tortoise).jpg",
    reason: "800 x 449 crop",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Baxia_(Black_Tortoise).jpg",
  },
  {
    hero: "bruno",
    file: "File:Bruno (Street Football).jpg",
    reason: "768 x 432 crop",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Bruno_(Street_Football).jpg",
  },
  {
    hero: "clint",
    file: "File:Clint (Summer Blast).jpg",
    reason: "739 x 415 crop",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Clint_(Summer_Blast).jpg",
  },
  {
    hero: "fanny",
    file: "File:Fanny (Summer Rescue).jpg",
    reason: "739 x 415 crop",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Fanny_(Summer_Rescue).jpg",
  },
  {
    hero: "miya",
    file: "File:Miya (Captain Thorns).jpg",
    reason: "554 x 334 crop, not 16:9",
    evidence: "https://mobile-legends.fandom.com/wiki/File:Miya_(Captain_Thorns).jpg",
  },
];

const withheld = new Set(WITHHELD_ARTWORKS.map((w) => `${w.hero}:${w.file.replace(/^File:/i, "")}`));

/** Whether the artwork of `hero` made from wiki file `file` is on the hand-checked list. */
export function isWithheldArtwork(hero, file) {
  return withheld.has(`${hero}:${String(file).replace(/^File:/i, "")}`);
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
