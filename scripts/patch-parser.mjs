import { cleanDescription } from "./wikitext.mjs";

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
const ARROW = /&#x2192;|&rarr;|→|&gt;&gt;|>>/g;

/** Type de changement, tel que le wiki l'annote. */
function typeChange(raw) {
  return { buff: "buff", nerf: "nerf", adjust: "adjust" }[raw] ?? null;
}

/**
 * Rend lisible une annotation de calcul `{{scale|...}}`.
 *
 * Le wiki y encode une valeur qui croit avec le niveau — une base et des
 * increments. On la restitue en clair (« 100 +80 MP ») plutot que de la jeter,
 * sinon un changement d'attribut se reduirait a « avant → apres » sans valeurs.
 */
function renderScale(params) {
  const LABELS = {
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
  const pairs = {};
  for (const kv of params.split("|")) {
    const i = kv.indexOf("=");
    if (i !== -1) pairs[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }

  const chunks = [];
  if (pairs.base !== undefined) chunks.push(pairs.base);
  for (const [key, value] of Object.entries(pairs)) {
    if (key === "base" || key === "level") continue;
    const lib = LABELS[key] ?? key;
    chunks.push(`+${value}${lib ? ` ${lib}` : ""}`);
  }
  return chunks.join(" ") || params;
}

/**
 * Coupe une ligne de changement en avant / apres quand elle en contient.
 *
 * « Base HP: 2440 → 2500 » se lit bien mieux en deux colonnes qu'en phrase.
 * Une ligne sans fleche reste un simple texte.
 */
function analyzeChange(row) {
  const text = cleanRow(row);
  const parts = text.split(/\s*(?:→)\s*/);

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

  return { text };
}

/** Nettoie une ligne de wikitexte en conservant la fleche comme separateur. */
function cleanRow(row) {
  // Les valeurs chiffrees passent par `{{scale|...}}` : on les restitue avant
  // que le nettoyage generique ne les efface.
  const withValues = row.replace(/\{\{scale\|([^}]*)\}\}/gi, (_, p) => renderScale(p));
  return cleanDescription(withValues.replace(ARROW, " → ")).replace(/\s*→\s*/g, " → ");
}

/**
 * Extrait les ajustements de heros d'un bloc de wikitexte.
 *
 * Chaque heros ouvre un bloc jusqu'au heros suivant. A l'interieur, les
 * sous-titres `: {{...}}` ouvrent des sous-sections (attributs, competences),
 * et les lignes `* ...` sont les changements de la sous-section courante.
 */
export function heroAdjustments(wikitext) {
  // Le titre porte un numero romain qui a change de version en version
  // (« I. », « II. »…), parfois suivi d'une espace avant les « == ».
  const header = wikitext.match(/^(==+)\s*(?:[IVXLCDM]+\.\s*)?Hero Adjustments\b.*$/im);
  if (!header) return [];

  const start = header.index + header[0].length;
  const level = header[1].length;
  // Jusqu'au prochain titre de niveau egal ou superieur.
  const run = wikitext.slice(start);
  const end = run.search(new RegExp(`^={2,${level}}[^=]`, "m"));
  const block = end === -1 ? run : run.slice(0, end);

  const heroes = [];
  let current = null;
  let subSection = null;

  const addSubsection = (name, category, type) => {
    subSection = { name, category, type, changes: [] };
    current.sections.push(subSection);
  };

  for (const raw of block.split("\n")) {
    // Structure de tableau du wiki : sans interet pour le contenu.
    if (/^\s*(?:\{\||\|\}|\|-|!)/.test(raw)) continue;

    // Deux mises en forme ont coexiste : les cellules de tableau (« | … ») et
    // les listes de definition (« : … »). On retire le marqueur de tete tout
    // en retenant s'il s'agissait d'une cellule de prose.
    let row = raw;
    let cellProse = false;
    if (/^\s*\|/.test(row)) {
      cellProse = true;
      row = row.replace(/^\s*\|\s*/, "");
    } else if (/^\s*:/.test(row)) {
      row = row.replace(/^\s*:+\s*/, "");
    }
    row = row.trim();
    if (!row) continue;

    // Ouverture d'un heros : {{hi|Nom}} {{pci|type}}
    const heroHeader = row.match(/^\{\{hi\|([^}]+)\}\}\s*\{\{pci\|(buff|nerf|adjust)\}\}/i);
    if (heroHeader) {
      current = {
        name: heroHeader[1].trim(),
        type: typeChange(heroHeader[2].toLowerCase()),
        intro: "",
        sections: [],
      };
      heroes.push(current);
      subSection = null;
      continue;
    }
    if (!current) continue;

    // Sous-titre : « {{link|Attributes}} {{pci|type}} » ou « {{ai|Nom|Type}} ».
    const subtitle = row.match(
      /^\{\{(?:link|ai)\|([^}|]+)(?:\|([^}]+))?\}\}\s*(?:\{\{pci\|(buff|nerf|adjust)\}\})?\s*$/i,
    );
    if (subtitle) {
      addSubsection(
        subtitle[1].trim(),
        subtitle[2]?.trim() ?? null,
        typeChange(subtitle[3]?.toLowerCase()),
      );
      continue;
    }

    // Changement : « * … ». Sans sous-section ouverte — attribut de base dans
    // les tableaux — on en ouvre une implicite.
    const change = row.match(/^\*+\s*(.+)/);
    if (change) {
      if (!subSection) addSubsection("Attributes", null, null);
      const analysis = analyzeChange(change[1]);
      const empty = "text" in analysis ? !analysis.text : !analysis.before && !analysis.after;
      if (!empty) subSection.changes.push(analysis);
      continue;
    }

    // Prose : intro du heros (cellule « Change » d'un tableau, ou ligne « : »)
    // tant qu'aucune sous-section n'a ete ouverte.
    if (!subSection && (cellProse || true)) {
      const text = cleanDescription(row);
      if (text) current.intro = current.intro ? `${current.intro} ${text}` : text;
    }
  }

  // On garde tous les heros ajustes, meme ceux dont le wiki n'a pas encore
  // detaille les changements : « buffe » sans detail reste une information.
  return heroes;
}

/** Resume chiffre pour l'en-tete : combien d'ameliorations, d'affaiblissements. */
export function summary(heroes) {
  const count = { buff: 0, nerf: 0, adjust: 0 };
  for (const h of heroes) if (h.type) count[h.type] += 1;
  return count;
}
