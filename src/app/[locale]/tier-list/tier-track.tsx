"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { CATEGORY } from "./tier-peek";

/**
 * Counts the clicks of the tier list page in one listener: a link carrying
 * `data-track` (the action, "Hero opened", "Also see"…) and `data-track-name`
 * (its subject, a hero slug, a tool) files an event in the "Tier list"
 * category. The blocks around the ranking stay server components: only two
 * attributes travel per link, not a client component each.
 *
 * `display: contents`: the wrapper adds no box to the layout.
 */
export function TierTrack({ children }: { children: ReactNode }) {
  return (
    <div
      className="contents"
      onClick={(e) => {
        const link = (e.target as Element).closest?.("[data-track]");
        if (!link || !e.currentTarget.contains(link)) return;
        trackEvent(CATEGORY, link.getAttribute("data-track")!, link.getAttribute("data-track-name") ?? undefined);
      }}
    >
      {children}
    </div>
  );
}
