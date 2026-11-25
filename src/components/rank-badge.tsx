"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import type { ReadableRank } from "@/lib/ranks";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { inkStyle } from "@/lib/theme";

/**
 * Rank badge: official emblem, name, division and star count.
 *
 * The same rank shows in two sizes — at the top of the profile and in the
 * stat cards — hence a single component, with the emblem carrying most of the
 * visual reading.
 */
export function RankBadge({
  rank,
  size = "md",
}: {
  rank: ReadableRank;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const t = useT();
  const dim = size === "xl" ? 112 : size === "lg" ? 56 : size === "sm" ? 32 : 44;
  const unit =
    rank.unitStars === "point"
      ? t(rank.stars > 1 ? "rankUnit.points" : "rankUnit.point", { n: rank.stars })
      : t(rank.stars > 1 ? "rankUnit.stars" : "rankUnit.star", { n: rank.stars });

  return (
    <div className={cn("flex items-center", size === "xl" ? "gap-4" : "gap-3")}>
      <Image
        src={rank.image}
        alt={t(`rankNames.${rank.key}`)}
        width={dim}
        height={dim}
        className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/calc(0.5*var(--shadow-strength)))]"
      />
      <div className="min-w-0">
        <p
          className={cn(
            "ink",
            size === "xl" ? "display-caps text-[2.4rem] leading-[0.9]" : "font-heading font-bold leading-tight",
            size === "lg" ? "text-xl" : size === "xl" ? "" : "text-base",
          )}
          style={inkStyle(rank.color)}
        >
          {t(`rankNames.${rank.key}`)}
          {rank.division && ` ${rank.division}`}
        </p>
        <p className={cn("flex items-center gap-1 text-chalk-400", size === "xl" ? "mt-2 text-sm" : "mt-0.5 text-xs")}>
          <Star size={11} className="fill-current text-gold-400" aria-hidden />
          {unit}
        </p>
      </div>
    </div>
  );
}
