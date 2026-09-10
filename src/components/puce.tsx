import { cn } from "@/lib/utils";

/**
 * Bouton-filtre : dore quand il est actif, en contour sinon. Le meme partout —
 * rang, position, role, categorie, tri — pour qu'un filtre se reconnaisse
 * d'une page a l'autre.
 */
export function Puce({
  actif,
  onClick,
  dense = false,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={cn(
        "biseau-sm font-medium transition-colors",
        dense ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        actif
          ? "bg-or-500 text-nuit-950"
          : "border border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
      )}
    >
      {children}
    </button>
  );
}

/** Rangee de filtres et son intitule, annonce aussi aux lecteurs d'ecran. */
export function GroupeFiltres({
  legende,
  largeurLegende = "w-20",
  className,
  children,
}: {
  legende: string;
  /** Largeur de l'intitule visible, pour aligner plusieurs rangees. */
  largeurLegende?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn("flex flex-wrap items-center gap-2", className)}>
      <legend className="sr-only">{legende}</legend>
      <span aria-hidden className={cn("mr-1 shrink-0 text-xs uppercase tracking-wide text-craie-500", largeurLegende)}>
        {legende}
      </span>
      {children}
    </fieldset>
  );
}
