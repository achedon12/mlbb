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
const TO_DELETE = [
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

export function cleanRender(html, origin) {
  const root = parse(html);

  for (const picker of TO_DELETE) {
    for (const node of root.querySelectorAll(picker)) node.remove();
  }

  // Les liens relatifs du wiki pointeraient dans le vide une fois recopies :
  // on les rend absolus, et on marque leur caractere externe.
  for (const link of root.querySelectorAll("a")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("/wiki/")) {
      link.setAttribute("href", `https://mobilelegends.fandom.com${href}`);
    } else if (href.startsWith("#") || href === "") {
      // Ancre vers une section supprimee : on garde le texte, pas le lien.
      link.replaceWith(link.innerHTML);
      continue;
    }
    link.setAttribute("rel", "noreferrer nofollow");
    link.setAttribute("target", "_blank");
  }

  // Les images du wiki sont chargees en differe par un attribut maison ; sans
  // le script du wiki, elles resteraient vides. On les retire.
  for (const image of root.querySelectorAll("img")) image.remove();

  // Les classes du wiki n'ont aucun sens dans notre feuille de style.
  for (const node of root.querySelectorAll("[class]")) {
    node.removeAttribute("class");
  }
  for (const node of root.querySelectorAll("[style]")) {
    node.removeAttribute("style");
  }
  // Les identifiants du wiki servent ses propres ancres ; on les remplace par
  // les notres plus bas.
  for (const node of root.querySelectorAll("[id]")) node.removeAttribute("id");

  // Chaque titre recoit une ancre : sans elle, un sommaire ne peut pointer
  // nulle part, et une note de patch fait plusieurs dizaines de milliers de
  // caracteres.
  const seen = new Set();
  for (const title of root.querySelectorAll("h2, h3, h4")) {
    const text = title.text.trim();
    if (!text) continue;

    let anchor = toAnchor(text);
    // Deux sections peuvent porter le meme nom dans une meme page.
    let suffix = 2;
    while (seen.has(anchor)) anchor = `${toAnchor(text)}-${suffix++}`;
    seen.add(anchor);

    title.setAttribute("id", anchor);
  }

  const content = root.querySelector(".mw-parser-output") ?? root;
  const text = content.innerHTML
    .replace(/<div[^>]*>|<\/div>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { html: text, origin };
}

/**
 * Decoupe le HTML nettoye en sections de premier niveau.
 *
 * Chaque titre h2 ouvre une section qui court jusqu'au h2 suivant, en gardant
 * ses sous-titres h3. Le decoupage laisse la page composer : rendre certaines
 * sections telles quelles, en remplacer d'autres par un composant riche.
 */
export function splitSections(html) {
  const root = parse(html);
  const sections = [];
  let current = null;

  for (const node of root.childNodes) {
    if (node.rawTagName === "h2") {
      current = {
        anchor: node.getAttribute("id") ?? null,
        title: node.text.trim(),
        html: "",
      };
      sections.push(current);
      continue;
    }

    // Contenu avant le premier h2 : on l'ouvre dans une section sans titre.
    if (!current) {
      current = { anchor: null, title: null, html: "" };
      sections.push(current);
    }

    current.html += node.toString();
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
export function newHeroes(sectionHtml) {
  const root = parse(sectionHtml);
  const heroes = [];
  let current = null;

  for (const node of root.childNodes) {
    const tag = node.rawTagName;

    if (tag === "h3") {
      // « New Hero: Fallen Scarlet - Hirara » → epithete « Fallen Scarlet »,
      // nom « Hirara ».
      const raw = node.text.trim().replace(/^New Hero\s*:\s*/i, "");
      const chunks = raw.split(/\s[-–—]\s/);
      const name = (chunks.length > 1 ? chunks.pop() : raw).trim();
      const epithet = chunks.join(" - ").trim() || null;
      current = {
        name,
        epithet,
        anchor: node.getAttribute("id") ?? null,
        lore: [],
        feature: null,
        skills: [],
      };
      heroes.push(current);
      continue;
    }

    if (!current) continue;

    if (tag === "p") {
      const bold = node.querySelector("b");
      const label = bold ? bold.text.replace(/\s+/g, " ").trim() : "";

      if (bold && /(Passive|Skill|Combo|Ultimate|Ult\b)/i.test(label)) {
        // « Passive - Twin Fans: Ukifune » → role puis nom de competence.
        const cut = label.search(/\s[-–—]\s/);
        const role = (cut >= 0 ? label.slice(0, cut) : label).trim();
        const name =
          cut >= 0 ? label.slice(cut).replace(/^\s[-–—]\s/, "").trim() : null;
        current.skills.push({ role, name, description: [] });
        continue;
      }

      // Paragraphe d'histoire : les lignes sont separees par des <br>, et la
      // derniere annonce souvent la « Hero feature ».
      for (const block of node.innerHTML.split(/<br\s*\/?>/i)) {
        const row = parse(block).text.replace(/\s+/g, " ").trim();
        if (!row) continue;
        const feature = row.match(/^Hero feature\s*:\s*(.+)$/i);
        if (feature) current.feature = feature[1].trim();
        else current.lore.push(row);
      }
      continue;
    }

    if (tag === "ul") {
      const last = current.skills.at(-1);
      if (!last) continue;
      for (const item of node.querySelectorAll("li")) {
        const text = item.text.replace(/\s+/g, " ").trim();
        if (text) last.description.push(text);
      }
    }
  }

  return heroes;
}

/** Identifiant d'ancre stable, derive du titre. */
function toAnchor(text) {
  return text
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
export function toc(html) {
  return parse(html)
    .querySelectorAll("h2, h3")
    .map((t) => ({
      level: t.rawTagName === "h2" ? 2 : 3,
      title: t.text.trim(),
      anchor: t.getAttribute("id") ?? null,
    }))
    .filter((t) => t.anchor && t.title.length > 0 && t.title.length < 120);
}
