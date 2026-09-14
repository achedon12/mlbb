import { cn } from "@/lib/utils";

/** Chip styling, reused by links that play the same role. */
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
 * Filter button: gold when active, outlined otherwise. The same everywhere —
 * rank, lane, role, category, sort — so a filter is recognisable from one
 * page to the next.
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

/** Single-choice chip row: a second click on the active chip releases it. */
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

/** Filter row and its label, also announced to screen readers. */
export function FilterGroup({
  legend,
  widthLegend = "w-20",
  className,
  children,
}: {
  legend: string;
  /** Width of the visible label, to align several rows. */
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
