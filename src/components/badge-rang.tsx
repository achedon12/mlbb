"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import type { RangLisible } from "@/lib/rangs";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/**
 * Badge de rang : embleme officiel, nom, division et compte d'etoiles.
 *
 * Le meme rang se montre en deux tailles — en tete de profil et dans les
 * cartes de chiffres — d'ou un composant unique, l'embleme portant l'essentiel
 * de la lecture visuelle.
 */
export function BadgeRang({
  rang,
  taille = "md",
}: {
  rang: RangLisible;
  taille?: "sm" | "md" | "lg";
}) {
  const t = useT();
  const dim = taille === "lg" ? 56 : taille === "sm" ? 32 : 44;
  const unite =
    rang.uniteEtoiles === "point"
      ? t(rang.etoiles > 1 ? "rangUnite.points" : "rangUnite.point", { n: rang.etoiles })
      : t(rang.etoiles > 1 ? "rangUnite.etoiles" : "rangUnite.etoile", { n: rang.etoiles });

  return (
    <div className="flex items-center gap-3">
      <Image
        src={rang.image}
        alt={t(`rangsNom.${rang.cle}`)}
        width={dim}
        height={dim}
        className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      />
      <div className="min-w-0">
        <p
          className={cn(
            "font-heading font-bold leading-tight",
            taille === "lg" ? "text-xl" : "text-base",
          )}
          style={{ color: rang.couleur }}
        >
          {t(`rangsNom.${rang.cle}`)}
          {rang.division && ` ${rang.division}`}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-chalk-400">
          <Star size={11} className="fill-current text-gold-400" aria-hidden />
          {unite}
        </p>
      </div>
    </div>
  );
}
