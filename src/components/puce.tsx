import { cn } from "@/lib/utils";

/** Apparence d'une puce, reprise par les liens qui jouent le meme role. */
export function classesPuce(actif: boolean, dense = false) {
  return cn(
    "bevel-sm font-medium transition-colors",
    dense ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
    actif
      ? "bg-gold-500 text-night-950"
      : "border border-night-700 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400",
  );
}

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
      className={classesPuce(actif, dense)}
    >
      {children}
    </button>
  );
}

/** Rangee de puces a choix unique : un second clic sur la puce active la relache. */
export function ChoixUnique<T extends string>({
  legende,
  valeurs,
  actif,
  onChange,
  libelle,
}: {
  legende: string;
  valeurs: readonly T[];
  actif: T | null;
  onChange: (v: T | null) => void;
  libelle: (v: T) => string;
}) {
  return (
    <GroupeFiltres legende={legende}>
      {valeurs.map((v) => (
        <Puce key={v} actif={actif === v} onClick={() => onChange(actif === v ? null : v)}>
          {libelle(v)}
        </Puce>
      ))}
    </GroupeFiltres>
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
      <span aria-hidden className={cn("mr-1 shrink-0 text-xs uppercase tracking-wide text-chalk-500", largeurLegende)}>
        {legende}
      </span>
      {children}
    </fieldset>
  );
}
