"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";
import { abonnerFavoris, basculerFavori, favorisServeur, instantaneFavoris } from "@/lib/favoris";
import { herosParSlug } from "@/lib/donnees-client";

/** Liste des heros mis en favori, lue depuis le navigateur. */
export function FavorisCompte() {
  const favoris = useSyncExternalStore(abonnerFavoris, instantaneFavoris, favorisServeur);

  if (favoris.length === 0) {
    return (
      <p className="mt-6 text-sm leading-relaxed text-craie-500">
        Aucun favori. Sur une fiche de heros,{" "}
        <Link href="/heros" className="text-or-400 underline underline-offset-4">
          ajoutez-en un
        </Link>{" "}
        pour le retrouver ici. Les favoris sont conserves dans ce navigateur.
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-wrap gap-2">
      {favoris.map((slug) => (
        <li key={slug} className="biseau-sm flex items-center border border-nuit-700 bg-nuit-900/60">
          <Link
            href={`/heros/${slug}`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-craie-100 transition-colors hover:text-or-400"
          >
            <Star size={13} aria-hidden fill="currentColor" className="text-or-500" />
            {herosParSlug[slug] ?? slug}
          </Link>
          <button
            type="button"
            onClick={() => basculerFavori(slug)}
            aria-label={`Retirer ${herosParSlug[slug] ?? slug}`}
            className="grid size-9 place-items-center text-craie-500 transition-colors hover:text-sang-500"
          >
            <X size={14} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
