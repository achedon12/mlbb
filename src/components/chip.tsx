import { cn } from "@/lib/utils";

/** Apparence d'une puce, reprise par les liens qui jouent le meme role. */
export function classesChip(active: boolean, dense = false) {
  return cn(
    "bevel-sm font-medium transition-colors",
    dense ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
    active
      ? "bg-gold-500 text-night-950"
      : "border border-night-700 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400",
  );
}

/**
 * Bouton-filtre : dore quand il est actif, en contour sinon. Le meme partout —
 * rang, position, role, categorie, tri — pour qu'un filtre se reconnaisse
 * d'une page a l'autre.
 */
export function Chip({
  active,
  onClick,
  dense = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={classesChip(active, dense)}
    >
      {children}
    </button>
  );
}

/** Rangee de puces a choix unique : un second clic sur la puce active la relache. */
export function ChoiceUnique<T extends string>({
  legend,
  values,
  active,
  onChange,
  label,
}: {
  legend: string;
  values: readonly T[];
  active: T | null;
  onChange: (v: T | null) => void;
  label: (v: T) => string;
}) {
  return (
    <FilterGroup legend={legend}>
      {values.map((v) => (
        <Chip key={v} active={active === v} onClick={() => onChange(active === v ? null : v)}>
          {label(v)}
        </Chip>
      ))}
    </FilterGroup>
  );
}

/** Rangee de filtres et son intitule, annonce aussi aux lecteurs d'ecran. */
export function FilterGroup({
  legend,
  widthLegend = "w-20",
  className,
  children,
}: {
  legend: string;
  /** Largeur de l'intitule visible, pour aligner plusieurs rangees. */
  widthLegend?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn("flex flex-wrap items-center gap-2", className)}>
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden className={cn("mr-1 shrink-0 text-xs uppercase tracking-wide text-chalk-500", widthLegend)}>
        {legend}
      </span>
      {children}
    </fieldset>
  );
}
