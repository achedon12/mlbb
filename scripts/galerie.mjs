import { retirerBalises } from "./balises.mjs";

/**
 * Illustrations pleine taille d'une page de heros du wiki.
 *
 * Les pages ne suivent pas toutes le meme gabarit : la section s'appelle
 * « Splash art », « Splash arts » ou « Artwork », elle s'ouvre parfois sur une
 * note, et empile souvent plusieurs galeries (visuels actuels, puis anciens).
 * Les lignes omettent parfois le prefixe « File: », et les legendes portent du
 * balisage — liens, gras, seconde ligne de precision.
 */
export function extraireIllustrations(wikitexte) {
  const sortie = [];
  const vus = new Set();

  for (const titre of wikitexte.matchAll(/^(=+)\s*(?:splash arts?|artworks?)\s*=+[ \t]*$/gim)) {
    const niveau = titre[1].length;
    const suite = wikitexte.slice(titre.index + titre[0].length);
    // La section court jusqu'au prochain titre de meme niveau ou plus haut ;
    // ses sous-sections en font partie.
    const fin = suite.search(new RegExp(`^={1,${niveau}}[^=]`, "m"));
    const section = fin === -1 ? suite : suite.slice(0, fin);

    for (const galerie of section.matchAll(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi)) {
      for (const ligne of galerie[1].matchAll(/^[ \t]*(?:File:|Image:)?([^|\n]+?\.(?:jpg|png))[ \t]*\|(.*)$/gim)) {
        const fichier = ligne[1].trim();
        const skin = nettoyerLegende(ligne[2]);
        if (!skin || vus.has(fichier)) continue;
        vus.add(fichier);
        sortie.push({ fichier, skin });
      }
    }
  }
  return sortie;
}

function nettoyerLegende(brut) {
  const wiki = brut
    .split("|")
    .filter((s) => !/^\s*(link|alt|class)\s*=/i.test(s))
    .join("|")
    .replace(/<br\s*\/?>[\s\S]*$/i, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'{2,}/g, "");
  return retirerBalises(wiki).replace(/\s+/g, " ").trim();
}

/**
 * Cle de comparaison d'un nom de skin. Legende du wiki et module de donnees ne
 * s'accordent pas toujours sur la casse ou la ponctuation : « Vessel Of
 * Deceit » et « Vessel of Deceit » designent le meme skin.
 */
export function normaliserNomSkin(nom) {
  return nom
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}
