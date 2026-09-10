"use client";

import Link from "@/components/lien";
import { ChevronRight, House } from "lucide-react";
import { useLangue, useT } from "@/i18n/fournisseur";
import { donneesLd } from "@/lib/html";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export interface Miette {
  nom: string;
  /** Lien de la miette ; absent pour la page courante. */
  href?: string;
}

/**
 * Fil d'Ariane.
 *
 * Rend la position dans le site et emet en meme temps le balisage
 * `BreadcrumbList` : les moteurs affichent alors le chemin sous le resultat
 * plutot que l'URL brute, et le lecteur remonte d'un niveau sans la barre du
 * navigateur.
 *
 * L'accueil ouvre toujours le fil : aucune page n'a a le declarer. Le fil pose
 * son propre fond, lisible sur un en-tete illustre comme sur un fond uni.
 */
export function FilAriane({ miettes, className }: { miettes: Miette[]; className?: string }) {
  const t = useT();
  const langue = useLangue();
  const fil: Miette[] = [{ nom: t("commun.accueil"), href: "/" }, ...miettes];
  // Les moteurs veulent des adresses completes, langue comprise : un lien sans
  // prefixe n'est resolu que par la redirection du proxy.
  const adresse = (href: string) => `${site.url}/${langue}${href === "/" ? "" : href}`;
  const donnees = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: fil.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nom,
      ...(m.href ? { item: adresse(m.href) } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }}
      />
      <nav aria-label={t("commun.filAriane")} className={className}>
        <ol className="biseau-sm inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 border border-nuit-700/60 bg-nuit-950/70 px-3 py-1.5 text-sm backdrop-blur-sm">
          {fil.map((m, i) => {
            const dernier = i === fil.length - 1;
            const accueil = i === 0;
            return (
              <li key={`${m.nom}-${i}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} aria-hidden className="shrink-0 text-craie-600" />}
                {m.href && !dernier ? (
                  <Link
                    href={m.href}
                    className="flex items-center gap-1.5 text-craie-400 transition-colors hover:text-or-400"
                  >
                    {accueil && <House size={14} aria-hidden className="shrink-0" />}
                    {/* Sur mobile, la maison suffit a dire « accueil ». */}
                    <span className={cn(accueil && "sr-only sm:not-sr-only")}>{m.nom}</span>
                  </Link>
                ) : (
                  <span aria-current="page" className="truncate font-medium text-craie-100">
                    {m.nom}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
