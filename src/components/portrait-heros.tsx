import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Portrait ou icone d'un heros.
 *
 * Les visuels sont servis par le site lui-meme, jamais depuis un domaine
 * tiers : `npm run sync -- --images` les range sous `public/visuels/`. Quand
 * un visuel manque, on affiche les initiales plutot qu'un trou dans la grille.
 *
 * Toutes les vignettes de heros du site passent par ici, de la plus petite
 * (liste deroulante) a la fiche.
 */
const DIMENSIONS = {
  micro: { classe: "size-6", px: "24px", texte: "text-[0.55rem]" },
  mini: { classe: "size-7", px: "28px", texte: "text-[0.6rem]" },
  petite: { classe: "size-8", px: "32px", texte: "text-xs" },
  icone: { classe: "size-10", px: "40px", texte: "text-sm" },
  moyenne: { classe: "size-11", px: "44px", texte: "text-base" },
  vignette: { classe: "size-14", px: "56px", texte: "text-lg" },
  fiche: { classe: "h-40 w-28", px: "112px", texte: "text-2xl" },
  skin: { classe: "aspect-[240/390] w-full", px: "(min-width: 640px) 200px, 45vw", texte: "text-2xl" },
} as const;

export function PortraitHeros({
  source,
  nom,
  taille = "vignette",
  className,
  priorite = false,
  decoratif = false,
  alt,
}: {
  source: string | null;
  nom: string;
  taille?: keyof typeof DIMENSIONS;
  className?: string;
  priorite?: boolean;
  /** Vignette posee a cote du nom : l'image n'apprend rien de plus aux lecteurs d'ecran. */
  decoratif?: boolean;
  /** Texte alternatif ; a defaut, le nom du heros, lisible dans toutes les langues. */
  alt?: string;
}) {
  const dimensions = DIMENSIONS[taille];
  const cadre = cn("biseau-sm relative shrink-0 overflow-hidden bg-nuit-800", dimensions.classe, className);

  if (!source) {
    return (
      <span className={cn(cadre, "grid place-items-center")} aria-hidden>
        <span className={cn("font-titre font-bold text-craie-500", dimensions.texte)}>{initiales(nom)}</span>
      </span>
    );
  }

  return (
    <span className={cadre}>
      <Image
        src={source}
        alt={decoratif ? "" : (alt ?? nom)}
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
