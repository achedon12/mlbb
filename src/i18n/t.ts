/**
 * Fonction de traduction, sans aucun catalogue.
 *
 * Ce module ne fait qu'interpreter un arbre de messages. Les composants client
 * l'utilisent avec le seul catalogue de leur langue, recu du serveur : les
 * catalogues complets n'ont rien a faire dans le JavaScript du navigateur.
 */
export type Arbre = { [cle: string]: string | Arbre };

export type T = (cle: string, variables?: Record<string, string | number>) => string;

/** Resout une cle pointee (`nav.heroes`) dans l'arbre de messages. */
function resoudre(arbre: Arbre, cle: string): string | undefined {
  let courant: string | Arbre | undefined = arbre;
  for (const partie of cle.split(".")) {
    if (typeof courant !== "object" || courant === null) return undefined;
    courant = courant[partie];
  }
  return typeof courant === "string" ? courant : undefined;
}

/**
 * Fabrique une fonction de traduction. Une cle absente retombe sur l'arbre de
 * secours, puis sur la cle elle-meme : jamais d'ecran vide.
 */
export function creerTDepuis(messages: Arbre, secours?: Arbre): T {
  return (cle, variables) => {
    const brut = resoudre(messages, cle) ?? (secours ? resoudre(secours, cle) : undefined) ?? cle;
    if (!variables) return brut;
    return brut.replace(/\{(\w+)\}/g, (_, nom) => (nom in variables ? String(variables[nom]) : `{${nom}}`));
  };
}
