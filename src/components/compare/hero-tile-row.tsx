import Image from "next/image";
import Link from "@/components/link";
import { HeroTile } from "@/components/hero-tile";
import { heroArt } from "@/components/hero-art";
import { heroesBySlug } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * A ranked row of bevelled portraits, the key figure in gold over each — in
 * ally blue or enemy red when it carries a direction. The figures of the
 * table under it, made visible at a glance; the table keeps the detail.
 */
export function HeroTileRow({
  items,
  className,
}: {
  items: { slug: string; figure: string; label: string; tone?: "gold" | "ally" | "enemy" }[];
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-4 gap-2 sm:gap-3", className)}>
      {items.map((c, i) => {
        const h = heroesBySlug.get(c.slug);
        if (!h) return null;
        return (
          <li key={c.slug} className={cn(i >= 8 && "hidden")}>
            <HeroTile
              href={`/heroes/${c.slug}`}
              name={h.name}
              portrait={h.images.portrait ?? h.images.icon}
              figure={c.figure}
              label={c.label}
              tone={c.tone}
              rank={i + 1}
              sizes="(min-width: 1280px) 9rem, (min-width: 640px) 14vw, 24vw"
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A head-to-head as an artwork tile: the two artworks split by the blade,
 * the second mirrored, the names over them. The link's name is the duel's
 * title, read once.
 */
export function DuelTile({ href, a, b, label }: { href: string; a: string; b: string; label: string }) {
  const sides = [a, b].map((slug) => ({ slug, name: heroesBySlug.get(slug)?.name ?? slug, art: heroArt(slug) }));
  return (
    <Link
      href={href}
      aria-label={label}
      className="eclat-under group relative block transition-[translate] duration-200 hover:-translate-y-0.5"
    >
      <span aria-hidden className="bevel relative flex aspect-[4/3] overflow-hidden sm:aspect-[16/8] bg-night-950">
        {sides.map((s, i) => (
          <span
            key={s.slug}
            className={cn("relative h-full min-w-0 flex-1 overflow-hidden", i === 1 && "-ml-5")}
            style={{
              clipPath: i === 0 ? "polygon(0 0, 100% 0, calc(100% - 1.5rem) 100%, 0 100%)" : "polygon(1.5rem 0, 100% 0, 100% 100%, 0 100%)",
            }}
          >
            {s.art && (
              <span className={cn("absolute inset-0", i === 1 && "-scale-x-100")}>
                <Image
                  src={s.art}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 50vw"
                  className="object-cover object-[50%_22%] transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
            <span
              className={cn(
                "display-caps absolute bottom-2.5 block max-w-[85%] truncate text-base text-chalk-100 transition-colors group-hover:text-gold-300 sm:text-2xl",
                i === 0 ? "left-2 sm:left-3" : "right-2 text-right sm:right-3",
              )}
            >
              {s.name}
            </span>
          </span>
        ))}
        <span className="display-caps absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 text-xl text-gold-400 sm:text-2xl drop-shadow-[0_3px_8px_rgb(0_0_0/0.9)]">
          VS
        </span>
      </span>
    </Link>
  );
}
