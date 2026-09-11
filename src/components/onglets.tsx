"use client";

import { useId, useRef, useState } from "react";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Onglets.
 *
 * La fiche d'un heros empile analyse, competences, contres, builds et parfois
 * quatorze skins : d'un seul tenant, elle devient impraticable. Les onglets
 * decoupent sans rien cacher.
 *
 * Tous les panneaux sont rendus par le serveur et restent dans le document —
 * seul l'affichage change. Le contenu masque reste donc indexable, et la
 * navigation ne declenche aucune requete.
 *
 * Les images d'un panneau masque restent en chargement differe : le navigateur
 * ne les demande qu'a l'ouverture du panneau (verifie dans Chromium). La
 * premiere visite ne charge ainsi que l'onglet affiche.
 */
export interface Onglet {
  id: string;
  label: string;
  /** Compteur affiche a cote du libelle, quand il apporte quelque chose. */
  compteur?: number;
  contenu: React.ReactNode;
}

export function Onglets({ onglets }: { onglets: Onglet[] }) {
  const t = useT();
  const [actif, setActif] = useState(onglets[0]?.id);
  const base = useId();
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);

  // Un onglet sans contenu n'a pas de raison d'apparaitre : un heros sans
  // skin ni analyse ne doit pas afficher des sections vides.
  const visibles = onglets.filter((o) => o.contenu);

  /** Fleches et Debut/Fin, comme l'attend un lecteur d'ecran sur des onglets. */
  function auClavier(evenement: React.KeyboardEvent, index: number) {
    const touches: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: visibles.length - 1,
    };
    const cible = touches[evenement.key];
    if (cible === undefined) return;

    evenement.preventDefault();
    const suivant = (cible + visibles.length) % visibles.length;
    setActif(visibles[suivant].id);
    boutons.current[suivant]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("commun.sections")}
        className="flex flex-wrap gap-1 border-b border-nuit-700/70"
      >
        {visibles.map((o, i) => {
          const selectionne = o.id === actif;
          return (
            <button
              key={o.id}
              ref={(el) => {
                boutons.current[i] = el;
              }}
              role="tab"
              id={`${base}-${o.id}`}
              aria-selected={selectionne}
              aria-controls={`${base}-${o.id}-panneau`}
              tabIndex={selectionne ? 0 : -1}
              onClick={() => setActif(o.id)}
              onKeyDown={(e) => auClavier(e, i)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 font-titre text-sm font-semibold transition-colors",
                selectionne
                  ? "border-or-500 text-or-400"
                  : "border-transparent text-craie-500 hover:text-craie-100",
              )}
            >
              {o.label}
              {o.compteur !== undefined && (
                <span className="ml-1.5 text-xs font-medium text-craie-500">
                  {o.compteur}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visibles.map((o) => (
        <div
          key={o.id}
          role="tabpanel"
          id={`${base}-${o.id}-panneau`}
          aria-labelledby={`${base}-${o.id}`}
          hidden={o.id !== actif}
          tabIndex={0}
          className="pt-8 outline-none"
        >
          {o.contenu}
        </div>
      ))}
    </div>
  );
}
