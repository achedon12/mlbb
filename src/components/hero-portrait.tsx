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
/**
 * Icones de heros : webp de 4 a 10 Ko, deja reduits a la synchronisation. En
 * petite taille, l'optimiseur n'y gagne rien et son srcset alourdissait chaque
 * vignette d'une liste de 200 octets de HTML : on les sert telles quelles.
 */
const ICON_LOCALE = /^\/visuels\/heros\/[^/]+\/icone\.[a-z]+$/;
const SIZE_MAX_ICON = 56;

const DIMENSIONS = {
  micro: { sizeClass: "size-6", px: 24, text: "text-[0.55rem]" },
  mini: { sizeClass: "size-7", px: 28, text: "text-[0.6rem]" },
  small: { sizeClass: "size-8", px: 32, text: "text-xs" },
  icon: { sizeClass: "size-10", px: 40, text: "text-sm" },
  medium: { sizeClass: "size-11", px: 44, text: "text-base" },
  thumb: { sizeClass: "size-14", px: 56, text: "text-lg" },
  sheet: { sizeClass: "h-40 w-28", px: 112, height: 160, text: "text-2xl" },
  skin: { sizeClass: "aspect-[240/390] w-full", px: null, text: "text-2xl" },
} as const;

export function HeroPortrait({
  source,
  name,
  size = "thumb",
  className,
  priority = false,
  decorative = false,
  alt,
}: {
  source: string | null;
  name: string;
  size?: keyof typeof DIMENSIONS;
  className?: string;
  priority?: boolean;
  /** Vignette posee a cote du nom : l'image n'apprend rien de plus aux lecteurs d'ecran. */
  decorative?: boolean;
  /** Texte alternatif ; a defaut, le nom du heros, lisible dans toutes les langues. */
  alt?: string;
}) {
  const dimensions = DIMENSIONS[size];
  const frame = cn("bevel-sm relative shrink-0 overflow-hidden bg-night-800", dimensions.sizeClass, className);

  if (!source) {
    return (
      <span className={cn(frame, "grid place-items-center")} aria-hidden>
        <span className={cn("font-heading font-bold text-chalk-500", dimensions.text)}>{initials(name)}</span>
      </span>
    );
  }

  return (
    <span className={frame}>
      {/*
        Taille fixe : largeur et hauteur connues, le navigateur n'a que deux
        versions a choisir (1x, 2x) au lieu de quinze — des dizaines de Ko de
        HTML en moins sur les listes. Seul le skin, fluide, garde `sizes`.
      */}
      {dimensions.px === null ? (
        <Image
          src={source}
          alt={decorative ? "" : (alt ?? name)}
          fill
          sizes="(min-width: 640px) 200px, 45vw"
          priority={priority}
          className="object-cover"
        />
      ) : (
        <Image
          src={source}
          alt={decorative ? "" : (alt ?? name)}
          width={dimensions.px}
          height={"height" in dimensions ? dimensions.height : dimensions.px}
          unoptimized={dimensions.px <= SIZE_MAX_ICON && ICON_LOCALE.test(source)}
          priority={priority}
          className="size-full object-cover"
        />
      )}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/[\s'-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}
