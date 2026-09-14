import { DEFAULT_LOCALE, type Locale } from "./config";
import { createTFrom, type Tree, type T } from "./t";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import it from "./messages/it.json";
import es from "./messages/es.json";

const MESSAGES: Record<Locale, Tree> = { en, fr, it, es } as unknown as Record<Locale, Tree>;

/**
 * Fabrique la fonction de traduction d'une langue. Une clé absente retombe sur
 * la langue par défaut, puis sur la clé elle-même : jamais d'écran vide.
 */
export function createT(locale: Locale): T {
  return createTFrom(MESSAGES[locale], MESSAGES[DEFAULT_LOCALE]);
}

/** Messages complets d'une langue, pour les passer à un provider client. */
export function messagesFor(locale: Locale): Tree {
  return MESSAGES[locale];
}

export type { Tree, T };

/**
 * Rubriques lues seulement par des composants serveur : le navigateur n'en a
 * pas l'usage. Une rubrique citee dans un composant client, meme passee en
 * argument (`tr("skinRarity", …)`), doit rester hors de cette liste.
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
 * Rubriques propres a certaines pages : la mise en page ne les envoie pas, la
 * page qui en a besoin les ajoute (`messagesPage` + `CompleterMessages`). Le
 * catalogue client, repete dans chaque page, pesait 46 Ko dont 34 pour ces
 * rubriques. `pages.notFound` reste commun : la page 404 peut surgir
 * partout.
 */
export const PAGE_SECTIONS = ["pages", "emblemData"];
const ALWAYS_COMMON = ["pages.notFound"];

function full(locale: Locale): Tree {
  return merge(MESSAGES[DEFAULT_LOCALE], MESSAGES[locale]);
}

/** Extrait d'un arbre les seuls chemins pointes demandes (`pages.heroDetail`). */
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
 * Catalogue commun transmis aux composants client : la langue de la page,
 * completee par la langue par defaut pour les cles manquantes, sans les
 * rubriques reservees au serveur ni celles propres a certaines pages.
 */
export function messagesClient(locale: Locale): Tree {
  const all = full(locale);
  const common = extract(all, ALWAYS_COMMON);
  for (const section of [...SERVER_ONLY, ...PAGE_SECTIONS]) delete all[section];
  return merge(all, common);
}

/** Rubriques de page a ajouter au catalogue commun, pour les composants client de cette page. */
export function messagesPage(locale: Locale, paths: string[]): Tree {
  return extract(full(locale), paths);
}
