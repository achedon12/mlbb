import Link from "next/link";
import { donneesLd } from "@/lib/html";
import { ChevronRight } from "lucide-react";
import { site } from "@/lib/site";

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
 */
export function FilAriane({ miettes }: { miettes: Miette[] }) {
  const donnees = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: miettes.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nom,
      ...(m.href ? { item: `${site.url}${m.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }}
      />
      <nav aria-label="Fil d'Ariane">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-craie-500">
          {miettes.map((m, i) => {
            const dernier = i === miettes.length - 1;
            return (
              <li key={`${m.nom}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={12} aria-hidden className="text-craie-600" />}
                {m.href && !dernier ? (
                  <Link href={m.href} className="transition-colors hover:text-or-400">
                    {m.nom}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-craie-400">
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
