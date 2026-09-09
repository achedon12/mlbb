"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Illustrations pleine taille.
 *
 * Les portraits de la boutique font 240 px de large ; ces illustrations sont
 * les visuels d'origine, bien plus grands. Elles meritent donc d'etre vues
 * en grand plutot qu'en vignette : la grille sert a choisir, l'affichage
 * principal a regarder.
 */
export function GalerieIllustrations({
  nom,
  illustrations,
}: {
  nom: string;
  illustrations: Record<string, string>;
}) {
  const entrees = Object.entries(illustrations);
  const [actif, setActif] = useState(entrees[0]?.[0] ?? "");
  const courante = illustrations[actif] ?? entrees[0]?.[1];

  return (
    <div>
      <figure>
        <div className="biseau relative aspect-video w-full overflow-hidden bg-nuit-900">
          {courante && (
            <Image
              src={courante}
              alt={`${nom} — ${actif}`}
              fill
              sizes="(min-width: 1024px) 900px, 100vw"
              loading="eager"
              className="object-cover object-top"
            />
          )}
        </div>
        <figcaption className="mt-3 font-titre text-lg font-bold text-craie-100">
          {actif}
        </figcaption>
      </figure>

      <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {entrees.map(([skin, source]) => {
          const selectionne = skin === actif;
          return (
            <li key={skin}>
              <button
                type="button"
                onClick={() => setActif(skin)}
                aria-pressed={selectionne}
                title={skin}
                className={cn(
                  "biseau-sm relative block aspect-video w-full overflow-hidden border-2 transition-colors",
                  selectionne
                    ? "border-or-500"
                    : "border-nuit-700 hover:border-or-500/50",
                )}
              >
                <Image
                  src={source}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 150px, 30vw"
                  loading="eager"
                  className="object-cover object-top"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
