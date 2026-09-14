/**
 * Conversion du wikitexte en texte lisible.
 *
 * Les descriptions de competences melangent des liens internes, des gabarits
 * de mise en forme et des annotations de calcul (`{{scale|...}}`) qui n'ont de
 * sens que sur le wiki. On garde la phrase, on jette la mecanique d'affichage.
 */
/**
 * Retire toute balise HTML, jusqu'a stabilite.
 *
 * Un unique passage laisserait passer les balises imbriquees — retirer
 * `<a<b>c>` peut recreer une balise valide. On repete donc tant que la chaine
 * change, si bien qu'aucun `<...>` ne subsiste.
 */
export function withoutTags(text) {
  let output = String(text);
  let before;
  do {
    before = output;
    output = output.replace(/<[^>]*>/g, "");
  } while (output !== before);
  return output;
}

export function cleanDescription(raw) {
  const withoutHtml = withoutTags(
    String(raw)
      // Annotations de calcul : elles decrivent une formule, pas un effet.
      .replace(/\{\{scale\|[^}]*\}\}/gi, "")
      // Gabarits de mise en valeur : seul le texte compte.
      .replace(/\{\{[Bb]\|([^}]*)\}\}/g, "$1")
      .replace(/\{\{(?:hi|ii|Hi|II)\|([^}]*)\}\}/g, "$1")
      // Liens internes, avec ou sans libelle.
      .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
      .replace(/\[\[([^\]]*)\]\]/g, "$1")
      .replace(/<nowiki>([\s\S]*?)<\/nowiki>/g, "$1")
      .replace(/<br\s*\/?>/gi, " "),
  );
  return (
    withoutHtml
      // Italique et gras du wikitexte.
      .replace(/'{2,}/g, "")
      .replace(/&ndash;/g, "–")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      // Gabarit inconnu : on garde son premier argument, qui est le texte
      // affiche par convention. Prendre tout ce qui suit la premiere barre
      // laisserait les separateurs des gabarits a plusieurs arguments —
      // « cannot be targeted|untargetable » au lieu de « cannot be targeted ».
      .replace(/\{\{[^}|]*\|([^}|]*)(?:\|[^}]*)?\}\}/g, "$1")
      // Gabarit sans argument : il ne porte aucun texte.
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\s+/g, " ")
      // Le retrait des annotations laisse un blanc avant le pourcentage.
      .replace(/\s+%/g, "%")
      .replace(/\s+([.,;:])/g, "$1")
      .trim()
  );
}

// ─────────────────────────────────────────────────────────────
// Histoire des heros : lore, fiche narrative, anecdotes
// ─────────────────────────────────────────────────────────────

const MONTH = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

/**
 * Retire ce qui n'a de sens que sur le wiki : les references (souvent de
 * longs blocs avec galeries), les gabarits d'annotation et les marqueurs de
 * mise en page. Le reste du nettoyage reste a la charge de l'appelant.
 */
function withoutCruft(raw) {
  return removeLinksFile(String(raw))
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<gallery[^>]*>[\s\S]*?<\/gallery>/gi, "")
    .replace(/\{\{(?:clr|cite|retcon|translation|main|see also)\b[^}]*\}\}/gi, "")
    // Liens externes : on garde le libelle, on jette l'URL.
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/&sect;/g, "§")
    .replace(/&mdash;/g, "—");
}

const EXTENSIONS_IMAGE = /\.(?:png|jpe?g|gif|svg|webp)$/i;

/**
 * Retire les liens d'image, par comptage de crochets : leur legende peut
 * contenir des liens imbriques qu'une expression reguliere simple couperait
 * au mauvais endroit. Le wiki les ecrit de deux facons — prefixees
 * (`[[File:...]]`, `[[Image:...]]`) ou par simple nom de fichier
 * (`[[Layla lore.png|center|512px]]`) — reconnues ici a l'extension.
 */
function removeLinksFile(text) {
  const re = /\[\[/g;
  let output = text;
  let m;
  while ((m = re.exec(output)) !== null) {
    const start = m.index;
    let depth = 0;
    let k = start;
    for (; k < output.length; k += 1) {
      if (output[k] === "[" && output[k + 1] === "[") { depth += 1; k += 1; }
      else if (output[k] === "]" && output[k + 1] === "]") {
        depth -= 1;
        k += 1;
        if (depth === 0) { k += 1; break; }
      }
    }
    const target = output.slice(start + 2, k - 2).split("|")[0].trim();
    if (/^(?:File|Image):/i.test(target) || EXTENSIONS_IMAGE.test(target)) {
      output = output.slice(0, start) + output.slice(k);
      re.lastIndex = start;
    } else {
      re.lastIndex = start + 2;
    }
  }
  return output;
}

/** Retire entierement un gabarit `{{Nom ...}}` du texte, imbrications comprises. */
function removeTemplate(text, name) {
  const re = new RegExp(`\\{\\{${name}\\b`, "i");
  const m = re.exec(text);
  if (!m) return text;
  const start = m.index;
  let depth = 0;
  for (let k = start; k < text.length; k += 1) {
    if (text[k] === "{" && text[k + 1] === "{") { depth += 1; k += 1; }
    else if (text[k] === "}" && text[k + 1] === "}") {
      depth -= 1;
      k += 1;
      if (depth === 0) return text.slice(0, start) + text.slice(k + 1);
    }
  }
  return text;
}

/**
 * Le lore d'un heros, rendu en paragraphes lisibles.
 *
 * On separe d'abord sur les lignes vides, puis on nettoie chaque paragraphe
 * comme une description : ainsi les coupures de paragraphe survivent au
 * passage, la ou `nettoyerDescription` seule aplatirait tout en une ligne.
 */
export function cleanLore(raw) {
  return withoutCruft(raw)
    .split(/\n{2,}/)
    .map((p) => cleanDescription(p))
    .filter((p) => p && p.length > 1);
}

/**
 * Extrait le corps d'un gabarit `{{Nom ...}}` par comptage d'accolades, seul
 * moyen fiable quand le gabarit en imbrique d'autres.
 */
function bodyTemplate(wikitext, name) {
  const re = new RegExp(`\\{\\{${name}\\b`, "i");
  const m = re.exec(wikitext);
  if (!m) return null;

  const start = m.index;
  let depth = 0;
  for (let k = start; k < wikitext.length; k += 1) {
    if (wikitext[k] === "{" && wikitext[k + 1] === "{") {
      depth += 1;
      k += 1;
    } else if (wikitext[k] === "}" && wikitext[k + 1] === "}") {
      depth -= 1;
      k += 1;
      if (depth === 0) return wikitext.slice(start + 2, k - 1);
    }
  }
  return null;
}

/**
 * Decoupe le corps d'un gabarit en champs `nom = valeur`. La coupe se fait sur
 * les barres de premier niveau : une barre a l'interieur d'un gabarit imbrique
 * ou d'un lien appartient a la valeur, pas a la structure.
 */
function fieldsTemplate(body) {
  const fields = {};
  let depth = 0;
  let brackets = 0;
  let start = 0;
  const chunks = [];
  for (let k = 0; k < body.length; k += 1) {
    const a = body[k];
    const b = body[k + 1];
    if (a === "{" && b === "{") { depth += 1; k += 1; }
    else if (a === "}" && b === "}") { depth -= 1; k += 1; }
    else if (a === "[" && b === "[") { brackets += 1; k += 1; }
    else if (a === "]" && b === "]") { brackets -= 1; k += 1; }
    else if (a === "|" && depth === 0 && brackets === 0) {
      chunks.push(body.slice(start, k));
      start = k + 1;
    }
  }
  chunks.push(body.slice(start));

  for (const chunk of chunks) {
    const equal = chunk.indexOf("=");
    if (equal === -1) continue;
    const key = chunk.slice(0, equal).trim().toLowerCase();
    const value = chunk.slice(equal + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

/** Un champ dont la valeur est une liste `*element` devient un tableau nettoye. */
function elementsList(value) {
  if (!value) return [];
  const raw = withoutCruft(value);
  if (/^\s*\*/.test(raw)) {
    return raw
      .split(/\n(?=\s*\*)/)
      .map((l) => cleanDescription(l.replace(/^\s*\*+\s*/, "")))
      .filter((l) => l && l.length > 1);
  }
  const alone = cleanDescription(raw);
  return alone ? [alone] : [];
}

/** `{{birthday|7|28}}` devient « 28 juillet » ; les autres formes restent brutes. */
function anniversary(value) {
  if (!value) return null;
  const m = value.match(/\{\{birthday\|(\d{1,2})\|(\d{1,2})\}\}/i);
  if (m) {
    const month = MONTH[Number(m[1]) - 1];
    if (month) return `${Number(m[2])} ${month}`;
  }
  const light = cleanDescription(withoutCruft(value));
  return light || null;
}

const GENRES = { male: "Homme", female: "Femme", "n/a": null, none: null };

/** Localise les entrees de la fiche : la valeur brute d'abord, sinon rien. */
function textField(value) {
  if (!value) return null;
  const light = cleanDescription(withoutCruft(value));
  return light || null;
}

/**
 * Reconstruit la fiche narrative d'un heros a partir de son gabarit
 * `{{Infobox hero story}}`. Chaque champ est optionnel : le wiki les remplit
 * de facon inegale d'un heros a l'autre.
 */
export function sheetStory(wikitext) {
  const body = bodyTemplate(wikitext, "Infobox hero story");
  if (!body) return null;
  // On retire references et galeries avant le decoupage : leurs barres
  // internes ne sont pas des separateurs de champs et fausseraient la coupe.
  const c = fieldsTemplate(withoutCruft(body));

  const genreRaw = textField(c.gender)?.toLowerCase();
  const sheet = {
    fullName: textField(c.full_name),
    title: textField(c.title),
    species: textField(c.species),
    gender: genreRaw ? (GENRES[genreRaw] ?? textField(c.gender)) : null,
    age: textField(c.age),
    origin: textField(c.born),
    birthday: anniversary(c.birthday),
    affiliations: elementsList(c.affiliation),
    relations: elementsList(c.relationships),
    powers: elementsList(c.abilities),
  };

  // Une fiche entierement vide ne merite pas d'etre conservee.
  const useful = Object.values(sheet).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v),
  );
  return useful ? sheet : null;
}

/**
 * Renvoie le contenu d'une section de premier niveau, borne au prochain titre
 * de niveau egal ou superieur. `titres` liste les intitules acceptes, essayes
 * dans l'ordre.
 */
export function sectionWiki(wikitext, titles) {
  const headers = [
    ...wikitext.matchAll(/^(=+)\s*(.+?)\s*=+\s*$/gm),
  ].map((m) => ({ position: m.index, end: m.index + m[0].length, level: m[1].length, title: m[2].trim().toLowerCase() }));

  for (const wanted of titles.map((t) => t.toLowerCase())) {
    const i = headers.findIndex((e) => e.title === wanted);
    if (i === -1) continue;
    const current = headers[i];
    const next = headers.slice(i + 1).find((e) => e.level <= current.level);
    return wikitext.slice(current.end, next ? next.position : undefined).trim();
  }
  return null;
}

/**
 * Assemble l'histoire d'un heros : le lore en paragraphes, la fiche narrative
 * et les anecdotes. Renvoie `null` si la page n'offre rien d'exploitable.
 */
export function extractStory(wikitext) {
  // La prose vit dans la sous-section « Lore ». A defaut, certains heros la
  // placent directement sous « Story », melee au gabarit de fiche : on le
  // retire pour ne garder que le recit.
  const rawLore = sectionWiki(wikitext, ["Lore", "Story"]);
  const lore = rawLore ? cleanLore(removeTemplate(rawLore, "Infobox hero story")) : [];

  const rawTrivia = sectionWiki(wikitext, ["Trivia"]);
  const trivia = rawTrivia
    ? withoutCruft(rawTrivia)
        .split(/\n(?=\s*\*)/)
        .map((l) => cleanDescription(l.replace(/^\s*\*+\s*/, "")))
        .filter((l) => l && l.length > 4)
    : [];

  const sheet = sheetStory(wikitext);

  if (!lore.length && !trivia.length && !sheet) return null;
  return { lore, sheet, trivia };
}

// ─────────────────────────────────────────────────────────────
// Sections d'une page (modes de jeu)
// ─────────────────────────────────────────────────────────────

/** Retire les tables wiki `{| … |}`, imbrications comprises. */
function withoutTables(text) {
  let output = String(text);
  let before;
  do {
    before = output;
    output = output.replace(/\{\|(?:[^{]|\{(?!\|))*?\|\}/g, "");
  } while (output !== before);
  return output;
}

/**
 * Transforme le corps d'une section en une suite de blocs : chaque bloc est un
 * paragraphe (`p`) ou un point de liste (`li`), deja nettoye. Les tables,
 * galeries, images et references sont ecartees.
 */
export function blocksSection(body) {
  const clean = withoutTables(withoutCruft(body));
  const blocks = [];
  let paragraph = [];

  const clearParagraph = () => {
    if (!paragraph.length) return;
    const text = cleanDescription(paragraph.join(" "));
    if (text && text.length > 1) blocks.push({ type: "p", text });
    paragraph = [];
  };

  for (const row of clean.split("\n")) {
    const l = row.trim();
    if (!l) {
      clearParagraph();
      continue;
    }
    if (/^[*#]+/.test(l)) {
      clearParagraph();
      const text = cleanDescription(l.replace(/^[*#]+\s*/, ""));
      if (text && text.length > 1) blocks.push({ type: "li", text });
      continue;
    }
    // Titres residuels, gabarits isoles : sans interet ici.
    if (/^=+/.test(l) || /^\{\{/.test(l) || /^\|/.test(l)) {
      clearParagraph();
      continue;
    }
    paragraph.push(l);
  }
  clearParagraph();
  return blocks;
}

/**
 * Decoupe une page en sections de premier niveau (`==`), chacune rendue en
 * blocs. Les intitules listes dans `ignorer` (en minuscules) sont sautes.
 */
export function sectionsPage(wikitext, ignore = []) {
  const toSkip = new Set(ignore.map((s) => s.toLowerCase()));
  const headers = [
    ...wikitext.matchAll(/^(={2,})\s*(.+?)\s*=+\s*$/gm),
  ].map((m) => ({ position: m.index, end: m.index + m[0].length, level: m[1].length, title: m[2].trim() }));

  const sections = [];
  for (let i = 0; i < headers.length; i += 1) {
    const e = headers[i];
    if (e.level !== 2) continue;
    if (toSkip.has(e.title.toLowerCase())) continue;

    const next = headers.slice(i + 1).find((x) => x.level <= 2);
    const body = wikitext.slice(e.end, next ? next.position : undefined);
    const elements = blocksSection(body);
    if (elements.length) sections.push({ title: e.title, elements });
  }
  return sections;
}
