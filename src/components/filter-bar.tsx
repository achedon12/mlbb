"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { ChipEmblem, classesChip } from "@/components/chip";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Filter bar.
 *
 * The filter walls — fifteen chips over three rows on the tier list, role,
 * lane and sort on the catalogue, rank, role and lane on the statistics —
 * filled the whole first screen of a phone before a single hero appeared.
 * They go into one compact row that sticks under the site header: the search
 * field, a "Filter" button, and whatever is currently selected, as chips that
 * one tap drops.
 *
 * The groups themselves are the `children`. They stay in the document at
 * every width — a chip is often a real link (tier list by rank, statistics by
 * rank) that search engines must follow — but are hidden below `lg`, where
 * the same nodes move into the bottom sheet (`Drawer`) the rest of the site
 * already uses. Nothing is duplicated, no state travels, and the URL keeps
 * holding the current filter exactly as before.
 */
export function FilterBar({
  label,
  search,
  active,
  count,
  clear,
  className,
  children,
}: {
  /** Name of the button and of the sheet; "Filter…" by default. */
  label?: string;
  /** Search field, shown in the bar itself at every width. */
  search?: React.ReactNode;
  /** Current selection, as removable chips (`ChipActive`). */
  active?: React.ReactNode;
  /** Number of results, aligned to the right of the bar. */
  count?: React.ReactNode;
  /** Button that drops every filter at once. */
  clear?: { label: string; onClick: () => void };
  className?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const name = label ?? t("common.filter");

  return (
    <>
      <div
        className={cn(
          "sticky top-16 z-30 mb-4 border-b border-night-700/70 bg-night-950/90 py-2 backdrop-blur",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className={cn(classesChip(false, true), "inline-flex shrink-0 items-center gap-1.5 lg:hidden")}
          >
            <SlidersHorizontal size={14} aria-hidden />
            {name}
          </button>
          {search && <div className="min-w-0 flex-1 basis-40 lg:max-w-xs">{search}</div>}
          {active}
          {clear && (
            <button type="button" onClick={clear.onClick} className={cn(classesChip(false, true), "shrink-0")}>
              {clear.label}
            </button>
          )}
          {count && <div className="ml-auto shrink-0 text-xs text-chalk-500">{count}</div>}
        </div>
        {/* Below `lg` the groups live in the sheet; they stay in the document
            so a crawler still follows the links they hold. */}
        {!open && <div className="mt-2 hidden flex-col gap-2 lg:flex">{children}</div>}
      </div>
      {open && (
        <Drawer title={name} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 px-4 pb-6 pt-4">{children}</div>
        </Drawer>
      )}
    </>
  );
}

/**
 * A filter currently applied, shown in the bar. Pressing it drops the filter:
 * the same behaviour as the chip in the panel, which is why it keeps
 * `aria-pressed` rather than inventing a "remove" button of its own. When the
 * filter is an address of its own — the tier list of a rank, of a lane — it
 * is a link back to the unfiltered page instead.
 */
export function ChipActive({
  label,
  onRemove,
  href,
  emblem,
}: {
  label: string;
  /** Drops the filter, for a filter held in the page's state. */
  onRemove?: () => void;
  /** Page without this filter, for a filter held in the address. */
  href?: string;
  /** Emblem of the rank or the role, as on the chip this one mirrors. */
  emblem?: string;
}) {
  const classes = cn(classesChip(true, true), "inline-flex shrink-0 items-center gap-1");
  const body = (
    <>
      {emblem && <ChipEmblem src={emblem} dense />}
      {label}
      <X size={12} aria-hidden />
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <button type="button" aria-pressed onClick={onRemove} className={classes}>
      {body}
    </button>
  );
}
