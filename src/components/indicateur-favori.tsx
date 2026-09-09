"use client";

import { useSyncExternalStore } from "react";
import { Star } from "lucide-react";
import { abonnerFavoris, favorisServeur, instantaneFavoris } from "@/lib/favoris";
import { cn } from "@/lib/utils";

/**
 * Etoile marquant un heros favori dans une liste.
 *
 * L'etat vit dans le navigateur ; le composant ne rend rien tant que le heros
 * n'est pas favori, pour ne pas encombrer la carte. Il permet de reperer ses
 * favoris d'un coup d'oeil en parcourant le catalogue.
 */
export function IndicateurFavori({ slug, className }: { slug: string; className?: string }) {
  const favoris = useSyncExternalStore(abonnerFavoris, instantaneFavoris, favorisServeur);
  if (!favoris.includes(slug)) return null;

  return (
    <Star
      size={14}
      aria-label="Dans vos favoris"
      className={cn("shrink-0 text-or-500", className)}
      fill="currentColor"
    />
  );
}
