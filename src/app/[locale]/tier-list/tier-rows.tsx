"use client";

import { LinkChip } from "@/components/chip";
import { ChipActive, FilterBar } from "@/components/filter-bar";

export interface TierRow {
  label: string;
  /** `emblem`: address of the rank or role emblem, when the value has one. */
  links: { href: string; name: string; active?: boolean; emblem?: string }[];
}

/**
 * Chips to the other tier lists: by rank, by lane, by role. Client
 * component for weight: only the labels and the addresses travel in the
 * page data, and not seventeen times the same list of classes.
 *
 * Fifteen chips over three rows filled the whole first screen of a phone
 * before the first hero appeared: they now live in the filter bar's sheet,
 * with the current rank, lane or role kept visible as a chip. The links
 * themselves are still rendered at every width, so a crawler follows them.
 */
export function TierRows({ rows, home }: { rows: TierRow[]; home: string }) {
  // Only what departs from the default deserves a chip: "all ranks" is not a
  // filter, and the address it points to is the one we are on.
  const chosen = rows.flatMap((r) => r.links.filter((l) => l.active && l.href !== home));

  return (
    <FilterBar
      active={chosen.map((l) => (
        <ChipActive key={l.href} label={l.name} emblem={l.emblem} href={home} />
      ))}
    >
      {rows.map((r) => (
        <nav key={r.label} aria-label={r.label} className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="mr-1 shrink-0 text-xs uppercase tracking-wide text-chalk-500 sm:w-20">
            {r.label}
          </span>
          {r.links.map((l) => (
            <LinkChip key={l.href} href={l.href} label={l.name} current={l.active} emblem={l.emblem} />
          ))}
        </nav>
      ))}
    </FilterBar>
  );
}
