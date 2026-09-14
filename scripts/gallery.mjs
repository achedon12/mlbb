import { removeTags } from "./tags.mjs";

/**
 * Illustrations pleine taille d'une page de heros du wiki.
 *
 * Les pages ne suivent pas toutes le meme gabarit : la section s'appelle
 * « Splash art », « Splash arts » ou « Artwork », elle s'ouvre parfois sur une
 * note, et empile souvent plusieurs galeries (visuels actuels, puis anciens).
 * Les lignes omettent parfois le prefixe « File: », et les legendes portent du
 * balisage — liens, gras, seconde ligne de precision.
 */
export function extractIllustrations(wikitext) {
  const output = [];
  const seen = new Set();

  for (const title of wikitext.matchAll(/^(=+)\s*(?:splash arts?|artworks?)\s*=+[ \t]*$/gim)) {
    const level = title[1].length;
    const run = wikitext.slice(title.index + title[0].length);
    // La section court jusqu'au prochain titre de meme niveau ou plus haut ;
    // ses sous-sections en font partie.
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
 * Cle de comparaison d'un nom de skin. Legende du wiki et module de donnees ne
 * s'accordent pas toujours sur la casse ou la ponctuation : « Vessel Of
 * Deceit » et « Vessel of Deceit » designent le meme skin.
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
