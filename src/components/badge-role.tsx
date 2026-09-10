"use client";

import { useT } from "@/i18n/fournisseur";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Couleurs par role, reprises de la charte du jeu. */
const COULEUR_ROLE: Record<Role, string> = {
  Tank: "bg-azur-500/15 text-azur-400 ring-azur-500/30",
  Fighter: "bg-sang-500/15 text-sang-500 ring-sang-500/30",
  Assassin: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  Mage: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/30",
  Marksman: "bg-or-500/15 text-or-400 ring-or-500/30",
  Support: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
};

export function BadgeRole({ role }: { role: Role }) {
  const t = useT();
  return (
    <span
      className={cn(
        "biseau-sm px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ring-1 ring-inset",
        COULEUR_ROLE[role],
      )}
    >
      {t(`roles.${role}`)}
    </span>
  );
}
