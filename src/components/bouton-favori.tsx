"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/fournisseur";
import { Star } from "lucide-react";
import { abonnerFavoris, basculerFavori, favorisServeur, instantaneFavoris } from "@/lib/favoris";
import { cn } from "@/lib/utils";

/**
 * Bouton de favori.
 *
 * L'etat vit dans le navigateur : `useSyncExternalStore` s'y abonne. Le
 * troisieme argument — l'instantane cote serveur — renvoie « pas favori »,
 * l'etat neutre affiche jusqu'a ce que le navigateur ait rendu la main.
 */
export function BoutonFavori({ heros }: { heros: string }) {
  const t = useT();
  const favoris = useSyncExternalStore(abonnerFavoris, instantaneFavoris, favorisServeur);
  const favori = favoris.includes(heros);

  return (
    <button
      type="button"
      onClick={() => basculerFavori(heros)}
      aria-pressed={favori}
      className={cn(
        "biseau-sm flex items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors",
        favori
          ? "border-or-500 bg-or-500/10 text-or-400"
          : "border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
      )}
    >
      <Star size={15} aria-hidden fill={favori ? "currentColor" : "none"} />
      {favori ? t("favoris.dans") : t("favoris.ajouter")}
    </button>
  );
}
