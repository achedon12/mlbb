"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Sommaire d'une note de patch.
 *
 * Une note fait plusieurs dizaines de milliers de caracteres : sans reperes,
 * on ne trouve pas la section des ajustements de heros. Le sommaire suit la
 * lecture et met en avant la section a l'ecran.
 */
export interface Entree {
  niveau: number;
  titre: string;
  ancre: string;
}

export function SommairePatch({ entrees }: { entrees: Entree[] }) {
  const t = useT();
  const [actif, setActif] = useState<string | null>(null);

  useEffect(() => {
    const titres = entrees
      .map((e) => document.getElementById(e.ancre))
      .filter((n): n is HTMLElement => n !== null);
    if (titres.length === 0) return;

    // La zone d'observation est resserree vers le haut de l'ecran : la section
    // « courante » est celle qu'on vient d'atteindre, pas celle qui occupe le
    // plus de place.
    const observateur = new IntersectionObserver(
      (entrees) => {
        const visible = entrees.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActif(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );

    for (const t of titres) observateur.observe(t);
    return () => observateur.disconnect();
  }, [entrees]);

  return (
    <nav aria-label={t("commun.sommaire")} className="lg:sticky lg:top-24">
      <p className="font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
        {t("commun.sommaire")}
      </p>
      <ul className="mt-3 space-y-0.5 border-l border-night-800">
        {entrees.map((e) => (
          <li key={e.ancre}>
            <a
              href={`#${e.ancre}`}
              aria-current={actif === e.ancre ? "true" : undefined}
              className={cn(
                "-ml-px block border-l py-1 text-sm leading-snug transition-colors",
                e.niveau === 3 ? "pl-6 text-xs" : "pl-3",
                actif === e.ancre
                  ? "border-gold-500 text-gold-400"
                  : "border-transparent text-chalk-500 hover:text-chalk-100",
              )}
            >
              {e.titre}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
