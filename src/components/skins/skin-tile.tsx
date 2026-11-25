import Image from "next/image";
import { LightImage } from "@/components/light-image";
import Link from "@/components/link";
import { cn } from "@/lib/utils";

/**
 * The skin pieces of the gallery and the calendar: the rarity gem, the
 * rarity blade, and the portrait tile that carries both. Rarity colours are
 * information, the only colours outside the palette here.
 */

/** A bevelled shield in the rarity's colour, empty: the game's gem. */
export function RarityGem({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("crest crest-sm h-[1.15rem] w-4 pb-0 shadow-[0_2px_6px_rgb(0_0_0/calc(0.5*var(--shadow-strength)))]", className)}
      style={{ "--crest": color } as React.CSSProperties}
    />
  );
}

/** The rarity's blade along the foot of a frame. */
export function RarityBlade({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-x-0 bottom-0 h-[3px]", className)}
      style={{ background: `linear-gradient(90deg, ${color}, ${color} 60%, transparent)` }}
    />
  );
}

/**
 * A skin's shop portrait in its frame: the name on the art, the rarity gem
 * in the corner and its blade along the foot. It rises 2 px and the portrait
 * zooms 4 % inside the frame on hover. `alt` names the skin for screen
 * readers; the visible name then stays out of their way.
 */
export function SkinTile({
  href,
  src,
  name,
  sub,
  alt,
  color,
  immediate = false,
  prefetch,
  className,
}: {
  href: string;
  src: string | null;
  name: string;
  /** A second short line on the art: the hero, a date. */
  sub?: React.ReactNode;
  alt: string;
  color: string;
  immediate?: boolean;
  prefetch?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn("group relative block transition-[translate] duration-200 hover:-translate-y-0.5", className)}
    >
      <span className="scheme-dark bevel-sm relative block aspect-[240/390] overflow-hidden bg-night-800">
        {src ? (
          <LightImage
            src={src}
            alt={alt}
            width={120}
            height={195}
            immediate={immediate}
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <i aria-hidden className="block size-full bg-night-800" />
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
        <RarityGem color={color} className="absolute left-1.5 top-1.5" />
        <span aria-hidden={src ? true : undefined} className="absolute inset-x-0 bottom-0 px-1.5 pb-2 sm:px-2">
          <span className="display-caps line-clamp-2 block text-[0.85rem] font-extrabold leading-[0.95] text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-[0.95rem]">
            {name}
          </span>
          {sub && <span className="mt-0.5 block truncate text-[0.68rem] text-chalk-400">{sub}</span>}
        </span>
        <RarityBlade color={color} />
      </span>
    </Link>
  );
}

/**
 * A wide artwork tile for the gallery's feature and the calendar's series:
 * bevelled, the art zooming inside its frame on hover, the name in the
 * display face on it. `plain` renders a plain `<a>`, for a link to the same
 * page with a query the page reads on load.
 */
export function SkinArtTile({
  href,
  art,
  name,
  kicker,
  figure,
  color,
  aspect = "aspect-[16/9]",
  position = "50% 25%",
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
  plain = false,
  nameClassName,
  className,
  children,
}: {
  href: string;
  art: string | null;
  name: React.ReactNode;
  kicker?: React.ReactNode;
  figure?: React.ReactNode;
  color?: string;
  aspect?: string;
  position?: string;
  sizes?: string;
  priority?: boolean;
  plain?: boolean;
  nameClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const classes = cn("eclat-under group relative block transition-[translate] duration-200 hover:-translate-y-0.5", className);
  const body = (
    <span className={cn("scheme-dark bevel relative block size-full overflow-hidden bg-night-800", aspect)}>
      {art && (
        <Image
          src={art}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          style={{ objectPosition: position }}
        />
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
      {figure && <span className="absolute right-3 top-2.5">{figure}</span>}
      <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        {kicker && <span className="flex items-center gap-2 text-xs font-semibold text-gold-400 sm:text-sm">{kicker}</span>}
        <span
          className={cn(
            "display-caps mt-1 block text-[clamp(1.5rem,1.1rem+1.2vw,2.25rem)] text-chalk-100 transition-colors group-hover:text-gold-300",
            nameClassName,
          )}
        >
          {name}
        </span>
        {children}
      </span>
      {color && <RarityBlade color={color} className="h-1" />}
    </span>
  );
  return plain ? (
    <a href={href} className={classes}>
      {body}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {body}
    </Link>
  );
}
