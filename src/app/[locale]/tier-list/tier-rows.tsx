"use client";

import Link from "@/components/link";
import { classesChip } from "@/components/chip";

export interface TierRow {
  label: string;
  links: { href: string; name: string; active?: boolean }[];
}

/**
 * Puces vers les autres tier lists : par rang, par lane, par role. Composant
 * client pour le poids : seuls les libelles et les adresses voyagent dans les
 * donnees de la page, et non dix-sept fois la meme liste de classes.
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
