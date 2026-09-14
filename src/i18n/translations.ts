import { DEFAULT_LOCALE, type Locale } from "./config";
import { createTFrom, type Tree, type T } from "./t";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import it from "./messages/it.json";
import es from "./messages/es.json";

const MESSAGES: Record<Locale, Tree> = { en, fr, it, es } as unknown as Record<Locale, Tree>;

/**
 * Builds a language's translation function. A missing key falls back on
 * the default language, then on the key itself: never a blank screen.
 */
export function createT(locale: Locale): T {
  return createTFrom(MESSAGES[locale], MESSAGES[DEFAULT_LOCALE]);
}

/** A language's full messages, to pass them to a client provider. */
export function messagesFor(locale: Locale): Tree {
  return MESSAGES[locale];
}

export type { Tree, T };

/**
 * Sections read only by server components: the browser has no
 * use for them. A section cited in a client component, even passed as an
 * argument (`tr("skinRarity", …)`), must stay out of this list.
 */
const SERVER_ONLY = [
  "footer", "modeSheet", "story", "home", "featured", "access", "prose", "newHero", "articleUI", "articleCategory",
  "heroData", "pushNotif",
];

const isTree = (x: unknown): x is Tree => typeof x === "object" && x !== null && !Array.isArray(x);

function merge(base: Tree, above: Tree): Tree {
  const output: Tree = { ...base };
  for (const [key, value] of Object.entries(above)) {
    const existing = output[key];
    output[key] = isTree(value) && isTree(existing) ? merge(existing, value) : value;
  }
  return output;
}

/**
 * Sections specific to certain pages: the layout does not send them, the
 * page that needs them adds them (`messagesPage` + `ExtendMessages`). The
 * client catalog, repeated in every page, weighed 46 KB, 34 of which for these
 * sections. `pages.notFound` stays shared: the 404 page can appear
 * anywhere.
 */
export const PAGE_SECTIONS = ["pages", "emblemData"];
const ALWAYS_COMMON = ["pages.notFound"];

function full(locale: Locale): Tree {
  return merge(MESSAGES[DEFAULT_LOCALE], MESSAGES[locale]);
}

/** Extracts from a tree only the requested dotted paths (`pages.heroDetail`). */
function extract(tree: Tree, paths: string[]): Tree {
  const output: Tree = {};
  for (const path of paths) {
    const matches = path.split(".");
    let source: string | Tree | undefined = tree;
    for (const p of matches) source = isTree(source) ? source[p] : undefined;
    if (source === undefined) continue;
    let target = output;
    for (const p of matches.slice(0, -1)) target = (target[p] = isTree(target[p]) ? target[p] : {}) as Tree;
    target[matches.at(-1)!] = source;
  }
  return output;
}

/**
 * Shared catalog passed to client components: the page's language,
 * completed by the default language for missing keys, without the
 * server-only sections or those specific to certain pages.
 */
export function messagesClient(locale: Locale): Tree {
  const all = full(locale);
  const common = extract(all, ALWAYS_COMMON);
  for (const section of [...SERVER_ONLY, ...PAGE_SECTIONS]) delete all[section];
  return merge(all, common);
}

/** Page sections to add to the shared catalog, for this page's client components. */
export function messagesPage(locale: Locale, paths: string[]): Tree {
  return extract(full(locale), paths);
}
