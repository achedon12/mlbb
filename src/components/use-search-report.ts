"use client";

import { useEffect, useRef } from "react";
import { trackSiteSearch } from "@/lib/analytics";

/** Typing has stopped this long: the term is the one the visitor meant. */
export const SEARCH_SETTLE_MS = 1500;

/**
 * Reports a catalogue's search field to Matomo's site search, once the
 * visitor stops typing, with the number of results — 0 files it under
 * "searches with no result", which shows what the visitors look for and do
 * not find. Each term once per page, however often the list re-renders.
 */
export function useSearchReport(term: string, count: number, category: string) {
  const reported = useRef(new Set<string>());
  useEffect(() => {
    const key = term.trim().toLowerCase();
    if (!key || reported.current.has(key)) return;
    const timer = setTimeout(() => {
      reported.current.add(key);
      trackSiteSearch(key, category, count);
    }, SEARCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [term, count, category]);
}
