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
const ICONE_LOCALE = /^\/visuels\/heros\/[^/]+\/icone\.[a-z]+$/;
const TAILLE_MAX_ICONE = 56;

const DIMENSIONS = {
  micro: { classe: "size-6", px: 24, texte: "text-[0.55rem]" },
  mini: { classe: "size-7", px: 28, texte: "text-[0.6rem]" },
  petite: { classe: "size-8", px: 32, texte: "text-xs" },
  icone: { classe: "size-10", px: 40, texte: "text-sm" },
  moyenne: { classe: "size-11", px: 44, texte: "text-base" },
  vignette: { classe: "size-14", px: 56, texte: "text-lg" },
  fiche: { classe: "h-40 w-28", px: 112, hauteur: 160, texte: "text-2xl" },
  skin: { classe: "aspect-[240/390] w-full", px: null, texte: "text-2xl" },
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
  const cadre = cn("bevel-sm relative shrink-0 overflow-hidden bg-night-800", dimensions.classe, className);

  if (!source) {
    return (
      <span className={cn(cadre, "grid place-items-center")} aria-hidden>
        <span className={cn("font-heading font-bold text-chalk-500", dimensions.texte)}>{initiales(nom)}</span>
      </span>
    );
  }

  return (
    <span className={cadre}>
      {/*
        Taille fixe : largeur et hauteur connues, le navigateur n'a que deux
        versions a choisir (1x, 2x) au lieu de quinze — des dizaines de Ko de
        HTML en moins sur les listes. Seul le skin, fluide, garde `sizes`.
      */}
      {dimensions.px === null ? (
        <Image
          src={source}
          alt={decoratif ? "" : (alt ?? nom)}
          fill
          sizes="(min-width: 640px) 200px, 45vw"
          priority={priorite}
          className="object-cover"
        />
      ) : (
        <Image
          src={source}
          alt={decoratif ? "" : (alt ?? nom)}
          width={dimensions.px}
          height={"hauteur" in dimensions ? dimensions.hauteur : dimensions.px}
          unoptimized={dimensions.px <= TAILLE_MAX_ICONE && ICONE_LOCALE.test(source)}
          priority={priorite}
          className="size-full object-cover"
        />
      )}
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
