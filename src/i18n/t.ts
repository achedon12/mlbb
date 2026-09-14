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
export function createTFrom(messages: Tree, fallback?: Tree): T {
  return (key, variables) => {
    const raw = resolve(messages, key) ?? (fallback ? resolve(fallback, key) : undefined) ?? key;
    if (!variables) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name) => (name in variables ? String(variables[name]) : `{${name}}`));
  };
}
