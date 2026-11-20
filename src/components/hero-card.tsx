"use client";

import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import type { Lane, Tier, Role } from "@/lib/types";
import { FavouriteIndicator } from "./favourite-indicator";
import { HeroPortrait } from "./hero-portrait";
import { RoleBadge } from "./role-badge";
import { BadgeTier } from "./ui";

/**
 * Hero card.
 *
 * It only receives what it shows: the full hero carries
 * skills, builds and statistics the card has no use for,
 * and which would needlessly weigh down the client-side page.
 */
export interface HeroPreview {
  slug: string;
  name: string;
  roles: Role[];
  lanes: Lane[];
  /** Hero icon, or its portrait as a fallback. */
  portrait: string | null;
  skins: number;
  analysis: boolean;
  /** Win rate reported by the game, or null if not measured. */
  win: number | null;
  /** Tier list tier, or null if unranked. */
  tier: Tier | null;
}

export function HeroCard({ hero: heroes }: { hero: HeroPreview }) {
  const t = useT();
  return (
    <Link
      href={`/heroes/${heroes.slug}`}
      className="card-link offscreen group flex items-start gap-3 p-3"
    >
      <HeroPortrait source={heroes.portrait} name={heroes.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 font-heading text-lg font-bold uppercase leading-tight text-chalk-100 transition-colors group-hover:text-gold-400">
            <span className="truncate">{heroes.name}</span>
            <FavouriteIndicator slug={heroes.slug} />
          </h3>
          {heroes.tier && (
            <span title={t("heroCard.tierTitle", { p: heroes.tier })} className="shrink-0">
              <BadgeTier tier={heroes.tier} size="sm" />
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
            <span className="font-heading text-sm font-bold text-gold-400">{heroes.win.toFixed(1)}%</span>
          )}
          <span>{heroes.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}</span>
          {heroes.skins > 0 && <span>· {t("heroCard.skins", { n: heroes.skins })}</span>}
          {heroes.analysis && (
            <span className="font-semibold text-gold-500">· {t("heroCard.analysis")}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
