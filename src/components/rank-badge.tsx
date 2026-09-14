"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import type { ReadableRank } from "@/lib/ranks";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Badge de rang : embleme officiel, nom, division et compte d'etoiles.
 *
 * Le meme rang se montre en deux tailles — en tete de profil et dans les
 * cartes de chiffres — d'ou un composant unique, l'embleme portant l'essentiel
 * de la lecture visuelle.
 */
export function RankBadge({
  rank,
  size = "md",
}: {
  rank: ReadableRank;
  size?: "sm" | "md" | "lg";
}) {
  const t = useT();
  const dim = size === "lg" ? 56 : size === "sm" ? 32 : 44;
  const unit =
    rank.unitStars === "point"
      ? t(rank.stars > 1 ? "rankUnit.points" : "rankUnit.point", { n: rank.stars })
      : t(rank.stars > 1 ? "rankUnit.stars" : "rankUnit.star", { n: rank.stars });

  return (
    <div className="flex items-center gap-3">
      <Image
        src={rank.image}
        alt={t(`rankNames.${rank.key}`)}
        width={dim}
        height={dim}
        className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      />
      <div className="min-w-0">
        <p
          className={cn(
            "font-heading font-bold leading-tight",
            size === "lg" ? "text-xl" : "text-base",
          )}
          style={{ color: rank.color }}
        >
          {t(`rankNames.${rank.key}`)}
          {rank.division && ` ${rank.division}`}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-chalk-400">
          <Star size={11} className="fill-current text-gold-400" aria-hidden />
          {unit}
        </p>
      </div>
    </div>
  );
}
