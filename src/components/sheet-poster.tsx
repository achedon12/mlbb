import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { GlyphPanel } from "@/components/glyph-panel";
import { HeroTile } from "@/components/hero-tile";
import { PageLead } from "@/components/page-lead";
import { Score } from "@/components/ui";
import motion from "@/components/catalogue-motion.module.css";
import { heroesBySlug, illustrations } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Poster of an item, emblem or spell page: the icon shown large on its night
 * panel, the name in the display face beside it, and behind both the
 * artwork of the hero who plays the choice the most — the page is about
 * what that hero carries. One figure (price, cooldown, number of heroes) in
 * gold under the name: the one big number of the screen.
 */

/** The hero's first official artwork, or nothing when the hero has none. */
export function artOf(slug: string | undefined | null): string | null {
  if (!slug) return null;
  const byName = illustrations[slug];
  return byName ? (Object.values(byName)[0] ?? null) : null;
}

export function SheetPoster({
  title,
  lead,
  crumbs,
  image,
  art,
  figure,
  children,
}: {
  title: string;
  lead: string;
  crumbs: Crumb[];
  /** Icon of the item, emblem or spell. */
  image: string | null;
  /** Artwork shown behind the poster (the hero who takes the choice most). */
  art: string | null;
  /** The one figure of the poster, with what it measures. */
  figure?: { value: string; unit?: string; label: string } | null;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="sheet-title" className={cn("relative isolate overflow-hidden", art && "scheme-dark bg-night-950")}>
      {art && (
        <div aria-hidden className="absolute inset-0 -z-10 lg:left-[28%]">
          <Image src={art} alt="" fill priority fetchPriority="high" sizes="(min-width: 1024px) 72vw, 100vw" className="affiche-art object-cover object-[60%_22%] opacity-70" />
          <div className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/70 to-night-950/20" />
          <div className="absolute inset-y-0 left-0 w-full bg-linear-to-r from-night-950 via-night-950/80 to-transparent lg:w-3/5" />
        </div>
      )}
      <div className="page-wrap pb-8 pt-3 sm:pb-12 sm:pt-5">
        <Breadcrumb crumbs={crumbs} className="[&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs" />
        <div className={cn("mt-6 grid items-end gap-x-10 gap-y-5 sm:mt-10 sm:grid-cols-[auto_minmax(0,1fr)] lg:mt-14", motion.rise)}>
          <GlyphPanel image={image} size={112} priority flash className="size-36 sm:size-52" />
          <div className="min-w-0">
            <h1 id="sheet-title" className="affiche-name display-caps break-words text-[clamp(2.75rem,1.4rem+4.6vw,6.25rem)] text-chalk-100">
              {title}
            </h1>
            <div aria-hidden className="eclat mt-4 h-[3px] w-28" />
            {figure && (
              <p className="mt-5 flex items-end gap-3">
                <Score value={figure.value} unit={figure.unit} className="text-[clamp(3rem,2.2rem+3vw,5rem)]" />
                <span className="pb-1 font-heading text-base font-bold uppercase text-chalk-300">{figure.label}</span>
              </p>
            )}
            <div className="max-w-2xl">
              <PageLead lead={lead} />
            </div>
            {children}
          </div>
        </div>
      </div>
      <div aria-hidden className="eclat-rule" />
    </section>
  );
}

/**
 * The heroes who take a choice, as a row of artwork tiles with their figure
 * in gold (win rate, share of games). The table under it keeps the numbers;
 * the row is what the eye meets first.
 */
export function HeroArtRow({
  heroes,
  className,
}: {
  heroes: { slug: string; href?: string; figure?: string; label?: string }[];
  className?: string;
}) {
  const shown = heroes.flatMap((h) => {
    const hero = heroesBySlug.get(h.slug);
    return hero ? [{ ...h, hero }] : [];
  });
  if (shown.length === 0) return null;
  return (
    <ol className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6", className)}>
      {shown.map(({ hero, href, figure, label }) => (
        <li key={hero.slug}>
          <HeroTile
            href={href ?? `/heroes/${hero.slug}`}
            name={hero.name}
            portrait={hero.images.portrait ?? hero.images.icon}
            figure={figure}
            label={label}
            sizes="(min-width: 1024px) 14vw, (min-width: 640px) 22vw, 30vw"
          />
        </li>
      ))}
    </ol>
  );
}
