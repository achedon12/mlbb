import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { firstWithArt } from "@/components/editorial-poster";
import type { T } from "@/i18n/translations";
import { ADJUSTMENT_DIRECTIONS, groupAdjustments, type AdjustmentDirection } from "@/lib/meta-report";
import type { DetailedPatch } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Visual pieces of the patch pages (hub, version, Advance server): the art a
 * patch is shown with, and its balance as big counters in the colours of the
 * direction — ally blue for buffs, enemy red for nerfs, chalk for the plain
 * adjustments.
 */

export const DIRECTION_TONE: Record<AdjustmentDirection, { text: string; bar: string; Icon: typeof TrendingUp }> = {
  buff: { text: "text-azure-400", bar: "bg-azure-400", Icon: TrendingUp },
  nerf: { text: "text-blood-400", bar: "bg-blood-400", Icon: TrendingDown },
  adjust: { text: "text-chalk-300", bar: "bg-chalk-400", Icon: Minus },
};

/**
 * The artwork a patch is shown with: its new hero when it has one, then its
 * first buffed hero, then any hero it changes.
 */
export function patchArt(
  patch: Pick<DetailedPatch, "newHeroes" | "adjustments">,
  /** Heroes already shown nearby (a list of patches): skipped when another one fits. */
  avoid?: Set<string>,
): { slug: string; art: string } | null {
  const groups = groupAdjustments(patch.adjustments);
  const order = [
    ...patch.newHeroes.map((h) => h.slug),
    ...groups.buff.map((a) => a.slug),
    ...groups.nerf.map((a) => a.slug),
    ...groups.adjust.map((a) => a.slug),
  ];
  const found = (avoid && firstWithArt(order.filter((slug) => !avoid.has(slug)))) || firstWithArt(order);
  if (found) avoid?.add(found.slug);
  return found;
}

/**
 * Heroes per direction as figures: "6 buffed · 3 nerfed · 4 adjusted", the
 * figure in the display face, coloured by direction.
 */
export function BalanceFigures({
  balance,
  t,
  size = "md",
  className,
}: {
  balance: Record<AdjustmentDirection, number>;
  t: T;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-end gap-x-6 gap-y-2", size === "lg" && "gap-x-8 sm:gap-x-10", className)}>
      {ADJUSTMENT_DIRECTIONS.map((d) => {
        const { text } = DIRECTION_TONE[d];
        return (
          <li key={d} className="flex items-baseline gap-2">
            <span
              className={cn(
                "score",
                text,
                size === "sm" && "text-2xl",
                size === "md" && "text-4xl",
                size === "lg" && "text-[3.25rem] sm:text-6xl",
              )}
            >
              {balance[d] ?? 0}
            </span>
            <span className={cn("font-heading font-bold uppercase text-chalk-300", size === "sm" ? "text-xs" : "text-sm")}>
              {t(`patchHeroes.plural.${d}`)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Balance of a patch by distinct heroes (a hero named twice counts once). */
export function balanceOf(patch: Pick<DetailedPatch, "adjustments">): Record<AdjustmentDirection, number> {
  const g = groupAdjustments(patch.adjustments);
  return { buff: g.buff.length, nerf: g.nerf.length, adjust: g.adjust.length };
}

/** The artwork of a test version: its first buffed hero, then any hero it changes. */
export function advanceArt(heroes: { slug: string; type: string | null }[]): string | null {
  const order = [...heroes.filter((h) => h.type === "buff"), ...heroes.filter((h) => h.type === "nerf"), ...heroes];
  return firstWithArt(order.map((h) => h.slug))?.art ?? null;
}
