/**
 * Conversion du wikitexte en texte lisible.
 *
 * Les descriptions de competences melangent des liens internes, des gabarits
 * de mise en forme et des annotations de calcul (`{{scale|...}}`) qui n'ont de
 * sens que sur le wiki. On garde la phrase, on jette la mecanique d'affichage.
 */
export function nettoyerDescription(brut) {
  return (
    brut
      // Annotations de calcul : elles decrivent une formule, pas un effet.
      .replace(/\{\{scale\|[^}]*\}\}/gi, "")
      // Gabarits de mise en valeur : seul le texte compte.
      .replace(/\{\{[Bb]\|([^}]*)\}\}/g, "$1")
      .replace(/\{\{(?:hi|ii|Hi|II)\|([^}]*)\}\}/g, "$1")
      // Liens internes, avec ou sans libelle.
      .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
      .replace(/\[\[([^\]]*)\]\]/g, "$1")
      .replace(/<nowiki>([\s\S]*?)<\/nowiki>/g, "$1")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
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
