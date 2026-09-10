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
export function sansBalises(texte) {
  let sortie = String(texte);
  let avant;
  do {
    avant = sortie;
    sortie = sortie.replace(/<[^>]*>/g, "");
  } while (sortie !== avant);
  return sortie;
}

export function nettoyerDescription(brut) {
  const sansHtml = sansBalises(
    String(brut)
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
    sansHtml
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

const MOIS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

/**
 * Retire ce qui n'a de sens que sur le wiki : les references (souvent de
 * longs blocs avec galeries), les gabarits d'annotation et les marqueurs de
 * mise en page. Le reste du nettoyage reste a la charge de l'appelant.
 */
function sansScories(brut) {
  return enleverLiensFichier(String(brut))
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
function enleverLiensFichier(texte) {
  const re = /\[\[/g;
  let sortie = texte;
  let m;
  while ((m = re.exec(sortie)) !== null) {
    const debut = m.index;
    let profondeur = 0;
    let k = debut;
    for (; k < sortie.length; k += 1) {
      if (sortie[k] === "[" && sortie[k + 1] === "[") { profondeur += 1; k += 1; }
      else if (sortie[k] === "]" && sortie[k + 1] === "]") {
        profondeur -= 1;
        k += 1;
        if (profondeur === 0) { k += 1; break; }
      }
    }
    const cible = sortie.slice(debut + 2, k - 2).split("|")[0].trim();
    if (/^(?:File|Image):/i.test(cible) || EXTENSIONS_IMAGE.test(cible)) {
      sortie = sortie.slice(0, debut) + sortie.slice(k);
      re.lastIndex = debut;
    } else {
      re.lastIndex = debut + 2;
    }
  }
  return sortie;
}

/** Retire entierement un gabarit `{{Nom ...}}` du texte, imbrications comprises. */
function enleverGabarit(texte, nom) {
  const re = new RegExp(`\\{\\{${nom}\\b`, "i");
  const m = re.exec(texte);
  if (!m) return texte;
  const debut = m.index;
  let profondeur = 0;
  for (let k = debut; k < texte.length; k += 1) {
    if (texte[k] === "{" && texte[k + 1] === "{") { profondeur += 1; k += 1; }
    else if (texte[k] === "}" && texte[k + 1] === "}") {
      profondeur -= 1;
      k += 1;
      if (profondeur === 0) return texte.slice(0, debut) + texte.slice(k + 1);
    }
  }
  return texte;
}

/**
 * Le lore d'un heros, rendu en paragraphes lisibles.
 *
 * On separe d'abord sur les lignes vides, puis on nettoie chaque paragraphe
 * comme une description : ainsi les coupures de paragraphe survivent au
 * passage, la ou `nettoyerDescription` seule aplatirait tout en une ligne.
 */
export function nettoyerLore(brut) {
  return sansScories(brut)
    .split(/\n{2,}/)
    .map((p) => nettoyerDescription(p))
    .filter((p) => p && p.length > 1);
}

/**
 * Extrait le corps d'un gabarit `{{Nom ...}}` par comptage d'accolades, seul
 * moyen fiable quand le gabarit en imbrique d'autres.
 */
function corpsGabarit(wikitexte, nom) {
  const re = new RegExp(`\\{\\{${nom}\\b`, "i");
  const m = re.exec(wikitexte);
  if (!m) return null;

  const debut = m.index;
  let profondeur = 0;
  for (let k = debut; k < wikitexte.length; k += 1) {
    if (wikitexte[k] === "{" && wikitexte[k + 1] === "{") {
      profondeur += 1;
      k += 1;
    } else if (wikitexte[k] === "}" && wikitexte[k + 1] === "}") {
      profondeur -= 1;
      k += 1;
      if (profondeur === 0) return wikitexte.slice(debut + 2, k - 1);
    }
  }
  return null;
}

/**
 * Decoupe le corps d'un gabarit en champs `nom = valeur`. La coupe se fait sur
 * les barres de premier niveau : une barre a l'interieur d'un gabarit imbrique
 * ou d'un lien appartient a la valeur, pas a la structure.
 */
function champsGabarit(corps) {
  const champs = {};
  let profondeur = 0;
  let crochets = 0;
  let debut = 0;
  const morceaux = [];
  for (let k = 0; k < corps.length; k += 1) {
    const a = corps[k];
    const b = corps[k + 1];
    if (a === "{" && b === "{") { profondeur += 1; k += 1; }
    else if (a === "}" && b === "}") { profondeur -= 1; k += 1; }
    else if (a === "[" && b === "[") { crochets += 1; k += 1; }
    else if (a === "]" && b === "]") { crochets -= 1; k += 1; }
    else if (a === "|" && profondeur === 0 && crochets === 0) {
      morceaux.push(corps.slice(debut, k));
      debut = k + 1;
    }
  }
  morceaux.push(corps.slice(debut));

  for (const morceau of morceaux) {
    const egal = morceau.indexOf("=");
    if (egal === -1) continue;
    const cle = morceau.slice(0, egal).trim().toLowerCase();
    const valeur = morceau.slice(egal + 1).trim();
    if (cle) champs[cle] = valeur;
  }
  return champs;
}

/** Un champ dont la valeur est une liste `*element` devient un tableau nettoye. */
function elementsListe(valeur) {
  if (!valeur) return [];
  const brut = sansScories(valeur);
  if (/^\s*\*/.test(brut)) {
    return brut
      .split(/\n(?=\s*\*)/)
      .map((l) => nettoyerDescription(l.replace(/^\s*\*+\s*/, "")))
      .filter((l) => l && l.length > 1);
  }
  const seul = nettoyerDescription(brut);
  return seul ? [seul] : [];
}

/** `{{birthday|7|28}}` devient « 28 juillet » ; les autres formes restent brutes. */
function anniversaire(valeur) {
  if (!valeur) return null;
  const m = valeur.match(/\{\{birthday\|(\d{1,2})\|(\d{1,2})\}\}/i);
  if (m) {
    const mois = MOIS[Number(m[1]) - 1];
    if (mois) return `${Number(m[2])} ${mois}`;
  }
  const clair = nettoyerDescription(sansScories(valeur));
  return clair || null;
}

const GENRES = { male: "Homme", female: "Femme", "n/a": null, none: null };

/** Localise les entrees de la fiche : la valeur brute d'abord, sinon rien. */
function texteChamp(valeur) {
  if (!valeur) return null;
  const clair = nettoyerDescription(sansScories(valeur));
  return clair || null;
}

/**
 * Reconstruit la fiche narrative d'un heros a partir de son gabarit
 * `{{Infobox hero story}}`. Chaque champ est optionnel : le wiki les remplit
 * de facon inegale d'un heros a l'autre.
 */
export function ficheHistoire(wikitexte) {
  const corps = corpsGabarit(wikitexte, "Infobox hero story");
  if (!corps) return null;
  // On retire references et galeries avant le decoupage : leurs barres
  // internes ne sont pas des separateurs de champs et fausseraient la coupe.
  const c = champsGabarit(sansScories(corps));

  const genreBrut = texteChamp(c.gender)?.toLowerCase();
  const fiche = {
    nomComplet: texteChamp(c.full_name),
    titre: texteChamp(c.title),
    espece: texteChamp(c.species),
    genre: genreBrut ? (GENRES[genreBrut] ?? texteChamp(c.gender)) : null,
    age: texteChamp(c.age),
    origine: texteChamp(c.born),
    anniversaire: anniversaire(c.birthday),
    affiliations: elementsListe(c.affiliation),
    relations: elementsListe(c.relationships),
    pouvoirs: elementsListe(c.abilities),
  };

  // Une fiche entierement vide ne merite pas d'etre conservee.
  const utile = Object.values(fiche).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v),
  );
  return utile ? fiche : null;
}

/**
 * Renvoie le contenu d'une section de premier niveau, borne au prochain titre
 * de niveau egal ou superieur. `titres` liste les intitules acceptes, essayes
 * dans l'ordre.
 */
export function sectionWiki(wikitexte, titres) {
  const entetes = [
    ...wikitexte.matchAll(/^(=+)\s*(.+?)\s*=+\s*$/gm),
  ].map((m) => ({ position: m.index, fin: m.index + m[0].length, niveau: m[1].length, titre: m[2].trim().toLowerCase() }));

  for (const voulu of titres.map((t) => t.toLowerCase())) {
    const i = entetes.findIndex((e) => e.titre === voulu);
    if (i === -1) continue;
    const courant = entetes[i];
    const suivant = entetes.slice(i + 1).find((e) => e.niveau <= courant.niveau);
    return wikitexte.slice(courant.fin, suivant ? suivant.position : undefined).trim();
  }
  return null;
}

/**
 * Assemble l'histoire d'un heros : le lore en paragraphes, la fiche narrative
 * et les anecdotes. Renvoie `null` si la page n'offre rien d'exploitable.
 */
export function extraireHistoire(wikitexte) {
  // La prose vit dans la sous-section « Lore ». A defaut, certains heros la
  // placent directement sous « Story », melee au gabarit de fiche : on le
  // retire pour ne garder que le recit.
  const brutLore = sectionWiki(wikitexte, ["Lore", "Story"]);
  const lore = brutLore ? nettoyerLore(enleverGabarit(brutLore, "Infobox hero story")) : [];

  const brutTrivia = sectionWiki(wikitexte, ["Trivia"]);
  const anecdotes = brutTrivia
    ? sansScories(brutTrivia)
        .split(/\n(?=\s*\*)/)
        .map((l) => nettoyerDescription(l.replace(/^\s*\*+\s*/, "")))
        .filter((l) => l && l.length > 4)
    : [];

  const fiche = ficheHistoire(wikitexte);

  if (!lore.length && !anecdotes.length && !fiche) return null;
  return { lore, fiche, anecdotes };
}
