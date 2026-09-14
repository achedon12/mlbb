"use client";

import Link from "@/components/link";
import { classesChip } from "@/components/chip";

export interface TierRow {
  label: string;
  links: { href: string; name: string; active?: boolean }[];
}

/**
 * Chips to the other tier lists: by rank, by lane, by role. Client
 * component for weight: only the labels and the addresses travel in the
 * page data, and not seventeen times the same list of classes.
 */
export function TierRows({ rows }: { rows: TierRow[] }) {
  return rows.map((r) => (
    <nav key={r.label} aria-label={r.label} className="flex flex-wrap items-center gap-2">
      <span aria-hidden className="mr-1 shrink-0 text-xs uppercase tracking-wide text-chalk-500 sm:w-20">
        {r.label}
      </span>
      {r.links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={classesChip(!!l.active)}
        >
          {l.name}
        </Link>
      ))}
    </nav>
  ));
}
