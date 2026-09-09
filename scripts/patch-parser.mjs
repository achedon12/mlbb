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

const FLECHE = /&#x2192;|&rarr;|→/g;

/** Type de changement, tel que le wiki l'annote. */
function typeChangement(brut) {
  return { buff: "amelioration", nerf: "affaiblissement", adjust: "ajustement" }[brut] ?? null;
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
        libelle: parts[0].slice(0, sep).trim(),
        avant: parts[0].slice(sep + 1).trim(),
        apres: parts[1].trim(),
      };
    }
    return { libelle: null, avant: parts[0].trim(), apres: parts[1].trim() };
  }

  return { texte };
}

/** Nettoie une ligne de wikitexte en conservant la fleche comme separateur. */
function nettoyerLigne(ligne) {
  return nettoyerDescription(ligne.replace(FLECHE, " → ")).replace(/\s*→\s*/g, " → ");
}

/**
 * Extrait les ajustements de heros d'un bloc de wikitexte.
 *
 * Chaque heros ouvre un bloc jusqu'au heros suivant. A l'interieur, les
 * sous-titres `: {{...}}` ouvrent des sous-sections (attributs, competences),
 * et les lignes `* ...` sont les changements de la sous-section courante.
 */
export function ajustementsHeros(wikitexte) {
  const depart = wikitexte.search(/^==+\s*(?:II\.\s*)?Hero Adjustments/im);
  if (depart === -1) return [];

  // Jusqu'a la section de meme niveau suivante.
  const suite = wikitexte.slice(depart + 3);
  const fin = suite.search(/^==[^=]/m);
  const bloc = fin === -1 ? suite : suite.slice(0, fin);

  const heros = [];
  let courant = null;
  let sousSection = null;

  for (const ligne of bloc.split("\n")) {
    // Ouverture d'un heros : {{hi|Nom}} {{pci|type}}
    const enteteHeros = ligne.match(/^\{\{hi\|([^}]+)\}\}\s*\{\{pci\|(buff|nerf|adjust)\}\}\s*$/);
    if (enteteHeros) {
      courant = {
        nom: enteteHeros[1].trim(),
        type: typeChangement(enteteHeros[2]),
        intro: "",
        sections: [],
      };
      heros.push(courant);
      sousSection = null;
      continue;
    }
    if (!courant) continue;

    // Sous-titre : « : {{link|Attributes}} {{pci|type}} » ou « : {{ai|Nom|Type}} »
    const sousTitre = ligne.match(/^:\s*\{\{(?:link|ai)\|([^}|]+)(?:\|([^}]+))?\}\}\s*(?:\{\{pci\|(buff|nerf|adjust)\}\})?/);
    if (sousTitre) {
      sousSection = {
        nom: sousTitre[1].trim(),
        categorie: sousTitre[2]?.trim() ?? null,
        type: typeChangement(sousTitre[3]),
        changements: [],
      };
      courant.sections.push(sousSection);
      continue;
    }

    // Intro du heros : ligne « : texte » avant toute sous-section.
    const intro = ligne.match(/^:\s*(.+)/);
    if (intro && !sousSection) {
      const texte = nettoyerDescription(intro[1]);
      if (texte) courant.intro = courant.intro ? `${courant.intro} ${texte}` : texte;
      continue;
    }

    // Changement : « * ... »
    const changement = ligne.match(/^\*+\s*(.+)/);
    if (changement && sousSection) {
      sousSection.changements.push(analyserChangement(changement[1]));
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
