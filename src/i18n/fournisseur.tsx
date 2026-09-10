"use client";

import { createContext, useContext, useMemo } from "react";
import { LANGUE_DEFAUT, type Langue } from "./config";
import { creerT, type T } from "./traductions";

const Contexte = createContext<{ langue: Langue; t: T }>({
  langue: LANGUE_DEFAUT,
  t: creerT(LANGUE_DEFAUT),
});

/**
 * Rend la langue courante et sa fonction de traduction disponibles aux
 * composants client. Les messages sont déjà embarqués dans le bundle (petits) :
 * on ne transmet que la langue, et `creerT` fait le reste.
 */
export function FournisseurLangue({
  langue,
  children,
}: {
  langue: Langue;
  children: React.ReactNode;
}) {
  const valeur = useMemo(() => ({ langue, t: creerT(langue) }), [langue]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useLangue(): Langue {
  return useContext(Contexte).langue;
}

export function useT(): T {
  return useContext(Contexte).t;
}
