"use client";

import { Command } from "lucide-react";
import { OPEN_SEARCH_EVENT } from "@/components/global-search";

/**
 * Opens the header's global search from the home page. The hero form only
 * looks up heroes and works without JavaScript; this button reaches
 * everything else the index holds (items, skins, skills, pages).
 */
export function SearchAllButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      aria-keyshortcuts="Control+K Meta+K"
      className="inline-flex items-start gap-2 text-left text-sm text-chalk-400 underline decoration-night-600 underline-offset-4 transition-colors hover:text-gold-400 hover:decoration-gold-500"
    >
      <Command size={14} aria-hidden className="mt-0.5 shrink-0" />
      {label}
      <kbd className="hidden rounded border border-night-600 px-1 text-[0.7rem] text-chalk-500 no-underline sm:inline">Ctrl K</kbd>
    </button>
  );
}
