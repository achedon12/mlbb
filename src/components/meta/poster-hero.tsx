import type { ReactNode } from "react";
import Link from "@/components/link";
import { BadgeTier, Score } from "@/components/ui";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * What a Meta poster says about its hero: why it is there (`kicker`, the one
 * small label of the screen), its name in giant slanted capitals, its tier
 * crest and the one big figure, a second figure outlined beside it.
 *
 * `figure` and `second` are drawn for the eye; `label` is the sentence a
 * screen reader hears instead, a bare number meaning nothing out of sight.
 */
export function PosterHero({
  href,
  kicker,
  name,
  tier,
  figure,
  unit = "%",
  tone = "gold",
  caption,
  second,
  label,
  children,
}: {
  href: string;
  kicker: string;
  name: string;
  tier?: Tier;
  figure?: string;
  unit?: string;
  tone?: "gold" | "ally" | "enemy";
  /** What the big figure is ("win rate"), under it. */
  caption?: string;
  second?: { value: string; unit?: string; caption: string };
  label?: string;
  /** Under the figures: the podium, a link. */
  children?: ReactNode;
}) {
  return (
    <div className="lg:pl-4">
      <Link href={href} className="group block w-fit max-w-full">
        <span className="block font-heading text-base font-bold uppercase text-gold-400 sm:text-lg">{kicker}</span>
        <span className="affiche-name mt-1 block break-words display-caps text-[clamp(3.6rem,1.2rem+9vw,8.5rem)] text-chalk-100 transition-colors group-hover:text-gold-300">
          {name}
        </span>
      </Link>
      {figure && (
        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3 sm:mt-5 sm:gap-x-6">
          {tier && <BadgeTier tier={tier} size="lg" className="mb-1" />}
          <p className="min-w-0">
            <span aria-hidden={label ? true : undefined}>
              <Score
                value={figure}
                unit={unit}
                className={cn(
                  "text-[clamp(3.75rem,2.2rem+5vw,7rem)]",
                  tone === "ally" && "text-azure-400",
                  tone === "enemy" && "text-blood-400",
                )}
              />
              {caption && <span className="mt-2 block text-sm text-chalk-300">{caption}</span>}
            </span>
            {label && <span className="sr-only">{label}</span>}
          </p>
          {second && (
            <p aria-hidden={label ? true : undefined} className="min-w-0 pb-6">
              <Score outline value={second.value} unit={second.unit ?? "%"} className="text-[clamp(2.25rem,1.5rem+2.4vw,3.5rem)]" />
              <span className="mt-1.5 block text-sm text-chalk-400">{second.caption}</span>
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
