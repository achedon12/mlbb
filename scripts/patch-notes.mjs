/**
 * Recuperation du contenu des patch notes.
 *
 * Le wiki rend lui-meme son wikitext en HTML : on lui demande le rendu plutot
 * que d'ecrire un analyseur de wikitext, puis on nettoie ce qui n'a de sens
 * que sur le wiki — liens d'edition, infobox, navigation, ancres internes.
 *
 * Le resultat est du HTML sobre : titres, paragraphes, listes, tableaux.
 */
import { parse } from "node-html-parser";

/** Elements sans aucun interet hors du wiki. */
const A_SUPPRIMER = [
  ".mw-editsection",
  ".navbox",
  ".portable-infobox",
  ".infobox",
  ".toc",
  ".reference",
  ".references",
  ".mw-references-wrap",
  "script",
  "style",
  ".noprint",
  ".mw-empty-elt",
  "#toc",
  ".hatnote",
];

export function nettoyerRendu(html, origine) {
  const racine = parse(html);

  for (const selecteur of A_SUPPRIMER) {
    for (const noeud of racine.querySelectorAll(selecteur)) noeud.remove();
  }

  // Les liens relatifs du wiki pointeraient dans le vide une fois recopies :
  // on les rend absolus, et on marque leur caractere externe.
  for (const lien of racine.querySelectorAll("a")) {
    const href = lien.getAttribute("href") ?? "";
    if (href.startsWith("/wiki/")) {
      lien.setAttribute("href", `https://mobilelegends.fandom.com${href}`);
    } else if (href.startsWith("#") || href === "") {
      // Ancre vers une section supprimee : on garde le texte, pas le lien.
      lien.replaceWith(lien.innerHTML);
      continue;
    }
    lien.setAttribute("rel", "noreferrer nofollow");
    lien.setAttribute("target", "_blank");
  }

  // Les images du wiki sont chargees en differe par un attribut maison ; sans
  // le script du wiki, elles resteraient vides. On les retire.
  for (const image of racine.querySelectorAll("img")) image.remove();

  // Les classes du wiki n'ont aucun sens dans notre feuille de style.
  for (const noeud of racine.querySelectorAll("[class]")) {
    noeud.removeAttribute("class");
  }
  for (const noeud of racine.querySelectorAll("[style]")) {
    noeud.removeAttribute("style");
  }
  // Les identifiants du wiki servent ses propres ancres ; on les remplace par
  // les notres plus bas.
  for (const noeud of racine.querySelectorAll("[id]")) noeud.removeAttribute("id");

  // Chaque titre recoit une ancre : sans elle, un sommaire ne peut pointer
  // nulle part, et une note de patch fait plusieurs dizaines de milliers de
  // caracteres.
  const vus = new Set();
  for (const titre of racine.querySelectorAll("h2, h3, h4")) {
    const texte = titre.text.trim();
    if (!texte) continue;

    let ancre = ancrer(texte);
    // Deux sections peuvent porter le meme nom dans une meme page.
    let suffixe = 2;
    while (vus.has(ancre)) ancre = `${ancrer(texte)}-${suffixe++}`;
    vus.add(ancre);

    titre.setAttribute("id", ancre);
  }

  const contenu = racine.querySelector(".mw-parser-output") ?? racine;
  const texte = contenu.innerHTML
    .replace(/<div[^>]*>|<\/div>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { html: texte, origine };
}

/** Identifiant d'ancre stable, derive du titre. */
function ancrer(texte) {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Sommaire de la page, deux niveaux.
 *
 * Il est construit apres le nettoyage, donc sur les ancres reellement
 * presentes dans le document : un sommaire qui pointe a cote serait pire que
 * pas de sommaire.
 */
export function sommaire(html) {
  return parse(html)
    .querySelectorAll("h2, h3")
    .map((t) => ({
      niveau: t.rawTagName === "h2" ? 2 : 3,
      titre: t.text.trim(),
      ancre: t.getAttribute("id") ?? null,
    }))
    .filter((t) => t.ancre && t.titre.length > 0 && t.titre.length < 120);
}
