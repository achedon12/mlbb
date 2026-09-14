"use client";

import { SkinCard, type PropsCardSkin } from "@/components/skin-card";

/**
 * Grid of skin thumbnails. Rendered by the server, but carried by a client
 * component: the browser only receives the cards' props, not their full tree
 * a second time — a year holds more than a hundred.
 */
export function SkinGrid({ cards }: { cards: PropsCardSkin[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {cards.map((c) => (
        <li key={c.href}>
          <SkinCard {...c} />
        </li>
      ))}
    </ul>
  );
}
