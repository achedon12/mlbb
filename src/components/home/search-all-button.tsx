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
      className="inline-flex min-h-11 items-center gap-2 py-1 text-left text-sm text-chalk-400 underline decoration-night-600 underline-offset-4 transition-colors hover:text-gold-300 hover:decoration-gold-400"
    >
      <Command size={14} aria-hidden className="shrink-0" />
      {label}
      <kbd className="bevel-sm hidden shrink-0 bg-night-800 px-1.5 py-0.5 font-sans text-[0.7rem] text-chalk-300 no-underline shadow-[inset_0_0_0_1px_var(--color-night-600)] sm:inline">Ctrl K</kbd>
    </button>
  );
}
