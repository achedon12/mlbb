"use client";

import { SkinCard, type PropsCardSkin } from "@/components/skin-card";

/**
 * Grille de vignettes de skins. Rendue par le serveur, mais portee par un
 * composant client : le navigateur ne recoit que les proprietes des cartes,
 * pas une seconde fois leur arbre complet — une annee en compte plus de cent.
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
