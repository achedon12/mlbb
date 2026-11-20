"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Table of contents of a patch note.
 *
 * A note runs to tens of thousands of characters: without landmarks, the
 * hero adjustments section is impossible to find. The table of contents
 * follows the reading and highlights the section on screen.
 */
export interface Entry {
  level: number;
  title: string;
  anchor: string;
}

export function PatchToc({ entries }: { entries: Entry[] }) {
  const t = useT();
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const titles = entries
      .map((e) => document.getElementById(e.anchor))
      .filter((n): n is HTMLElement => n !== null);
    if (titles.length === 0) return;

    // The observed area is narrowed towards the top of the screen: the
    // "current" section is the one just reached, not the one taking up the
    // most space.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );

    for (const t of titles) observer.observe(t);
    return () => observer.disconnect();
  }, [entries]);

  return (
    <nav aria-label={t("common.contents")} className="lg:sticky lg:top-24">
      <p className="display-caps text-2xl font-extrabold text-chalk-100">{t("common.contents")}</p>
      <div aria-hidden className="eclat mt-2 h-[3px] w-14" />
      <ul className="mt-4 space-y-0.5 border-l border-night-700">
        {entries.map((e) => (
          <li key={e.anchor}>
            <a
              href={`#${e.anchor}`}
              aria-current={active === e.anchor ? "true" : undefined}
              className={cn(
                // The active entry carries the éclat: a blade of light down its left edge.
                "relative -ml-px block py-1 text-sm leading-snug transition-colors before:absolute before:inset-y-0.5 before:-left-px before:w-[3px] before:origin-top before:bg-linear-to-b before:from-gold-300 before:via-gold-400 before:to-gold-600 before:transition-transform before:duration-200",
                e.level === 3 ? "pl-6 text-xs" : "pl-3",
                active === e.anchor
                  ? "font-semibold text-gold-400 before:scale-y-100"
                  : "text-chalk-400 before:scale-y-0 hover:text-chalk-100 hover:before:scale-y-100 hover:before:opacity-50",
              )}
            >
              {e.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
