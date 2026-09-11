import Link from "@/components/lien";
import { cheminRole } from "@/lib/filtres-tier-list";
import type { Role } from "@/lib/types";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { cn } from "@/lib/utils";

/**
 * Entree dans le catalogue par role.
 *
 * Un visiteur arrive rarement en cherchant « la liste des heros » : il joue un
 * role. Ces six portes couvrent la quasi-totalite des intentions d'arrivee.
 */
const COULEURS: Record<Role, string> = {
  Tank: "from-azur-500/20 border-azur-500/40 text-azur-400",
  Fighter: "from-sang-500/20 border-sang-500/40 text-sang-500",
  Assassin: "from-purple-500/20 border-purple-500/40 text-purple-400",
  Mage: "from-cyan-500/20 border-cyan-500/40 text-cyan-400",
  Marksman: "from-or-500/20 border-or-500/40 text-or-400",
  Support: "from-emerald-500/20 border-emerald-500/40 text-emerald-400",
};

export function AccesRoles({ compte, langue }: { compte: Record<Role, number>; langue: Langue }) {
  const t = creerT(langue);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(Object.keys(COULEURS) as Role[]).map((role) => (
        <li key={role}>
          <Link
            href={cheminRole(role)}
            className={cn(
              "biseau flex h-full flex-col justify-between border bg-linear-to-b to-transparent p-4 transition-transform hover:-translate-y-0.5",
              COULEURS[role],
            )}
          >
            <span className="font-titre text-lg font-bold">{t(`roles.${role}`)}</span>
            <span className="mt-3 text-xs text-craie-500">{t("acces.compte", { n: compte[role] })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
