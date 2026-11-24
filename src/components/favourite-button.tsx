"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";
import { Star } from "lucide-react";
import { useAccountPrompt } from "@/components/account-prompt";
import { NotificationBell, useNotificationSync } from "@/components/favourite-notifications";
import { subscribeToFavourites, toggleFavourite, serverFavourites, snapshotFavourites } from "@/lib/favourites";

/**
 * Favourite button.
 *
 * The state lives in the browser: `useSyncExternalStore` subscribes to it. The
 * third argument (the server snapshot) returns "not a favourite", the
 * neutral state shown until the browser takes over.
 *
 * Once the hero is a favourite, a bell offers patch notifications
 * (hidden when the server does not provide them). Every favourite change is
 * passed on to the subscription, if there is one. Adding one may offer, once,
 * to sign in so the list follows the visitor to their other devices.
 */
export function FavouriteButton({ hero: heroes }: { hero: string }) {
  const t = useT();
  const favourites = useSyncExternalStore(subscribeToFavourites, snapshotFavourites, serverFavourites);
  const favourite = favourites.includes(heroes);
  useNotificationSync(favourites);
  const prompt = useAccountPrompt();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (toggleFavourite(heroes)) prompt.offer("favourite");
        }}
        aria-pressed={favourite}
        // Pressed, the star turns gold and the outline with it (`.btn-secondary[aria-pressed]`).
        className="btn btn-secondary btn-sm"
      >
        <Star size={15} aria-hidden fill={favourite ? "currentColor" : "none"} />
        {favourite ? t("favourites.in") : t("favourites.add")}
      </button>
      {favourite && <NotificationBell favourites={favourites} />}
      {prompt.card}
    </>
  );
}
