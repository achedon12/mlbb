"use client";

import { LightImage } from "@/components/light-image";
import { useT } from "@/i18n/provider";
import { imageRole } from "@/lib/emblems";
import type { Role } from "@/lib/types";

/**
 * Role of a hero: its emblem, then its name.
 *
 * The emblem is the sign the game itself uses, recognised on a card before
 * the word beside it is read. Purely decorative here — the badge names the
 * role right after it — fixed size, so a card keeps its height while the
 * image loads. One neutral tint for every role: the emblem tells them
 * apart, and six colours side by side made a rainbow of every hero list.
 */
export function RoleBadge({ role }: { role: Role }) {
  const t = useT();
  const emblem = imageRole(role);
  return (
    <span
      className="bevel-sm inline-flex items-center gap-1 bg-night-800 px-2 py-0.5 font-heading text-[0.8rem] font-bold uppercase leading-tight text-chalk-200"
    >
      {emblem && <LightImage src={emblem} alt="" width={14} height={14} className="shrink-0 object-contain" />}
      {t(`roles.${role}`)}
    </span>
  );
}
