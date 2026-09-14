"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";
import { Star } from "lucide-react";
import { NotificationBell, useNotificationSync } from "@/components/favourite-notifications";
import { subscribeToFavourites, toggleFavourite, serverFavourites, snapshotFavourites } from "@/lib/favourites";
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
export function FavouriteButton({ hero: heroes }: { hero: string }) {
  const t = useT();
  const favourites = useSyncExternalStore(subscribeToFavourites, snapshotFavourites, serverFavourites);
  const favourite = favourites.includes(heroes);
  useNotificationSync(favourites);

  return (
    <>
      <button
        type="button"
        onClick={() => toggleFavourite(heroes)}
        aria-pressed={favourite}
        className={cn(
          "bevel-sm flex items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors",
          favourite
            ? "border-gold-500 bg-gold-500/10 text-gold-400"
            : "border-night-700 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400",
        )}
      >
        <Star size={15} aria-hidden fill={favourite ? "currentColor" : "none"} />
        {favourite ? t("favourites.in") : t("favourites.add")}
      </button>
      {favourite && <NotificationBell favourites={favourites} />}
    </>
  );
}
