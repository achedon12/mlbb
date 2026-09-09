"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { navigation } from "@/lib/site";

/**
 * Menu de navigation en petite largeur.
 *
 * Seul ce fragment est un composant client : l'en-tete reste rendu sur le
 * serveur, et aucun JavaScript n'est envoye pour la navigation en grande
 * largeur.
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
              <Link
                href={lien.href}
                onClick={() => setOuvert(false)}
                className="block border-b border-nuit-800 py-3 text-craie-300 transition-colors hover:text-or-400"
              >
                {lien.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
