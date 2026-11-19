/**
 * Translation function, without any catalog.
 *
 * This module only interprets a message tree. Client components
 * use it with just their language's catalog, received from the server: the
 * full catalogs have no business in the browser's JavaScript.
 */
export type Tree = { [key: string]: string | Tree };

export type T = (key: string, variables?: Record<string, string | number>) => string;

/** Resolves a dotted key (`nav.heroes`) in the message tree. */
function resolve(tree: Tree, key: string): string | undefined {
  let current: string | Tree | undefined = tree;
  for (const match of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = current[match];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Builds a translation function. A missing key falls back on the fallback
 * tree, then on the key itself: never a blank screen.
 */
export function createTFrom(messages: Tree, fallback?: Tree, options: { elide?: boolean } = {}): T {
  return (key, variables) => {
    const raw = resolve(messages, key) ?? (fallback ? resolve(fallback, key) : undefined) ?? key;
    if (!variables) return raw;
    return raw.replace(/(\b(?:[Dd]e|[Qq]ue) )?\{(\w+)\}/g, (_, before: string | undefined, name: string) => {
      if (!(name in variables)) return `${before ?? ""}{${name}}`;
      const value = String(variables[name]);
      // French elides before a vowel: "les données d'Aamon", "le détail
      // d'octobre", where the template can only write "de {name}".
      if (before && options.elide && ELIDED.test(value)) return `${before.slice(0, -2)}'${value}`;
      return `${before ?? ""}${value}`;
    });
  };
}

/** A word that takes an elision in front of it: it opens on a vowel (h and y aside: "de Yu Zhong", and h aspiré is too irregular to guess). */
const ELIDED = /^[aeiouàâäéèêëîïôöùûüœ]/i;
