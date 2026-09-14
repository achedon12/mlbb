"use client";

import { useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import { subscribeToFavourites, serverFavourites, snapshotFavourites } from "@/lib/favourites";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

/**
 * Star marking a favourite hero in a list.
 *
 * The state lives in the browser; the component renders nothing while the
 * hero is not a favourite, so as not to clutter the card. It lets you spot
 * your favourites at a glance while browsing the catalogue.
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
