"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/fournisseur";
import { Star } from "lucide-react";
import { ClocheNotifications, useSynchroNotifications } from "@/components/notifications-favoris";
import { abonnerFavoris, basculerFavori, favorisServeur, instantaneFavoris } from "@/lib/favoris";
import { cn } from "@/lib/utils";

/**
 * Bouton de favori.
 *
 * L'etat vit dans le navigateur : `useSyncExternalStore` s'y abonne. Le
 * troisieme argument — l'instantane cote serveur — renvoie « pas favori »,
 * l'etat neutre affiche jusqu'a ce que le navigateur ait rendu la main.
 *
 * Une fois le heros en favori, une cloche propose les notifications de patch
 * (masquee si le serveur ne les offre pas). Chaque changement de favori est
 * repercute a l'abonnement, s'il y en a un.
 */
export function BoutonFavori({ heros }: { heros: string }) {
  const t = useT();
  const favoris = useSyncExternalStore(abonnerFavoris, instantaneFavoris, favorisServeur);
  const favori = favoris.includes(heros);
  useSynchroNotifications(favoris);

  return (
    <>
      <button
        type="button"
        onClick={() => basculerFavori(heros)}
        aria-pressed={favori}
        className={cn(
          "bevel-sm flex items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors",
          favori
            ? "border-gold-500 bg-gold-500/10 text-gold-400"
            : "border-night-700 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400",
        )}
      >
        <Star size={15} aria-hidden fill={favori ? "currentColor" : "none"} />
        {favori ? t("favoris.dans") : t("favoris.ajouter")}
      </button>
      {favori && <ClocheNotifications favoris={favoris} />}
    </>
  );
}
