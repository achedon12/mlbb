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

  for (const title of wikitext.matchAll(/^(=+)\s*(?:splash arts?|artworks?)\s*=+[ \t]*$/gim)) {
    const level = title[1].length;
    const run = wikitext.slice(title.index + title[0].length);
    // The section runs up to the next heading of the same or a higher level;
    // its subsections belong to it.
    const end = run.search(new RegExp(`^={1,${level}}[^=]`, "m"));
    const section = end === -1 ? run : run.slice(0, end);

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
