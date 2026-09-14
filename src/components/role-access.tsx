import Link from "@/components/link";
import { pathRole } from "@/lib/tier-list-filters";
import type { Role } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { cn } from "@/lib/utils";

/**
 * Entry into the catalogue by role.
 *
 * A visitor rarely arrives looking for "the hero list": they play a role.
 * These six doors cover almost every arrival intent.
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
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(Object.keys(COLORS) as Role[]).map((role) => (
        <li key={role}>
          <Link
            href={pathRole(role)}
            className={cn(
              "bevel flex h-full flex-col justify-between border bg-linear-to-b to-transparent p-4 transition-transform hover:-translate-y-0.5",
              COLORS[role],
            )}
          >
            <span className="font-heading text-lg font-bold">{t(`roles.${role}`)}</span>
            <span className="mt-3 text-xs text-chalk-500">{t("access.account", { n: count[role] })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
