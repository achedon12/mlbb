/**
 * Fonction de traduction, sans aucun catalogue.
 *
 * Ce module ne fait qu'interpreter un arbre de messages. Les composants client
 * l'utilisent avec le seul catalogue de leur langue, recu du serveur : les
 * catalogues complets n'ont rien a faire dans le JavaScript du navigateur.
 */
export type Tree = { [key: string]: string | Tree };

export type T = (key: string, variables?: Record<string, string | number>) => string;

/** Resout une cle pointee (`nav.heroes`) dans l'arbre de messages. */
function resolve(tree: Tree, key: string): string | undefined {
  let current: string | Tree | undefined = tree;
  for (const match of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = current[match];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Fabrique une fonction de traduction. Une cle absente retombe sur l'arbre de
 * secours, puis sur la cle elle-meme : jamais d'ecran vide.
 */
export function createTFrom(messages: Tree, fallback?: Tree): T {
  return (key, variables) => {
    const raw = resolve(messages, key) ?? (fallback ? resolve(fallback, key) : undefined) ?? key;
    if (!variables) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name) => (name in variables ? String(variables[name]) : `{${name}}`));
  };
}
