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
