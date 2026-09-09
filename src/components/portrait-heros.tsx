import Image from "next/image";
import { initiales, portrait } from "@/lib/portraits";
import { cn } from "@/lib/utils";

/**
 * Portrait d'un heros.
 *
 * Rend un substitut lisible quand l'image n'est pas connue, plutot qu'un trou
 * dans la grille. `sizes` est fourni pour que Next ne serve pas une image de
 * 400 px de large dans une vignette de 56 px.
 */
export function PortraitHeros({
  slug,
  nom,
  taille = "vignette",
  className,
}: {
  slug: string;
  nom: string;
  taille?: "vignette" | "fiche";
  className?: string;
}) {
  const source = portrait(slug);
  const fiche = taille === "fiche";

  const cadre = cn(
    "biseau-sm relative shrink-0 overflow-hidden bg-nuit-800",
    fiche ? "size-28" : "size-14",
    className,
  );

  if (!source) {
    return (
      <span className={cn(cadre, "grid place-items-center")} aria-hidden>
        <span className={cn("font-titre font-bold text-craie-500", fiche ? "text-3xl" : "text-base")}>
          {initiales(nom)}
        </span>
      </span>
    );
  }

  return (
    <span className={cadre}>
      <Image
        src={source}
        alt={`Portrait de ${nom}`}
        fill
        sizes={fiche ? "112px" : "56px"}
        className="object-cover"
      />
    </span>
  );
}
