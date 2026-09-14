"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { createTFrom, type Tree, type T } from "./t";

const Context = createContext<{ locale: Locale; messages: Tree; t: T }>({
  locale: DEFAULT_LOCALE,
  messages: {},
  t: (key) => key,
});

/**
 * Rend la langue courante et sa fonction de traduction disponibles aux
 * composants client. La mise en page transmet le catalogue commun
 * (`messagesClient`) ; une page y ajoute ses propres rubriques avec
 * `CompleterMessages`. Les quatre catalogues complets pesaient 150 Ko de
 * JavaScript sur chaque page, puis le catalogue client entier 46 Ko de
 * donnees dans chaque page.
 */
export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Tree;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages, t: createTFrom(messages) }), [locale, messages]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

const isTree = (x: unknown): x is Tree => typeof x === "object" && x !== null;

function merge(base: Tree, above: Tree): Tree {
  const output: Tree = { ...base };
  for (const [key, value] of Object.entries(above)) {
    const existing = output[key];
    output[key] = isTree(value) && isTree(existing) ? merge(existing, value) : value;
  }
  return output;
}

/** Ajoute au catalogue courant les rubriques propres a une page (`messagesPage`). */
export function ExtendMessages({ messages, children }: { messages: Tree; children: React.ReactNode }) {
  const parent = useContext(Context);
  const value = useMemo(() => {
    const merged = merge(parent.messages, messages);
    return { locale: parent.locale, messages: merged, t: createTFrom(merged) };
  }, [parent, messages]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLocale(): Locale {
  return useContext(Context).locale;
}

export function useT(): T {
  return useContext(Context).t;
}
