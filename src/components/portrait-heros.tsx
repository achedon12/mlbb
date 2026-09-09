import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Portrait ou icone d'un heros.
 *
 * Les visuels sont servis par le site lui-meme, jamais depuis un domaine
 * tiers : `npm run sync -- --images` les range sous `public/visuels/`. Quand
 * un visuel manque, on affiche les initiales plutot qu'un trou dans la grille.
 */
export function PortraitHeros({
  source,
  nom,
  taille = "vignette",
  className,
  priorite = false,
}: {
  source: string | null;
  nom: string;
  taille?: "icone" | "vignette" | "fiche" | "skin";
  className?: string;
  priorite?: boolean;
}) {
  const dimensions = {
    icone: { classe: "size-10", px: "40px" },
    vignette: { classe: "size-14", px: "56px" },
    fiche: { classe: "h-40 w-28", px: "112px" },
    skin: { classe: "aspect-[240/390] w-full", px: "(min-width: 640px) 200px, 45vw" },
  }[taille];

  const cadre = cn(
    "biseau-sm relative shrink-0 overflow-hidden bg-nuit-800",
    dimensions.classe,
    className,
  );

  if (!source) {
    return (
      <span className={cn(cadre, "grid place-items-center")} aria-hidden>
        <span className="font-titre font-bold text-craie-500">{initiales(nom)}</span>
      </span>
    );
  }

  return (
    <span className={cadre}>
      <Image
        src={source}
        alt={`Portrait de ${nom}`}
        fill
        sizes={dimensions.px}
        priority={priorite}
        className="object-cover"
      />
    </span>
  );
}

function initiales(nom: string): string {
  return nom
    .split(/[\s'-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}
