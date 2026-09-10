import { LANGUE_DEFAUT, type Langue } from "./config";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import it from "./messages/it.json";
import es from "./messages/es.json";

type Arbre = { [cle: string]: string | Arbre };

const MESSAGES: Record<Langue, Arbre> = { en, fr, it, es } as unknown as Record<Langue, Arbre>;

/** Résout une clé pointée (`nav.heroes`) dans l'arbre de messages. */
function resoudre(arbre: Arbre, cle: string): string | undefined {
  let courant: string | Arbre | undefined = arbre;
  for (const partie of cle.split(".")) {
    if (typeof courant !== "object" || courant === null) return undefined;
    courant = courant[partie];
  }
  return typeof courant === "string" ? courant : undefined;
}

export type T = (cle: string, variables?: Record<string, string | number>) => string;

/**
 * Fabrique la fonction de traduction d'une langue. Une clé absente retombe sur
 * la langue par défaut, puis sur la clé elle-même : jamais d'écran vide.
 */
export function creerT(langue: Langue): T {
  return (cle, variables) => {
    const brut =
      resoudre(MESSAGES[langue], cle) ??
      resoudre(MESSAGES[LANGUE_DEFAUT], cle) ??
      cle;
    if (!variables) return brut;
    return brut.replace(/\{(\w+)\}/g, (_, nom) =>
      nom in variables ? String(variables[nom]) : `{${nom}}`,
    );
  };
}

/** Messages complets d'une langue, pour les passer à un provider client. */
export function messagesDe(langue: Langue): Arbre {
  return MESSAGES[langue];
}
