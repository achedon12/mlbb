"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/fournisseur";

/**
 * Tiroir mobile.
 *
 * Un panneau qui monte du bas de l'ecran, pour lire un detail sans perdre sa
 * place dans une longue liste. Il masque la page derriere un voile, bloque son
 * defilement et se ferme par la croix, un toucher sur le voile ou Echap.
 * Au-dela de `lg`, il ne s'affiche pas : le detail y a sa place dans la page.
 */
export function Tiroir({
  titre,
  onFermer,
  libelleFermer,
  children,
}: {
  titre: string;
  onFermer: () => void;
  /** Libelle de la croix ; « Fermer » par defaut. */
  libelleFermer?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  // La fermeture peut changer a chaque rendu : on garde la derniere sans
  // reinstaller les ecouteurs.
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  });

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    window.addEventListener("keydown", echap);
    return () => {
      document.body.style.overflow = avant;
      window.removeEventListener("keydown", echap);
    };
  }, []);

  return (
    <div className="lg:hidden">
      <div
        aria-hidden
        onClick={() => fermer.current()}
        className="fixed inset-0 z-50 bg-night-950/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="drawer fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-night-700 bg-night-900 pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-black/60"
      >
        <div className="sticky top-0 z-10 flex justify-center bg-night-900 pb-1 pt-2.5">
          <span aria-hidden className="h-1 w-10 rounded-full bg-night-600" />
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => fermer.current()}
          aria-label={libelleFermer ?? t("commun.fermer")}
          className="absolute right-3 top-2 z-10 grid size-9 place-items-center text-chalk-500 transition-colors hover:text-chalk-100"
        >
          <X size={18} aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}
