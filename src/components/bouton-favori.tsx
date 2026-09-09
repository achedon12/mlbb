"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bouton de favori.
 *
 * L'etat est charge apres l'affichage pour que la page reste generee au build.
 * Tant qu'il n'est pas connu, le bouton n'est pas rendu : mieux vaut ne rien
 * afficher qu'afficher brievement un etat faux.
 */
export function BoutonFavori({ heros }: { heros: string }) {
  const [etat, setEtat] = useState<{ connecte: boolean; favori: boolean } | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    fetch(`/api/favoris?heros=${encodeURIComponent(heros)}`)
      .then((r) => r.json())
      .then((d) => !annule && setEtat(d))
      .catch(() => !annule && setEtat({ connecte: false, favori: false }));
    return () => {
      annule = true;
    };
  }, [heros]);

  if (!etat?.connecte) return null;

  async function basculer() {
    setEnCours(true);
    try {
      const reponse = await fetch("/api/favoris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heros }),
      });
      if (reponse.ok) {
        const { favori } = (await reponse.json()) as { favori: boolean };
        setEtat({ connecte: true, favori });
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <button
      type="button"
      onClick={basculer}
      disabled={enCours}
      aria-pressed={etat.favori}
      className={cn(
        "biseau-sm flex items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        etat.favori
          ? "border-or-500 bg-or-500/10 text-or-400"
          : "border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
      )}
    >
      <Star size={15} aria-hidden fill={etat.favori ? "currentColor" : "none"} />
      {etat.favori ? "Dans mes favoris" : "Ajouter aux favoris"}
    </button>
  );
}
