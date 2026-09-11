"use client";

import { createContext, useContext, useMemo } from "react";
import { LANGUE_DEFAUT, type Langue } from "./config";
import { creerTDepuis, type Arbre, type T } from "./t";

const Contexte = createContext<{ langue: Langue; messages: Arbre; t: T }>({
  langue: LANGUE_DEFAUT,
  messages: {},
  t: (cle) => cle,
});

/**
 * Rend la langue courante et sa fonction de traduction disponibles aux
 * composants client. La mise en page transmet le catalogue commun
 * (`messagesClient`) ; une page y ajoute ses propres rubriques avec
 * `CompleterMessages`. Les quatre catalogues complets pesaient 150 Ko de
 * JavaScript sur chaque page, puis le catalogue client entier 46 Ko de
 * donnees dans chaque page.
 */
export function FournisseurLangue({
  langue,
  messages,
  children,
}: {
  langue: Langue;
  messages: Arbre;
  children: React.ReactNode;
}) {
  const valeur = useMemo(() => ({ langue, messages, t: creerTDepuis(messages) }), [langue, messages]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

const estArbre = (x: unknown): x is Arbre => typeof x === "object" && x !== null;

function fusionner(base: Arbre, dessus: Arbre): Arbre {
  const sortie: Arbre = { ...base };
  for (const [cle, valeur] of Object.entries(dessus)) {
    const existant = sortie[cle];
    sortie[cle] = estArbre(valeur) && estArbre(existant) ? fusionner(existant, valeur) : valeur;
  }
  return sortie;
}

/** Ajoute au catalogue courant les rubriques propres a une page (`messagesPage`). */
export function CompleterMessages({ messages, children }: { messages: Arbre; children: React.ReactNode }) {
  const parent = useContext(Contexte);
  const valeur = useMemo(() => {
    const fusion = fusionner(parent.messages, messages);
    return { langue: parent.langue, messages: fusion, t: creerTDepuis(fusion) };
  }, [parent, messages]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useLangue(): Langue {
  return useContext(Contexte).langue;
}

export function useT(): T {
  return useContext(Contexte).t;
}
