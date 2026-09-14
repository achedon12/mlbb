"use client";

import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import type { Lane, Tier, Role } from "@/lib/types";
import { FavouriteIndicator } from "./favourite-indicator";
import { HeroPortrait } from "./hero-portrait";
import { RoleBadge } from "./role-badge";
import { cn } from "@/lib/utils";

/**
 * Vignette d'un heros.
 *
 * Elle ne recoit que ce qu'elle affiche : le heros complet porte des
 * competences, des builds et des statistiques dont la carte n'a aucun usage,
 * et qui alourdiraient inutilement la page cote client.
 */
export interface HeroPreview {
  slug: string;
  name: string;
  roles: Role[];
  lanes: Lane[];
  /** Icone du heros, a defaut son portrait. */
  portrait: string | null;
  skins: number;
  analysis: boolean;
  /** Taux de victoire remonte par le jeu, ou null si non mesure. */
  win: number | null;
  /** Palier de la tier list, ou null si non classe. */
  tier: Tier | null;
}

/** Teinte du badge de palier, du plus fort au plus faible. */
const COLOR_TIER: Record<Tier, string> = {
  "S+": "border-blood-500/40 text-blood-500",
  S: "border-gold-500/40 text-gold-400",
  A: "border-emerald-500/40 text-emerald-400",
  B: "border-azure-500/40 text-azure-400",
  C: "border-night-600 text-chalk-500",
};

export function HeroCard({ hero: heroes }: { hero: HeroPreview }) {
  const t = useT();
  return (
    <Link
      href={`/heroes/${heroes.slug}`}
      className="bevel offscreen group flex items-start gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60 hover:bg-night-850"
    >
      <HeroPortrait source={heroes.portrait} name={heroes.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 font-heading text-base font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
            <span className="truncate">{heroes.name}</span>
            <FavouriteIndicator slug={heroes.slug} />
          </h3>
          {heroes.tier && (
            <span
              className={cn(
                "bevel-sm shrink-0 border px-1.5 py-0.5 text-[0.7rem] font-bold",
                COLOR_TIER[heroes.tier],
              )}
              title={t("heroCard.tierTitle", { p: heroes.tier })}
            >
              {heroes.tier}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {heroes.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 truncate text-xs text-chalk-500">
          {heroes.win != null && (
            <span className="font-semibold text-chalk-300">{heroes.win.toFixed(1)}%</span>
          )}
          <span>{heroes.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}</span>
          {heroes.skins > 0 && <span>· {t("heroCard.skins", { n: heroes.skins })}</span>}
          {heroes.analysis && (
            <span className="font-semibold uppercase tracking-wide text-gold-500">· {t("heroCard.analysis")}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
