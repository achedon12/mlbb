"use client";

import { useState } from "react";
import Image from "next/image";
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

/** Les raretes vont du plus commun au plus rare : la couleur suit. */
const RARETES: Record<string, string> = {
  Common: "text-craie-300",
  Elite: "text-azur-400",
  Special: "text-emerald-400",
  Exquisite: "text-purple-400",
  Epic: "text-or-400",
  Legend: "text-sang-500",
  Collector: "text-sang-500",
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

          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActif(s.id)}
                aria-pressed={selectionne}
                className={cn(
                  "biseau-sm relative block w-full overflow-hidden border transition-colors",
                  selectionne
                    ? "border-or-500"
                    : "border-nuit-700 hover:border-or-500/50",
                )}
              >
                <span className="relative block aspect-[240/390] bg-nuit-800">
                  {source ? (
                    <Image
                      src={source}
                      alt={`${nom} — ${s.nom}`}
                      fill
                      sizes="(min-width: 768px) 160px, 30vw"
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
              className={cn(
                "mt-1 text-sm font-semibold uppercase tracking-wide",
                RARETES[skin.rarete] ?? "text-craie-300",
              )}
            >
              {skin.rarete}
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
