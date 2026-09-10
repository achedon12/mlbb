"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { navigation } from "@/lib/site";
import { LienNav } from "./lien-nav";

/**
 * Menu de navigation en petite largeur.
 *
 * Seul ce fragment porte l'ouverture et la fermeture : l'en-tete reste rendu
 * sur le serveur.
 */
export function MenuMobile() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
        className="grid size-9 place-items-center text-craie-300 transition-colors hover:text-or-400"
      >
        {ouvert ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>

      <div
        id="menu-mobile"
        hidden={!ouvert}
        className="absolute inset-x-0 top-16 border-b border-nuit-700 bg-nuit-950 px-4 py-3"
      >
        <ul className="flex flex-col">
          {navigation.map((lien) => (
            <li key={lien.href}>
              <LienNav
                href={lien.href}
                label={lien.label}
                variante="mobile"
                onClick={() => setOuvert(false)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
