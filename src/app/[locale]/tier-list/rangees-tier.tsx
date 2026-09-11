"use client";

import Link from "@/components/lien";
import { classesPuce } from "@/components/puce";

export interface RangeeTier {
  libelle: string;
  liens: { href: string; nom: string; actif?: boolean }[];
}

/**
 * Puces vers les autres tier lists : par rang, par lane, par role. Composant
 * client pour le poids : seuls les libelles et les adresses voyagent dans les
 * donnees de la page, et non dix-sept fois la meme liste de classes.
 */
export function RangeesTier({ rangees }: { rangees: RangeeTier[] }) {
  return rangees.map((r) => (
    <nav key={r.libelle} aria-label={r.libelle} className="flex flex-wrap items-center gap-2">
      <span aria-hidden className="mr-1 shrink-0 text-xs uppercase tracking-wide text-craie-500 sm:w-20">
        {r.libelle}
      </span>
      {r.liens.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.actif ? "page" : undefined}
          className={classesPuce(!!l.actif)}
        >
          {l.nom}
        </Link>
      ))}
    </nav>
  ));
}
