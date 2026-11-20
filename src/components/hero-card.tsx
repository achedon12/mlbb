"use client";

import Image from "next/image";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import type { Lane, Tier, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FavouriteIndicator } from "./favourite-indicator";
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
  /** Tall in-game portrait (240 × 390), or the icon as a fallback. */
  portrait: string | null;
  skins: number;
  analysis: boolean;
  /** Win rate reported by the game, or null if not measured. */
  win: number | null;
  /** Tier list tier, or null if unranked. */
  tier: Tier | null;
}

/**
 * A hero of the catalogue as a tile of the roster: the bevelled portrait
 * filling the card, the tier crest in its corner, the win rate in gold and
 * the name in the display face over the foot of the art — never a caption
 * under it. The tile rises and the art zooms a little in its frame on
 * hover (`.hero-tile`), the éclat passing under it.
 */
export function HeroCard({ hero, priority = false, className }: { hero: HeroPreview; priority?: boolean; className?: string }) {
  const t = useT();
  return (
    <Link href={`/heroes/${hero.slug}`} className={cn("hero-tile eclat-under offscreen group [contain-intrinsic-size:auto_16rem]", className)}>
      <span className="hero-tile-art">
        {hero.portrait ? (
          <Image
            src={hero.portrait}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1280px) 11rem, (min-width: 640px) 22vw, 46vw"
            className="object-cover object-top"
          />
        ) : (
          <span aria-hidden className="display-caps grid size-full place-items-center text-4xl text-chalk-600">
            {hero.name.slice(0, 2)}
          </span>
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-night-950 via-night-950/80 to-transparent" />
        {hero.tier && (
          <span title={t("heroCard.tierTitle", { p: hero.tier })} className="absolute right-1.5 top-1.5">
            <BadgeTier tier={hero.tier} size="sm" />
          </span>
        )}
        {hero.analysis && (
          <span className="bevel-sm absolute left-1.5 top-1.5 bg-gold-400 px-1.5 py-0.5 font-heading text-[0.7rem] font-bold uppercase leading-tight text-night-950">
            {t("heroCard.analysis")}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 p-2.5">
          {hero.win != null && (
            <span className="score block text-[1.7rem] sm:text-[1.9rem]">
              {hero.win.toFixed(1)}
              <span className="text-[0.5em]">%</span>
            </span>
          )}
          <h3 className="display-caps mt-1 flex min-w-0 items-center gap-1 text-[1.3rem] text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-[1.45rem]">
            <span className="truncate pr-[0.12em]">{hero.name}</span>
            <FavouriteIndicator slug={hero.slug} />
          </h3>
          <span className="mt-1 block truncate text-xs text-chalk-400">
            {hero.roles.map((r) => t(`roles.${r}`)).join(" / ")}
            <span aria-hidden> · </span>
            <span className="sr-only">, </span>
            {hero.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}
          </span>
          {hero.skins > 0 && <span className="sr-only">, {t("heroCard.skins", { n: hero.skins })}</span>}
        </span>
      </span>
    </Link>
  );
}
