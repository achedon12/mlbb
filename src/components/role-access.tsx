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
 * These six doors cover almost every arrival intent: a row of the game's
 * own role emblems, the sign a player recognises before reading the word,
 * each with its name and how many heroes play it, set on the page with no
 * frame. Three by two on a phone.
 */
const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];

export function RoleAccess({ count, locale }: { count: Record<Role, number>; locale: Locale }) {
  const t = createT(locale);
  return (
    <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-6">
      {ROLES.map((role) => (
        <li key={role}>
          <Link href={pathRole(role)} className="group flex flex-col items-center text-center">
            {/* The name follows: the emblem is decorative. */}
            <Image
              src={IMAGE_ROLE[role]}
              alt=""
              width={64}
              height={64}
              className="size-14 object-contain transition-transform duration-200 group-hover:-translate-y-0.5 sm:size-16"
            />
            <span className="mt-3 block font-heading text-lg font-bold uppercase leading-none text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-xl">
              {t(`roles.${role}`)}
            </span>
            <span className="mt-1 block text-sm text-chalk-400">{t("access.account", { n: count[role] })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
