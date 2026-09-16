"use client";

import { LightImage } from "@/components/light-image";
import { useT } from "@/i18n/provider";
import { imageRole } from "@/lib/emblems";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Colours per role, taken from the game's style guide. */
const COLOR_ROLE: Record<Role, string> = {
  Tank: "bg-azure-500/15 text-azure-400 ring-azure-500/30",
  Fighter: "bg-blood-500/15 text-blood-500 ring-blood-500/30",
  Assassin: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  Mage: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/30",
  Marksman: "bg-gold-500/15 text-gold-400 ring-gold-500/30",
  Support: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
};

/**
 * Role of a hero: its emblem, then its name.
 *
 * The emblem is the sign the game itself uses, recognised on a card before
 * the word beside it is read. Purely decorative here — the badge names the
 * role right after it — fixed size, so a card keeps its height while the
 * image loads.
 */
export function RoleBadge({ role }: { role: Role }) {
  const t = useT();
  const emblem = imageRole(role);
  return (
    <span
      className={cn(
        "bevel-sm inline-flex items-center gap-1 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ring-1 ring-inset",
        COLOR_ROLE[role],
      )}
    >
      {emblem && <LightImage src={emblem} alt="" width={14} height={14} className="shrink-0 object-contain" />}
      {t(`roles.${role}`)}
    </span>
  );
}
