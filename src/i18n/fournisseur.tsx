"use client";

import { createContext, useContext, useMemo } from "react";
import { LANGUE_DEFAUT, type Langue } from "./config";
import { creerTDepuis, type Arbre, type T } from "./t";

const Contexte = createContext<{ langue: Langue; t: T }>({
  langue: LANGUE_DEFAUT,
  t: (cle) => cle,
});

/**
 * Rend la langue courante et sa fonction de traduction disponibles aux
 * composants client. Le serveur transmet le seul catalogue de la page
 * (`messagesClient`) : les quatre catalogues complets pesaient 150 Ko de
 * JavaScript sur chaque page.
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
  const valeur = useMemo(() => ({ langue, t: creerTDepuis(messages) }), [langue, messages]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useLangue(): Langue {
  return useContext(Contexte).langue;
}

export function useT(): T {
  return useContext(Contexte).t;
}
