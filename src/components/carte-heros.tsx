"use client";

import Link from "@/components/lien";
import { useT } from "@/i18n/fournisseur";
import type { Lane, Palier, Role } from "@/lib/types";
import { IndicateurFavori } from "./indicateur-favori";
import { PortraitHeros } from "./portrait-heros";
import { BadgeRole } from "./badge-role";
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
  /** Icone du heros, a defaut son portrait. */
  portrait: string | null;
  skins: number;
  analyse: boolean;
  /** Taux de victoire remonte par le jeu, ou null si non mesure. */
  victoire: number | null;
  /** Palier de la tier list, ou null si non classe. */
  palier: Palier | null;
}

/** Teinte du badge de palier, du plus fort au plus faible. */
const COULEUR_PALIER: Record<Palier, string> = {
  "S+": "border-blood-500/40 text-blood-500",
  S: "border-gold-500/40 text-gold-400",
  A: "border-emerald-500/40 text-emerald-400",
  B: "border-azure-500/40 text-azure-400",
  C: "border-night-600 text-chalk-500",
};

export function CarteHeros({ heros }: { heros: ApercuHeros }) {
  const t = useT();
  return (
    <Link
      href={`/heroes/${heros.slug}`}
      className="bevel offscreen group flex items-start gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60 hover:bg-night-850"
    >
      <PortraitHeros source={heros.portrait} nom={heros.nom} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 font-heading text-base font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
            <span className="truncate">{heros.nom}</span>
            <IndicateurFavori slug={heros.slug} />
          </h3>
          {heros.palier && (
            <span
              className={cn(
                "bevel-sm shrink-0 border px-1.5 py-0.5 text-[0.7rem] font-bold",
                COULEUR_PALIER[heros.palier],
              )}
              title={t("heroCard.tierTitle", { p: heros.palier })}
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

        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 truncate text-xs text-chalk-500">
          {heros.victoire != null && (
            <span className="font-semibold text-chalk-300">{heros.victoire.toFixed(1)}%</span>
          )}
          <span>{heros.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}</span>
          {heros.skins > 0 && <span>· {t("heroCard.skins", { n: heros.skins })}</span>}
          {heros.analyse && (
            <span className="font-semibold uppercase tracking-wide text-gold-500">· {t("heroCard.analysis")}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
