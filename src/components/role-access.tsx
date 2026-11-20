import Image from "next/image";
import Link from "@/components/link";
import { IMAGE_ROLE } from "@/lib/emblems";
import { pathRole } from "@/lib/tier-list-filters";
import type { Role } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * Entry into the catalogue by role.
 *
 * A visitor rarely arrives looking for "the hero list": they play a role.
 * These six doors cover almost every arrival intent. Each carries the role's
 * own emblem, the sign a player recognises before reading the word, and lies
 * down into a row on a phone so the six fit in a third of a screen.
 */
const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];

export function RoleAccess({ count, locale }: { count: Record<Role, number>; locale: Locale }) {
  const t = createT(locale);
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6 xl:grid-cols-2">
      {ROLES.map((role) => (
        <li key={role}>
          <Link
            href={pathRole(role)}
            className="card-link group flex h-full items-center gap-3 p-3 sm:p-4"
          >
            {/* The name follows: the emblem is decorative. */}
            <Image src={IMAGE_ROLE[role]} alt="" width={32} height={32} className="size-9 shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="display-caps block truncate text-xl text-chalk-100 sm:text-2xl transition-colors group-hover:text-gold-400">{t(`roles.${role}`)}</span>
              <span className="mt-1 block text-sm text-chalk-400">{t("access.account", { n: count[role] })}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
