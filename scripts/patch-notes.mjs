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

/**
 * Decoupe le HTML nettoye en sections de premier niveau.
 *
 * Chaque titre h2 ouvre une section qui court jusqu'au h2 suivant, en gardant
 * ses sous-titres h3. Le decoupage laisse la page composer : rendre certaines
 * sections telles quelles, en remplacer d'autres par un composant riche.
 */
export function decouperSections(html) {
  const racine = parse(html);
  const sections = [];
  let courante = null;

  for (const noeud of racine.childNodes) {
    if (noeud.rawTagName === "h2") {
      courante = {
        anchor: noeud.getAttribute("id") ?? null,
        title: noeud.text.trim(),
        html: "",
      };
      sections.push(courante);
      continue;
    }

    // Contenu avant le premier h2 : on l'ouvre dans une section sans titre.
    if (!courante) {
      courante = { anchor: null, title: null, html: "" };
      sections.push(courante);
    }

    courante.html += noeud.toString();
  }

  return sections
    .map((s) => ({ ...s, html: s.html.trim() }))
    .filter((s) => s.title || s.html);
}

/**
 * Extrait la presentation structuree des nouveaux heros d'une section.
 *
 * Le wiki suit une grammaire reguliere : un sous-titre nomme le heros, un
 * paragraphe raconte son histoire et sa « Hero feature », puis chaque
 * competence est un paragraphe en gras — role et nom — suivi d'une liste de
 * descriptions. On la ramene a des donnees pour un affichage soigne.
 */
export function nouveauxHeros(sectionHtml) {
  const racine = parse(sectionHtml);
  const heros = [];
  let courant = null;

  for (const noeud of racine.childNodes) {
    const tag = noeud.rawTagName;

    if (tag === "h3") {
      // « New Hero: Fallen Scarlet - Hirara » → epithete « Fallen Scarlet »,
      // nom « Hirara ».
      const brut = noeud.text.trim().replace(/^New Hero\s*:\s*/i, "");
      const morceaux = brut.split(/\s[-–—]\s/);
      const nom = (morceaux.length > 1 ? morceaux.pop() : brut).trim();
      const epithete = morceaux.join(" - ").trim() || null;
      courant = {
        name: nom,
        epithet: epithete,
        anchor: noeud.getAttribute("id") ?? null,
        lore: [],
        feature: null,
        skills: [],
      };
      heros.push(courant);
      continue;
    }

    if (!courant) continue;

    if (tag === "p") {
      const gras = noeud.querySelector("b");
      const etiquette = gras ? gras.text.replace(/\s+/g, " ").trim() : "";

      if (gras && /(Passive|Skill|Combo|Ultimate|Ult\b)/i.test(etiquette)) {
        // « Passive - Twin Fans: Ukifune » → role puis nom de competence.
        const coupe = etiquette.search(/\s[-–—]\s/);
        const role = (coupe >= 0 ? etiquette.slice(0, coupe) : etiquette).trim();
        const nom =
          coupe >= 0 ? etiquette.slice(coupe).replace(/^\s[-–—]\s/, "").trim() : null;
        courant.skills.push({ role, name: nom, description: [] });
        continue;
      }

      // Paragraphe d'histoire : les lignes sont separees par des <br>, et la
      // derniere annonce souvent la « Hero feature ».
      for (const bloc of noeud.innerHTML.split(/<br\s*\/?>/i)) {
        const ligne = parse(bloc).text.replace(/\s+/g, " ").trim();
        if (!ligne) continue;
        const feature = ligne.match(/^Hero feature\s*:\s*(.+)$/i);
        if (feature) courant.feature = feature[1].trim();
        else courant.lore.push(ligne);
      }
      continue;
    }

    if (tag === "ul") {
      const derniere = courant.skills.at(-1);
      if (!derniere) continue;
      for (const item of noeud.querySelectorAll("li")) {
        const texte = item.text.replace(/\s+/g, " ").trim();
        if (texte) derniere.description.push(texte);
      }
    }
  }

  return heros;
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
      level: t.rawTagName === "h2" ? 2 : 3,
      title: t.text.trim(),
      anchor: t.getAttribute("id") ?? null,
    }))
    .filter((t) => t.anchor && t.title.length > 0 && t.title.length < 120);
}
