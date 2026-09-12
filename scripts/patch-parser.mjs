import { nettoyerDescription } from "./wikitexte.mjs";

/**
 * Analyse structuree d'une note de patch.
 *
 * Le wikitexte des patch notes suit une grammaire reguliere qu'un rendu HTML
 * aplatit : chaque heros ajuste est introduit par `{{hi|Nom}} {{pci|type}}`,
 * ses competences par `{{ai|Nom|Type}}`, et chaque changement par une ligne
 * `* Libelle : ancien → nouveau`. On en tire une structure exploitable plutot
 * qu'un mur de texte, ce que seul un affichage generique permettrait sinon.
 *
 * Ce qui n'entre pas dans cette grammaire — mot des concepteurs, nouveaux
 * heros, ajustements de terrain — est conserve tel quel, en HTML nettoye.
 */

// Deux notations d'evolution ont cohabite au fil des versions : « → » dans les
// notes recentes, « >> » dans les tableaux plus anciens.
const FLECHE = /&#x2192;|&rarr;|→|&gt;&gt;|>>/g;

/** Type de changement, tel que le wiki l'annote. */
function typeChangement(brut) {
  return { buff: "amelioration", nerf: "affaiblissement", adjust: "ajustement" }[brut] ?? null;
}

/**
 * Rend lisible une annotation de calcul `{{scale|...}}`.
 *
 * Le wiki y encode une valeur qui croit avec le niveau — une base et des
 * increments. On la restitue en clair (« 100 +80 MP ») plutot que de la jeter,
 * sinon un changement d'attribut se reduirait a « avant → apres » sans valeurs.
 */
function rendreScale(params) {
  const LIBELLES = {
    "total-pa": "AD",
    "total-ap": "AP",
    "total-mp": "MP",
    "total-hp": "HP",
    "total-def": "Def",
    "total-mdef": "Def. mag.",
    "extra-pa": "AD suppl.",
    "extra-ap": "AP suppl.",
    "extra-hp": "HP suppl.",
    "extra-mp": "MP suppl.",
  };
  const paires = {};
  for (const kv of params.split("|")) {
    const i = kv.indexOf("=");
    if (i !== -1) paires[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }

  const morceaux = [];
  if (paires.base !== undefined) morceaux.push(paires.base);
  for (const [cle, valeur] of Object.entries(paires)) {
    if (cle === "base" || cle === "level") continue;
    const lib = LIBELLES[cle] ?? cle;
    morceaux.push(`+${valeur}${lib ? ` ${lib}` : ""}`);
  }
  return morceaux.join(" ") || params;
}

/**
 * Coupe une ligne de changement en avant / apres quand elle en contient.
 *
 * « Base HP: 2440 → 2500 » se lit bien mieux en deux colonnes qu'en phrase.
 * Une ligne sans fleche reste un simple texte.
 */
function analyserChangement(ligne) {
  const texte = nettoyerLigne(ligne);
  const parts = texte.split(/\s*(?:→)\s*/);

  if (parts.length === 2) {
    // Le libelle precede le premier « : » ; sinon toute la partie gauche est
    // l'ancienne valeur.
    const sep = parts[0].indexOf(":");
    if (sep !== -1) {
      return {
        label: parts[0].slice(0, sep).trim(),
        before: parts[0].slice(sep + 1).trim(),
        after: parts[1].trim(),
      };
    }
    return { label: null, before: parts[0].trim(), after: parts[1].trim() };
  }

  return { text: texte };
}

/** Nettoie une ligne de wikitexte en conservant la fleche comme separateur. */
function nettoyerLigne(ligne) {
  // Les valeurs chiffrees passent par `{{scale|...}}` : on les restitue avant
  // que le nettoyage generique ne les efface.
  const avecValeurs = ligne.replace(/\{\{scale\|([^}]*)\}\}/gi, (_, p) => rendreScale(p));
  return nettoyerDescription(avecValeurs.replace(FLECHE, " → ")).replace(/\s*→\s*/g, " → ");
}

/**
 * Extrait les ajustements de heros d'un bloc de wikitexte.
 *
 * Chaque heros ouvre un bloc jusqu'au heros suivant. A l'interieur, les
 * sous-titres `: {{...}}` ouvrent des sous-sections (attributs, competences),
 * et les lignes `* ...` sont les changements de la sous-section courante.
 */
export function ajustementsHeros(wikitexte) {
  // Le titre porte un numero romain qui a change de version en version
  // (« I. », « II. »…), parfois suivi d'une espace avant les « == ».
  const entete = wikitexte.match(/^(==+)\s*(?:[IVXLCDM]+\.\s*)?Hero Adjustments\b.*$/im);
  if (!entete) return [];

  const depart = entete.index + entete[0].length;
  const niveau = entete[1].length;
  // Jusqu'au prochain titre de niveau egal ou superieur.
  const suite = wikitexte.slice(depart);
  const fin = suite.search(new RegExp(`^={2,${niveau}}[^=]`, "m"));
  const bloc = fin === -1 ? suite : suite.slice(0, fin);

  const heros = [];
  let courant = null;
  let sousSection = null;

  const ajouterSousSection = (nom, categorie, type) => {
    sousSection = { name: nom, category: categorie, type, changes: [] };
    courant.sections.push(sousSection);
  };

  for (const brute of bloc.split("\n")) {
    // Structure de tableau du wiki : sans interet pour le contenu.
    if (/^\s*(?:\{\||\|\}|\|-|!)/.test(brute)) continue;

    // Deux mises en forme ont coexiste : les cellules de tableau (« | … ») et
    // les listes de definition (« : … »). On retire le marqueur de tete tout
    // en retenant s'il s'agissait d'une cellule de prose.
    let ligne = brute;
    let celluleProse = false;
    if (/^\s*\|/.test(ligne)) {
      celluleProse = true;
      ligne = ligne.replace(/^\s*\|\s*/, "");
    } else if (/^\s*:/.test(ligne)) {
      ligne = ligne.replace(/^\s*:+\s*/, "");
    }
    ligne = ligne.trim();
    if (!ligne) continue;

    // Ouverture d'un heros : {{hi|Nom}} {{pci|type}}
    const enteteHeros = ligne.match(/^\{\{hi\|([^}]+)\}\}\s*\{\{pci\|(buff|nerf|adjust)\}\}/i);
    if (enteteHeros) {
      courant = {
        name: enteteHeros[1].trim(),
        type: typeChangement(enteteHeros[2].toLowerCase()),
        intro: "",
        sections: [],
      };
      heros.push(courant);
      sousSection = null;
      continue;
    }
    if (!courant) continue;

    // Sous-titre : « {{link|Attributes}} {{pci|type}} » ou « {{ai|Nom|Type}} ».
    const sousTitre = ligne.match(
      /^\{\{(?:link|ai)\|([^}|]+)(?:\|([^}]+))?\}\}\s*(?:\{\{pci\|(buff|nerf|adjust)\}\})?\s*$/i,
    );
    if (sousTitre) {
      ajouterSousSection(
        sousTitre[1].trim(),
        sousTitre[2]?.trim() ?? null,
        typeChangement(sousTitre[3]?.toLowerCase()),
      );
      continue;
    }

    // Changement : « * … ». Sans sous-section ouverte — attribut de base dans
    // les tableaux — on en ouvre une implicite.
    const changement = ligne.match(/^\*+\s*(.+)/);
    if (changement) {
      if (!sousSection) ajouterSousSection("Attributes", null, null);
      const analyse = analyserChangement(changement[1]);
      const vide = "text" in analyse ? !analyse.text : !analyse.before && !analyse.after;
      if (!vide) sousSection.changes.push(analyse);
      continue;
    }

    // Prose : intro du heros (cellule « Change » d'un tableau, ou ligne « : »)
    // tant qu'aucune sous-section n'a ete ouverte.
    if (!sousSection && (celluleProse || true)) {
      const texte = nettoyerDescription(ligne);
      if (texte) courant.intro = courant.intro ? `${courant.intro} ${texte}` : texte;
    }
  }

  // On garde tous les heros ajustes, meme ceux dont le wiki n'a pas encore
  // detaille les changements : « buffe » sans detail reste une information.
  return heros;
}

/** Resume chiffre pour l'en-tete : combien d'ameliorations, d'affaiblissements. */
export function bilan(heros) {
  const compte = { amelioration: 0, affaiblissement: 0, ajustement: 0 };
  for (const h of heros) if (h.type) compte[h.type] += 1;
  return compte;
}
