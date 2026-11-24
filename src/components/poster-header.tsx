import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { Foldable } from "@/components/foldable";
import Link from "@/components/link";
import { PageLead } from "@/components/page-lead";
import { cn } from "@/lib/utils";

/**
 * The poster pieces of the catalogue pages (heroes, skins, lore, events,
 * compare): a page header built on the official artwork, and a tile that
 * carries one. Both follow `docs/design-system.md` — the bevel cut, night
 * closing in where the text sits, the name in the display face over the
 * art, never a caption under it.
 */

/**
 * The page's main block comes in once, short, on arrival (under 500 ms,
 * transforms and opacity only). Nothing moves on scroll; nothing at all
 * under `prefers-reduced-motion`.
 */
export const ENTRANCE = "motion-safe:animate-[rise-in_0.45s_ease-out_both]";

/**
 * Page header on a poster: the artwork across the right of the screen (a
 * block at the top on a phone), night closing in from the foot and the left,
 * the title in the slanted display face over it. Same slots as `PageHeader`
 * — breadcrumb, lead, facts, actions, folded details — plus an `aside` for
 * the one dominant thing beside the title (a big figure, Dex).
 *
 * `art` is one artwork, or several: then they stand side by side as slanted
 * panels, like a roster screen. The frame has its size before the images
 * arrive, so nothing moves when they do.
 */
export function PosterHeader({
  title,
  lead,
  crumbs,
  art,
  position = "50% 25%",
  kicker,
  meta,
  actions,
  details,
  aside,
  children,
  tall = false,
}: {
  title: string;
  lead: string;
  crumbs?: Crumb[];
  art?: string | (string | null)[] | null;
  /** `object-position` of a single artwork: where the figure is. */
  position?: string;
  /** One short line above the title, in gold (a date, a role). */
  kicker?: React.ReactNode;
  meta?: React.ReactNode[];
  actions?: React.ReactNode;
  details?: { label: string; content: React.ReactNode };
  /** The dominant thing beside the title: a big figure, the mascot. */
  aside?: React.ReactNode;
  children?: React.ReactNode;
  /** A taller poster, for the pages whose art is the subject. */
  tall?: boolean;
}) {
  const panels = Array.isArray(art) ? art.filter((x): x is string => !!x) : null;
  const single = typeof art === "string" ? art : null;
  const facts = meta?.filter(Boolean) ?? [];

  return (
    <section className="relative isolate overflow-hidden">
      {(single || (panels && panels.length > 0)) && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 -z-10 overflow-hidden h-[15rem] sm:h-[21rem] lg:inset-y-0 lg:left-auto lg:h-auto lg:w-[72%]",
            tall && "h-[18rem] sm:h-[24rem]",
          )}
        >
          {single ? (
            <Image
              src={single}
              alt=""
              fill
              priority
              fetchPriority="high"
              sizes="(min-width: 1024px) 72vw, 100vw"
              className="affiche-art object-cover"
              style={{ objectPosition: position }}
            />
          ) : (
            <div className="affiche-art absolute inset-y-0 -right-8 left-0 flex gap-1.5">
              {panels!.map((src, i) => (
                <div
                  key={src}
                  className={cn(
                    "relative h-full flex-1 -skew-x-[9deg] overflow-hidden bg-night-900",
                    // A phone shows three panels, a tablet four.
                    i >= 3 && "hidden sm:block",
                    i >= 4 && "sm:hidden lg:block",
                  )}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    priority={i < 3}
                    fetchPriority={i < 3 ? "high" : undefined}
                    sizes="(min-width: 1024px) 18vw, 34vw"
                    className="skew-x-[9deg] scale-[1.22] object-cover object-[50%_22%]"
                  />
                </div>
              ))}
            </div>
          )}
          {/* Night from the foot, where the title sits, and from `lg` from the left. */}
          <div className="absolute inset-x-0 bottom-0 h-4/5 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
          <div className="absolute inset-y-0 left-0 hidden w-3/5 bg-linear-to-r from-night-950 via-night-950/70 to-transparent lg:block" />
          <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-night-950/70 to-transparent" />
        </div>
      )}

      <div
        className={cn(
          "page-wrap relative pb-7 pt-3 sm:pb-10 sm:pt-5",
          art ? "lg:min-h-[26rem]" : "",
          tall && art && "lg:min-h-[32rem]",
        )}
      >
        <Breadcrumb
          crumbs={crumbs ?? [{ name: title }]}
          className="mb-2.5 [&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs sm:mb-3"
        />
        <div
          className={cn(
            "grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end",
            art && (tall ? "pt-36 sm:pt-56 lg:pt-28" : "pt-28 sm:pt-48 lg:pt-24"),
          )}
        >
          <div className="min-w-0 max-w-3xl">
            {kicker && <p className="font-heading text-base font-bold uppercase text-gold-400 sm:text-lg">{kicker}</p>}
            <h1 className="affiche-name display-caps mt-1 break-words text-[clamp(2.9rem,1.6rem+4.6vw,6.25rem)] text-chalk-100">
              {title}
            </h1>
            <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
            <PageLead lead={lead} />
            {facts.length > 0 && (
              <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                {facts.map((fact, i) => (
                  <li key={i} className="bevel-sm bg-night-800/90 px-2 py-1 text-chalk-300">
                    {fact}
                  </li>
                ))}
              </ul>
            )}
            {actions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
            {details && (
              <Foldable label={details.label} className="mt-4 max-w-2xl">
                {details.content}
              </Foldable>
            )}
            {children}
          </div>
          {aside && <div className="min-w-0">{aside}</div>}
        </div>
      </div>
      <div aria-hidden className="eclat-rule" />
    </section>
  );
}

/**
 * A link carrying an artwork: bevelled frame, the art zooming slightly in
 * it on hover, the tile rising 2 px and the éclat passing under it. The
 * name sits on the art in the display face; `heading` makes it a heading
 * of the page's outline. `children` go over the art, at its foot, after the
 * name.
 */
export function ArtTile({
  href,
  art,
  name,
  heading,
  kicker,
  figure,
  aspect = "aspect-[16/10]",
  position = "50% 25%",
  sizes = "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw",
  nameClassName,
  className,
  children,
  fallback,
}: {
  href: string;
  art: string | null;
  name: React.ReactNode;
  heading?: "h2" | "h3";
  /** Short line above the name (a region, a role). */
  kicker?: React.ReactNode;
  /** The key figure, in gold, top right. */
  figure?: React.ReactNode;
  aspect?: string;
  position?: string;
  sizes?: string;
  nameClassName?: string;
  className?: string;
  children?: React.ReactNode;
  /** Shown in the frame when there is no artwork (a portrait, an icon). */
  fallback?: React.ReactNode;
}) {
  const Name = heading ?? "span";
  return (
    <Link
      href={href}
      className={cn("eclat-under group relative block transition-[translate] duration-200 hover:-translate-y-0.5", className)}
    >
      <span className={cn("bevel relative block overflow-hidden bg-night-800", aspect)}>
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            style={{ objectPosition: position }}
          />
        ) : (
          fallback
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
        {figure && <span className="absolute right-3 top-2.5">{figure}</span>}
        <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
          {kicker && <span className="block text-xs font-semibold text-gold-400 sm:text-sm">{kicker}</span>}
          <Name
            className={cn(
              "display-caps mt-0.5 block text-[clamp(1.6rem,1.2rem+1.4vw,2.4rem)] text-chalk-100 transition-colors group-hover:text-gold-300",
              nameClassName,
            )}
          >
            {name}
          </Name>
          {children}
        </span>
      </span>
    </Link>
  );
}
