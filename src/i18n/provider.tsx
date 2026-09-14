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
 * Makes the current language and its translation function available to
 * client components. The layout passes the shared catalog
 * (`messagesClient`); a page adds its own sections with
 * `ExtendMessages`. The four full catalogs weighed 150 KB of
 * JavaScript on every page, then the whole client catalog 46 KB of
 * data in every page.
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

/** Adds a page's own sections (`messagesPage`) to the current catalog. */
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
