"use client";

import { useState } from "react";
import Image from "next/image";
import { rarete } from "@/lib/raretes";
import type { Skin } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Galerie des skins d'un heros.
 *
 * Une grille compacte, et un panneau qui detaille le skin choisi. Le premier
 * skin est selectionne d'emblee pour que le panneau ne soit jamais vide.
 *
 * Les monnaies du jeu portent des sigles peu parlants : on les traduit.
 */
const MONNAIES: Record<string, string> = {
  bp: "Points de bataille",
  dm: "Diamants",
  ticket: "Tickets",
  hf: "Fragments de heros",
  lg: "Gemmes",
};

export function GalerieSkins({
  nom,
  skins,
  visuels,
}: {
  nom: string;
  skins: Skin[];
  visuels: Record<string, string>;
}) {
  const [actif, setActif] = useState(skins[0]?.id ?? "");
  const skin = skins.find((s) => s.id === actif) ?? skins[0];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {skins.map((s) => {
          const source = visuels[s.id];
          const selectionne = s.id === skin?.id;
          const r = rarete(s.rarete);

          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActif(s.id)}
                aria-pressed={selectionne}
                title={`${s.nom} — ${r.nom}`}
                // Le contour porte la rarete, comme dans le jeu : on reconnait
                // un skin Legend avant d'avoir lu son nom. La selection ajoute
                // un halo plutot que de remplacer la couleur, qui reste
                // l'information la plus utile.
                style={{
                  borderColor: r.couleur,
                  boxShadow: selectionne ? `0 0 0 2px ${r.halo}, 0 0 14px ${r.halo}` : undefined,
                }}
                className={cn(
                  "biseau-sm relative block w-full overflow-hidden border-2 transition-shadow",
                  !selectionne && "hover:shadow-[0_0_10px_var(--halo)]",
                )}
              >
                <span className="relative block aspect-[240/390] bg-nuit-800">
                  {source ? (
                    <Image
                      src={source}
                      alt={`${nom} — ${s.nom}`}
                      fill
                      sizes="(min-width: 768px) 160px, 30vw"
                      loading="eager"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-xs text-craie-500">
                      sans visuel
                    </span>
                  )}
                </span>
                <span className="block truncate bg-nuit-900 px-1.5 py-1 text-[0.65rem] leading-tight text-craie-300">
                  {s.nom}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {skin && (
        <aside className="biseau h-fit border border-nuit-700/70 bg-nuit-900/60 p-5 lg:sticky lg:top-24">
          <h3 className="font-titre text-xl font-bold text-craie-100">{skin.nom}</h3>

          {skin.rarete && (
            <p
              className="mt-1 text-sm font-semibold uppercase tracking-wide"
              style={{ color: rarete(skin.rarete).couleur }}
            >
              {rarete(skin.rarete).nom}
            </p>
          )}

          <dl className="mt-5 space-y-3 text-sm">
            {skin.sortie && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Sortie</dt>
                <dd className="mt-0.5 text-craie-100">{skin.sortie}</dd>
              </div>
            )}
            {skin.disponibilite && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Disponibilite</dt>
                <dd className="mt-0.5 text-craie-100">{skin.disponibilite}</dd>
              </div>
            )}
            {skin.etiquette && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Obtention</dt>
                <dd className="mt-0.5 text-craie-100">{skin.etiquette}</dd>
              </div>
            )}
            {Object.entries(skin.prix).length > 0 && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Prix</dt>
                <dd className="mt-1 space-y-0.5">
                  {Object.entries(skin.prix).map(([monnaie, valeur]) => (
                    <span key={monnaie} className="block text-craie-100">
                      {valeur}{" "}
                      <span className="text-craie-500">{MONNAIES[monnaie] ?? monnaie}</span>
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      )}
    </div>
  );
}
