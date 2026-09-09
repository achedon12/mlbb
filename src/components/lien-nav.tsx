"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Lien de navigation, avec indication de la section courante.
 *
 * Un lien est actif pour toute sa section, pas seulement pour son adresse
 * exacte : depuis la fiche d'un heros, c'est bien « Heros » qui doit rester
 * allume. Sans cela, on perd le fil des qu'on descend d'un niveau.
 */
export function LienNav({
  href,
  label,
  variante = "en-tete",
  onClick,
}: {
  href: string;
  label: string;
  variante?: "en-tete" | "mobile";
  onClick?: () => void;
}) {
  const chemin = usePathname();
  const actif = chemin === href || chemin.startsWith(`${href}/`);

  if (variante === "mobile") {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={actif ? "page" : undefined}
        className={cn(
          "block border-b border-nuit-800 py-3 transition-colors",
          actif ? "text-or-400" : "text-craie-300 hover:text-or-400",
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "relative block px-3 py-2 text-sm font-medium transition-colors",
        actif ? "text-or-400" : "text-craie-300 hover:text-craie-100",
      )}
    >
      {label}
      {/* Le trait sous le lien actif reprend le filet dore des titres. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-3 -bottom-px h-0.5 transition-opacity",
          actif ? "bg-or-500 opacity-100" : "opacity-0",
        )}
      />
    </Link>
  );
}
