import Image from "next/image";
import Link from "@/components/link";
import { IMAGE_ROLE } from "@/lib/emblems";
import { pathRole } from "@/lib/tier-list-filters";
import type { Role } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { cn } from "@/lib/utils";

/**
 * Entry into the catalogue by role.
 *
 * A visitor rarely arrives looking for "the hero list": they play a role.
 * These six doors cover almost every arrival intent. Each carries the role's
 * own emblem, the sign a player recognises before reading the word, and lies
 * down into a row on a phone so the six fit in a third of a screen.
 */
const COLORS: Record<Role, string> = {
  Tank: "from-azure-500/20 border-azure-500/40 text-azure-400",
  Fighter: "from-blood-500/20 border-blood-500/40 text-blood-500",
  Assassin: "from-purple-500/20 border-purple-500/40 text-purple-400",
  Mage: "from-cyan-500/20 border-cyan-500/40 text-cyan-400",
  Marksman: "from-gold-500/20 border-gold-500/40 text-gold-400",
  Support: "from-emerald-500/20 border-emerald-500/40 text-emerald-400",
};

export function RoleAccess({ count, locale }: { count: Record<Role, number>; locale: Locale }) {
  const t = createT(locale);
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
      {(Object.keys(COLORS) as Role[]).map((role) => (
        <li key={role}>
          <Link
            href={pathRole(role)}
            className={cn(
              "bevel flex h-full items-center gap-2.5 border bg-linear-to-b to-transparent p-2.5 transition-transform hover:-translate-y-0.5 sm:flex-col sm:items-start sm:justify-between sm:gap-0 sm:p-4",
              COLORS[role],
            )}
          >
            {/* The name follows: the emblem is decorative. */}
            <Image src={IMAGE_ROLE[role]} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="block truncate font-heading font-bold sm:text-lg">{t(`roles.${role}`)}</span>
              <span className="block text-xs text-chalk-500 sm:mt-2">{t("access.account", { n: count[role] })}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
