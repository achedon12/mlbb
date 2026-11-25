import Image from "next/image";
import Link from "@/components/link";
import { cn } from "@/lib/utils";

/**
 * A hero in a row of portraits: the bevelled portrait, its key figure in
 * gold over it and the name in the display face — on the image, never as a
 * caption under it. Lists of heroes on the strong pages are rows of these,
 * not grey tables.
 *
 * `figure` is what is shown, `label` what a screen reader hears instead
 * ("58.4% win rate"), since a bare number means nothing out of sight.
 * `tone` colours the figure when it carries a direction (a buff's rise in
 * ally blue, a nerf's drop in enemy red); gold otherwise.
 */
export function HeroTile({
  href,
  name,
  portrait,
  figure,
  label,
  rank,
  tone = "gold",
  sizes = "(min-width: 1280px) 10rem, (min-width: 640px) 18vw, 30vw",
  className,
}: {
  href: string;
  name: string;
  /** The tall portrait (240 × 390); the icon as a fallback. */
  portrait: string | null;
  figure?: string;
  label?: string;
  /** Position in a ranked list, drawn outlined in the corner. */
  rank?: number;
  tone?: "gold" | "ally" | "enemy" | "muted";
  sizes?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("hero-tile group", className)}>
      <span className="hero-tile-art">
        {portrait ? (
          <Image src={portrait} alt="" fill sizes={sizes} className="object-cover object-top" />
        ) : (
          <span aria-hidden className="display-caps grid size-full place-items-center text-3xl text-chalk-600">
            {name.slice(0, 2)}
          </span>
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-night-950 via-night-950/75 to-transparent" />
        {rank !== undefined && (
          <span aria-hidden className="score score-outline absolute left-2 top-1.5 text-3xl">
            {rank}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5">
          {figure && (
            <span
              aria-hidden={label ? true : undefined}
              className={cn(
                "score block text-[1.65rem] sm:text-[2rem]",
                tone === "ally" && "text-azure-400",
                tone === "enemy" && "text-blood-400",
                tone === "muted" && "text-chalk-400",
              )}
            >
              {figure}
            </span>
          )}
          <span className="display-caps mt-1 block truncate pr-[0.15em] text-[0.95rem] font-extrabold text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-lg">
            {name}
          </span>
        </span>
      </span>
      {label && <span className="sr-only">{label}</span>}
    </Link>
  );
}
