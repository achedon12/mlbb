import { LANGUE_DEFAUT, type Langue } from "./config";
import { creerTDepuis, type Arbre, type T } from "./t";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import it from "./messages/it.json";
import es from "./messages/es.json";

const MESSAGES: Record<Langue, Arbre> = { en, fr, it, es } as unknown as Record<Langue, Arbre>;

/**
 * Fabrique la fonction de traduction d'une langue. Une clé absente retombe sur
 * la langue par défaut, puis sur la clé elle-même : jamais d'écran vide.
 */
export function creerT(langue: Langue): T {
  return creerTDepuis(MESSAGES[langue], MESSAGES[LANGUE_DEFAUT]);
}

/** Messages complets d'une langue, pour les passer à un provider client. */
export function messagesDe(langue: Langue): Arbre {
  return MESSAGES[langue];
}

export type { Arbre, T };

/**
 * Rubriques lues seulement par des composants serveur : le navigateur n'en a
 * pas l'usage. Une rubrique citee dans un composant client, meme passee en
 * argument (`tr("skinRarity", …)`), doit rester hors de cette liste.
 */
const SERVEUR_SEULEMENT = [
  "footer", "modeSheet", "story", "home", "featured", "access", "prose", "newHero", "articleUI", "articleCategory",
  "heroData", "pushNotif",
];

const estArbre = (x: unknown): x is Arbre => typeof x === "object" && x !== null && !Array.isArray(x);

function fusionner(base: Arbre, dessus: Arbre): Arbre {
  const sortie: Arbre = { ...base };
  for (const [cle, valeur] of Object.entries(dessus)) {
    const existant = sortie[cle];
    sortie[cle] = estArbre(valeur) && estArbre(existant) ? fusionner(existant, valeur) : valeur;
  }
  return sortie;
}

/**
 * Rubriques propres a certaines pages : la mise en page ne les envoie pas, la
 * page qui en a besoin les ajoute (`messagesPage` + `CompleterMessages`). Le
 * catalogue client, repete dans chaque page, pesait 46 Ko dont 34 pour ces
 * rubriques. `pages.notFound` reste commun : la page 404 peut surgir
 * partout.
 */
export const RUBRIQUES_DE_PAGE = ["pages", "emblemData"];
const COMMUNES_MALGRE_TOUT = ["pages.notFound"];

function complet(langue: Langue): Arbre {
  return fusionner(MESSAGES[LANGUE_DEFAUT], MESSAGES[langue]);
}

/** Extrait d'un arbre les seuls chemins pointes demandes (`pages.heroDetail`). */
function extraire(arbre: Arbre, chemins: string[]): Arbre {
  const sortie: Arbre = {};
  for (const chemin of chemins) {
    const parties = chemin.split(".");
    let source: string | Arbre | undefined = arbre;
    for (const p of parties) source = estArbre(source) ? source[p] : undefined;
    if (source === undefined) continue;
    let cible = sortie;
    for (const p of parties.slice(0, -1)) cible = (cible[p] = estArbre(cible[p]) ? cible[p] : {}) as Arbre;
    cible[parties.at(-1)!] = source;
  }
  return sortie;
}

/**
 * Catalogue commun transmis aux composants client : la langue de la page,
 * completee par la langue par defaut pour les cles manquantes, sans les
 * rubriques reservees au serveur ni celles propres a certaines pages.
 */
export function messagesClient(langue: Langue): Arbre {
  const tout = complet(langue);
  const communes = extraire(tout, COMMUNES_MALGRE_TOUT);
  for (const rubrique of [...SERVEUR_SEULEMENT, ...RUBRIQUES_DE_PAGE]) delete tout[rubrique];
  return fusionner(tout, communes);
}

/** Rubriques de page a ajouter au catalogue commun, pour les composants client de cette page. */
export function messagesPage(langue: Langue, chemins: string[]): Arbre {
  return extraire(complet(langue), chemins);
}
