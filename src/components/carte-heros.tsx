import Link from "next/link";
import type { Lane, Role, VisuelsHeros } from "@/lib/types";
import { IndicateurFavori } from "./indicateur-favori";
import { PortraitHeros } from "./portrait-heros";
import { BadgeRole } from "./ui";

/**
 * Vignette d'un heros.
 *
 * Elle ne recoit que ce qu'elle affiche : le heros complet porte des
 * competences, des builds et des statistiques dont la carte n'a aucun usage,
 * et qui alourdiraient inutilement la page cote client.
 */
export interface ApercuHeros {
  slug: string;
  nom: string;
  roles: Role[];
  lanes: Lane[];
  visuels: VisuelsHeros;
  skins: number;
  analyse: boolean;
}

export function CarteHeros({ heros }: { heros: ApercuHeros }) {
  return (
    <Link
      href={`/heros/${heros.slug}`}
      className="biseau group flex items-start gap-3 border border-nuit-700/70 bg-nuit-900/60 p-3 transition-colors hover:border-or-500/60 hover:bg-nuit-850"
    >
      <PortraitHeros source={heros.visuels.icone ?? heros.visuels.portrait} nom={heros.nom} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 font-titre text-base font-bold text-craie-100 transition-colors group-hover:text-or-400">
            <span className="truncate">{heros.nom}</span>
            <IndicateurFavori slug={heros.slug} />
          </h3>
          {heros.analyse && (
            <span
              className="mt-0.5 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-or-500"
              title="Analyse redigee disponible"
            >
              Analyse
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {heros.roles.map((r) => (
            <BadgeRole key={r} role={r} />
          ))}
        </div>

        <p className="mt-1.5 truncate text-xs text-craie-500">
          {heros.lanes.join(" · ") || "—"}
          {heros.skins > 0 && ` · ${heros.skins} skins`}
        </p>
      </div>
    </Link>
  );
}
