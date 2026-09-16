import { LightImage } from "@/components/light-image";
import Link from "@/components/link";
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
 * Emblem shown inside a chip. Purely decorative: the chip's own text names
 * the rank or the role, and a second reading of the same word helps no one.
 * Fixed size, so a chip keeps its height while the image loads.
 */
export function ChipEmblem({ src, dense = false }: { src: string; dense?: boolean }) {
  const size = dense ? 16 : 20;
  return (
    <LightImage src={src} alt="" width={size} height={size} className="-ml-0.5 shrink-0 object-contain" />
  );
}

/**
 * Filter button: gold when active, outlined otherwise. The same everywhere —
 * rank, lane, role, category, sort — so a filter is recognisable from one
 * page to the next. A rank or a role carries its emblem, recognised before
 * its name is read.
 */
export function Chip({
  active,
  onClick,
  dense = false,
  emblem,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dense?: boolean;
  /** Address of the rank or role emblem, shown before the label. */
  emblem?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(classesChip(active, dense), emblem && "inline-flex items-center gap-1.5")}
    >
      {emblem && <ChipEmblem src={emblem} dense={dense} />}
      {children}
    </button>
  );
}

/**
 * Chip that is a link: the tier list of a rank, the statistics of a rank —
 * filters that have an address of their own, which crawlers must follow.
 */
export function LinkChip({
  href,
  label,
  current,
  emblem,
  dense = false,
}: {
  href: string;
  label: string;
  /** The page we are on, marked for assistive technology as for the eye. */
  current?: boolean;
  emblem?: string;
  dense?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(classesChip(!!current, dense), emblem && "inline-flex items-center gap-1.5")}
    >
      {emblem && <ChipEmblem src={emblem} dense={dense} />}
      {label}
    </Link>
  );
}

/** Single-choice chip row: a second click on the active chip releases it. */
export function ChoiceUnique<T extends string>({
  legend,
  values,
  active,
  onChange,
  label,
  emblem,
}: {
  legend: string;
  values: readonly T[];
  active: T | null;
  onChange: (v: T | null) => void;
  label: (v: T) => string;
  /** Emblem of each value, when it has one (a rank, a role). */
  emblem?: (v: T) => string | undefined;
}) {
  return (
    <FilterGroup legend={legend}>
      {values.map((v) => (
        <Chip
          key={v}
          active={active === v}
          emblem={emblem?.(v)}
          onClick={() => onChange(active === v ? null : v)}
        >
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
