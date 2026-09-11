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
 * argument (`tr("skinRarete", …)`), doit rester hors de cette liste.
 */
const SERVEUR_SEULEMENT = [
  "pied", "modeFiche", "histoire", "home", "vedette", "acces", "proses", "nouveauHeros", "articleUI", "articleCat",
  "donneesHeros",
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
 * Catalogue transmis aux composants client : la langue de la page, completee
 * par la langue par defaut pour les cles manquantes, sans les rubriques
 * reservees au serveur.
 */
export function messagesClient(langue: Langue): Arbre {
  const complet = fusionner(MESSAGES[LANGUE_DEFAUT], MESSAGES[langue]);
  for (const rubrique of SERVEUR_SEULEMENT) delete complet[rubrique];
  return complet;
}
