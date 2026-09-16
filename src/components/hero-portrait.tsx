import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Portrait or icon of a hero.
 *
 * Images are served by the site itself, never from a third-party domain:
 * `npm run sync -- --images` stores them under `public/visuels/`. When an
 * image is missing, the initials are shown rather than a hole in the grid.
 *
 * Every hero thumbnail on the site goes through here, from the smallest
 * (dropdown list) to the hero page.
 */
const DIMENSIONS = {
  micro: { sizeClass: "size-6", px: 24, text: "text-[0.55rem]" },
  mini: { sizeClass: "size-7", px: 28, text: "text-[0.6rem]" },
  small: { sizeClass: "size-8", px: 32, text: "text-xs" },
  icon: { sizeClass: "size-10", px: 40, text: "text-sm" },
  medium: { sizeClass: "size-11", px: 44, text: "text-base" },
  thumb: { sizeClass: "size-14", px: 56, text: "text-lg" },
  sheet: { sizeClass: "h-40 w-28", px: 112, height: 160, text: "text-2xl" },
  skin: { sizeClass: "aspect-[240/390] w-full", px: null, text: "text-2xl" },
} as const;

export function HeroPortrait({
  source,
  name,
  size = "thumb",
  className,
  priority = false,
  decorative = false,
  alt,
}: {
  source: string | null;
  name: string;
  size?: keyof typeof DIMENSIONS;
  className?: string;
  priority?: boolean;
  /** Thumbnail placed next to the name: the image tells screen readers nothing more. */
  decorative?: boolean;
  /** Alternative text; defaults to the hero's name, readable in every language. */
  alt?: string;
}) {
  const dimensions = DIMENSIONS[size];
  const frame = cn("bevel-sm relative shrink-0 overflow-hidden bg-night-800", dimensions.sizeClass, className);

  if (!source) {
    return (
      <span className={cn(frame, "grid place-items-center")} aria-hidden>
        <span className={cn("font-heading font-bold text-chalk-500", dimensions.text)}>{initials(name)}</span>
      </span>
    );
  }

  return (
    <span className={frame}>
      {/*
        Fixed size: with width and height known, the browser only has two
        versions to pick from (1x, 2x) instead of fifteen — tens of KB less
        HTML on lists. Only the fluid skin keeps `sizes`.

        Those two versions go through the optimiser. A stored icon is 128x128
        and weighs 8 to 10 KB; the same icon re-encoded to AVIF at its real
        display size is 0.8 to 2 KB, so a list of a hundred heroes drops from
        roughly 1 MB to 100 KB. The two extra srcset entries cost about 200
        bytes of HTML per thumbnail, which the first image already pays back.
      */}
      {dimensions.px === null ? (
        <Image
          src={source}
          alt={decorative ? "" : (alt ?? name)}
          fill
          sizes="(min-width: 640px) 200px, 45vw"
          priority={priority}
          className="object-cover"
        />
      ) : (
        <Image
          src={source}
          alt={decorative ? "" : (alt ?? name)}
          width={dimensions.px}
          height={"height" in dimensions ? dimensions.height : dimensions.px}
          priority={priority}
          className="size-full object-cover"
        />
      )}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/[\s'-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}
