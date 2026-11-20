import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { illustrations } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The poster of the editorial pages (news, patch notes, esports): an
 * official artwork across the top of the page, night closing in from the
 * foot and, from `lg`, from the left, where the title sits. The same shape as
 * the home page and the hero page, for pages that are not about one hero:
 * the art is chosen by the page (the hero an article talks about first, the
 * new hero of a patch, the most drafted hero of a tournament).
 *
 * The art is the page's largest image: loaded first, in a frame whose size
 * does not depend on it, so nothing moves when it arrives. Its one motion is
 * the poster's arrival (`affiche-art`), which stops under reduced motion.
 */
export function EditorialPoster({
  art,
  artPosition = "50% 22%",
  crumbs,
  children,
  aside,
  className,
}: {
  /** Artwork path; without one the poster is a plain night band. */
  art: string | null;
  /** `object-position` of the art: where the character is in it. */
  artPosition?: string;
  crumbs: Crumb[];
  children: React.ReactNode;
  /** Right column from `lg` (a big figure, a crest), under the title below. */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative isolate overflow-hidden", className)}>
      {art && (
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[24rem] sm:h-[30rem] lg:inset-y-0 lg:left-[26%] lg:h-auto">
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 74vw, 100vw"
            className="affiche-art object-cover"
            style={{ objectPosition: artPosition }}
          />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/60 to-transparent" />
          <div className="absolute inset-y-0 left-0 hidden w-2/3 bg-linear-to-r from-night-950 via-night-950/55 to-transparent lg:block" />
        </div>
      )}
      <div className="page-wrap pt-3 sm:pt-5">
        <Breadcrumb crumbs={crumbs} className="[&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs" />
      </div>
      <div
        className={cn(
          "page-wrap grid gap-x-12 gap-y-6 pb-8 sm:pb-12 lg:items-end",
          aside && "lg:grid-cols-[minmax(0,1fr)_auto]",
          art ? "pt-40 sm:pt-56 lg:min-h-[30rem] lg:pt-24" : "pt-6 sm:pt-10",
        )}
      >
        <div className="min-w-0">{children}</div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
      <div aria-hidden className="eclat-rule" />
    </section>
  );
}

/** First artwork of a hero, the one the site shows on its poster; `null` without one. */
export function heroArt(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const list = illustrations[slug];
  return list ? (Object.values(list)[0] ?? null) : null;
}

/** First hero of a list that has an artwork, with it. */
export function firstWithArt(slugs: Iterable<string>): { slug: string; art: string } | null {
  for (const slug of slugs) {
    const art = heroArt(slug);
    if (art) return { slug, art };
  }
  return null;
}

/**
 * The short entrance of a page's main block: it rises a few pixels as the
 * page opens (`rise-in`, globals.css). Nothing under reduced motion.
 */
export const ENTRANCE = "motion-safe:animate-[rise-in_0.45s_0.08s_ease-out_both]";
