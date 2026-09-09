import Link from "next/link";
import type { Lane, Palier, Role, VisuelsHeros } from "@/lib/types";
import { IndicateurFavori } from "./indicateur-favori";
import { PortraitHeros } from "./portrait-heros";
import { BadgeRole } from "./ui";
import { cn } from "@/lib/utils";

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
  /** Taux de victoire remonte par le jeu, ou null si non mesure. */
  victoire: number | null;
  /** Palier de la tier list, ou null si non classe. */
  palier: Palier | null;
}

/** Teinte du badge de palier, du plus fort au plus faible. */
const COULEUR_PALIER: Record<Palier, string> = {
  "S+": "border-sang-500/40 text-sang-500",
  S: "border-or-500/40 text-or-400",
  A: "border-emerald-500/40 text-emerald-400",
  B: "border-azur-500/40 text-azur-400",
  C: "border-nuit-600 text-craie-500",
};

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
          {heros.palier && (
            <span
              className={cn(
                "biseau-sm shrink-0 border px-1.5 py-0.5 text-[0.7rem] font-bold",
                COULEUR_PALIER[heros.palier],
              )}
              title={`Palier ${heros.palier} de la tier list`}
            >
              {heros.palier}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {heros.roles.map((r) => (
            <BadgeRole key={r} role={r} />
          ))}
        </div>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 truncate text-xs text-craie-500">
          {heros.victoire != null && (
            <span className="font-semibold text-craie-300">{heros.victoire.toFixed(1)}%</span>
          )}
          <span>{heros.lanes.join(" · ") || "—"}</span>
          {heros.skins > 0 && <span>· {heros.skins} skins</span>}
          {heros.analyse && (
            <span className="font-semibold uppercase tracking-wide text-or-500">· Analyse</span>
          )}
        </p>
      </div>
    </Link>
  );
}
