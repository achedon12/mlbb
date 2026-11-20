import Image from "next/image";
import Link from "@/components/link";
import { BadgeTier, Score } from "@/components/ui";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One side of a versus: what the poster shows of a hero. */
export interface VersusSide {
  slug: string;
  name: string;
  /** Landscape artwork (1280 × 720), or null: the tall portrait stands in. */
  art: string | null;
  portrait: string | null;
  tier: Tier | null;
  /** Win rate, already formatted for the locale, without its unit. */
  win: string | null;
  /** What a screen reader hears for the figure ("Win rate: 52.3%"). */
  winLabel?: string;
  /** Roles and lanes, one short line under the name. */
  sub?: string;
  /** Mark of the hero's series in the radar and the curves. */
  legend?: React.ReactNode;
}

/**
 * The versus spread: the heroes' official artworks facing each other,
 * slanted panels split by a blade, the last one mirrored so the figures
 * turn towards each other. Each name is the panel's one link, in giant
 * slanted capitals, with the tier crest and the win rate as the gold
 * figure. Two or three heroes; the frame has its height before the images
 * arrive, so nothing moves when they do.
 */
export function VersusPoster({
  sides,
  priority = false,
  className,
  children,
}: {
  sides: VersusSide[];
  priority?: boolean;
  className?: string;
  /** Laid over the poster (the breadcrumb of a pair page). */
  children?: React.ReactNode;
}) {
  const n = sides.length;
  const three = n > 2;
  return (
    <div
      className={cn(
        "relative isolate h-[19rem] overflow-hidden bg-night-950 [--s:1.75rem] sm:h-[25rem] sm:[--s:3.5rem] lg:h-[31rem]",
        className,
      )}
    >
      <div className="flex h-full">
        {sides.map((side, i) => {
          const first = i === 0;
          const last = i === n - 1;
          const clip = first
            ? "polygon(0 0, 100% 0, calc(100% - var(--s)) 100%, 0 100%)"
            : last
              ? "polygon(var(--s) 0, 100% 0, 100% 100%, 0 100%)"
              : "polygon(var(--s) 0, 100% 0, calc(100% - var(--s)) 100%, 0 100%)";
          const align = first ? "items-start text-left" : last ? "items-end text-right" : "items-center text-center";
          return (
            <div
              key={side.slug}
              className={cn("group relative h-full min-w-0 flex-1", !first && "-ml-[calc(var(--s)-5px)]")}
              style={{ clipPath: clip }}
            >
              <div aria-hidden className="absolute inset-0 bg-night-900 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                {side.art ? (
                  // The last panel is mirrored, so the figures face each other.
                  <div className={cn("absolute inset-0", last && !first && "-scale-x-100")}>
                    <Image
                      src={side.art}
                      alt=""
                      fill
                      priority={priority}
                      sizes={three ? "34vw" : "52vw"}
                      className="affiche-art object-cover object-[50%_24%]"
                    />
                  </div>
                ) : (
                  side.portrait && (
                    <Image src={side.portrait} alt="" fill priority={priority} sizes="30vw" className="object-contain object-bottom" />
                  )
                )}
                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-night-950/70 to-transparent" />
              </div>

              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 flex flex-col gap-2 pb-4 sm:gap-3 sm:pb-7",
                  first ? "pl-3 pr-[calc(var(--s)+0.25rem)] sm:pl-8" : last ? "pl-[calc(var(--s)+0.25rem)] pr-3 sm:pr-8" : "px-[calc(var(--s)+0.25rem)]",
                  align,
                )}
              >
                {(side.tier || side.win) && (
                  <p className={cn("flex items-end gap-2 sm:gap-3", last && !first && "flex-row-reverse")}>
                    {side.tier &&
                      (three ? (
                        <BadgeTier tier={side.tier} size="sm" className="sm:hidden" />
                      ) : (
                        <BadgeTier tier={side.tier} size="md" className="sm:hidden" />
                      ))}
                    {side.tier && (
                      <span aria-hidden className="hidden sm:contents">
                        <BadgeTier tier={side.tier} size={three ? "md" : "lg"} />
                      </span>
                    )}
                    {side.win && (
                      <>
                        <span aria-hidden>
                          <Score
                            value={side.win}
                            unit="%"
                            className={three ? "text-[clamp(1.9rem,1.2rem+2.6vw,4rem)]" : "text-[clamp(2.4rem,1.3rem+4vw,5.5rem)]"}
                          />
                        </span>
                        {side.winLabel && <span className="sr-only">{side.winLabel}</span>}
                      </>
                    )}
                  </p>
                )}
                <Link
                  href={`/heroes/${side.slug}`}
                  className={cn(
                    "affiche-name display-caps block max-w-full break-words text-chalk-100 transition-colors after:absolute after:inset-0 hover:text-gold-300 group-hover:text-gold-300",
                    three ? "text-[clamp(1.7rem,0.9rem+3vw,4.5rem)]" : "text-[clamp(2.2rem,1rem+4.6vw,6.5rem)]",
                  )}
                >
                  {side.name}
                </Link>
                {(side.sub || side.legend) && (
                  <span className={cn("flex items-center gap-2 text-xs text-chalk-300 sm:text-sm", last && !first && "flex-row-reverse")}>
                    {side.legend}
                    {side.sub && <span className="line-clamp-1 max-sm:hidden">{side.sub}</span>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* The blade and the VS mark on each seam. */}
      {sides.slice(1).map((side, k) => (
        <div
          key={side.slug}
          aria-hidden
          className="pointer-events-none absolute top-[38%] -translate-x-1/2 -translate-y-1/2 sm:top-[42%]"
          style={{ left: `${((k + 1) / n) * 100}%` }}
        >
          <div className="eclat absolute left-1/2 top-1/2 h-[3px] w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[64deg] sm:w-48" />
          <span
            className={cn(
              "display-caps relative block text-gold-400 drop-shadow-[0_4px_14px_rgb(0_0_0/0.85)]",
              three ? "text-[clamp(1.75rem,1rem+2.5vw,3.5rem)]" : "text-[clamp(2.5rem,1.4rem+3.6vw,5.5rem)]",
            )}
          >
            VS
          </span>
        </div>
      ))}
      {children}
    </div>
  );
}
