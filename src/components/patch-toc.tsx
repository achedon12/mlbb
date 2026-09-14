"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Sommaire d'une note de patch.
 *
 * Une note fait plusieurs dizaines de milliers de caracteres : sans reperes,
 * on ne trouve pas la section des ajustements de heros. Le sommaire suit la
 * lecture et met en avant la section a l'ecran.
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

    // La zone d'observation est resserree vers le haut de l'ecran : la section
    // « courante » est celle qu'on vient d'atteindre, pas celle qui occupe le
    // plus de place.
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
      <p className="font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
        {t("common.contents")}
      </p>
      <ul className="mt-3 space-y-0.5 border-l border-night-800">
        {entries.map((e) => (
          <li key={e.anchor}>
            <a
              href={`#${e.anchor}`}
              aria-current={active === e.anchor ? "true" : undefined}
              className={cn(
                "-ml-px block border-l py-1 text-sm leading-snug transition-colors",
                e.level === 3 ? "pl-6 text-xs" : "pl-3",
                active === e.anchor
                  ? "border-gold-500 text-gold-400"
                  : "border-transparent text-chalk-500 hover:text-chalk-100",
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
