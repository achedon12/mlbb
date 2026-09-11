"use client";

import { CarteSkin, type ProprietesCarteSkin } from "@/components/carte-skin";

/**
 * Grille de vignettes de skins. Rendue par le serveur, mais portee par un
 * composant client : le navigateur ne recoit que les proprietes des cartes,
 * pas une seconde fois leur arbre complet — une annee en compte plus de cent.
 */
export function GrilleSkins({ cartes }: { cartes: ProprietesCarteSkin[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {cartes.map((c) => (
        <li key={c.href}>
          <CarteSkin {...c} />
        </li>
      ))}
    </ul>
  );
}
