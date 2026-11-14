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
 *
 * Given the results as `content`, the bar becomes a sidebar from `xl` up: a
 * sticky column on the left with the search, the selection and every group
 * stacked, the results beside it on the rest of the width. Same nodes, the
 * layout only changes with the screen.
 */
export function FilterBar({
  label,
  search,
  active,
  count,
  clear,
  className,
  content,
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
  /** The filtered results: when given, the filters become a left sidebar from `xl` up. */
  content?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const name = label ?? t("common.filter");

  const side = content !== undefined;
  const clearButton = clear && (
    <button type="button" onClick={clear.onClick} className={cn(classesChip(false, true), "shrink-0")}>
      {clear.label}
    </button>
  );

  const bar = (
    <div
      className={cn(
        "sticky top-16 z-30 mb-4 border-b border-night-700/70 bg-night-950/90 py-2 backdrop-blur",
        side &&
          "xl:top-20 xl:mb-0 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:border-b-0 xl:border-r xl:bg-transparent xl:py-1 xl:pr-5 xl:backdrop-blur-none",
        className,
      )}
    >
      <div className={cn("flex flex-wrap items-center gap-2", side && "xl:flex-col xl:items-stretch")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={cn(classesChip(false, true), "inline-flex shrink-0 items-center gap-1.5 lg:hidden")}
        >
          <SlidersHorizontal size={14} aria-hidden />
          {name}
        </button>
        {search && (
          <div className={cn("min-w-0 flex-1 basis-40 lg:max-w-xs", side && "xl:max-w-none xl:flex-none xl:basis-auto")}>
            {search}
          </div>
        )}
        {side ? (
          <div className="contents xl:flex xl:flex-wrap xl:items-center xl:gap-2 xl:empty:hidden">
            {active}
            {clearButton}
          </div>
        ) : (
          <>
            {active}
            {clearButton}
          </>
        )}
        {count && (
          <div className={cn("ml-auto shrink-0 text-xs text-chalk-500", side && "xl:order-first xl:ml-0")}>{count}</div>
        )}
      </div>
      {/* Below `lg` the groups live in the sheet; they stay in the document
          so a crawler still follows the links they hold. */}
      {!open && (
        <div
          className={cn(
            "mt-2 hidden flex-col gap-2 lg:flex",
            // In the sidebar each group's label takes its own line above its chips.
            side && "xl:mt-5 xl:gap-5 xl:[&_.filter-legend]:w-full",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );

  return (
    <>
      {side ? (
        <div className="xl:grid xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start xl:gap-8">
          {bar}
          <div className="min-w-0">{content}</div>
        </div>
      ) : (
        bar
      )}
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
