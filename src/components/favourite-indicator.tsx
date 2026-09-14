"use client";

import { useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import { subscribeToFavourites, serverFavourites, snapshotFavourites } from "@/lib/favourites";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

/**
 * Etoile marquant un heros favori dans une liste.
 *
 * L'etat vit dans le navigateur ; le composant ne rend rien tant que le heros
 * n'est pas favori, pour ne pas encombrer la carte. Il permet de reperer ses
 * favoris d'un coup d'oeil en parcourant le catalogue.
 */
export function FavouriteIndicator({ slug, className }: { slug: string; className?: string }) {
  const t = useT();
  const favourites = useSyncExternalStore(subscribeToFavourites, snapshotFavourites, serverFavourites);
  if (!favourites.includes(slug)) return null;

  return (
    <Star
      size={14}
      aria-label={t("favourites.in")}
      className={cn("shrink-0 text-gold-500", className)}
      fill="currentColor"
    />
  );
}
