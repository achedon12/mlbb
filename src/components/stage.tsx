import Image from "next/image";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { Foldable } from "@/components/foldable";
import { Dex, type DexPose } from "@/components/mascot";
import { PageLead } from "@/components/page-lead";
import { heroesBySlug, illustrations } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * An official artwork of a hero, by its slug: the skin named, or the first
 * one shown (the hero's own art). Null when the hero has none, so a page
 * never points at a missing file.
 */
export function heroArt(slug: string, skin?: string): string | null {
  const bySkin = illustrations[slug];
  if (!bySkin) return null;
  return (skin && bySkin[skin]) || Object.values(bySkin)[0] || null;
}

/** The tall portrait of a hero (240 × 390), the icon as a fallback. */
export function heroPortrait(slug: string): string | null {
  const hero = heroesBySlug.get(slug);
  return hero ? (hero.images.portrait ?? hero.images.icon) : null;
}

/**
 * Opening of the pages where people meet (community, account, bot, about,
 * contribute…): `PageHeader`'s slots set on a stage. An official artwork
 * fills the right of the screen, night closing in from the left and the
 * foot, and Dex, the site's host, stands at the edge of the art with the
 * pose of the moment. On a phone the art is a band at the top with Dex on
 * it, the title under them.
 *
 * The art is decorative (`alt=""`), loaded first in a frame whose size is
 * set before it arrives; it slides in once (`affiche-art`), the title comes
 * in on the slant (`affiche-name`), both off under reduced motion.
 */
export function StageHeader({
  title,
  lead,
  crumbs,
  art,
  artPosition = "60% 25%",
  dex,
  dexHeight = 230,
  kicker,
  meta,
  actions,
  details,
  children,
  compact = false,
}: {
  title: string;
  lead: string;
  crumbs?: Crumb[];
  /** Artwork path (`heroArt`); none draws the stage on night alone. */
  art?: string | null;
  /** `object-position` of the art: keeps the hero's face in the frame. */
  artPosition?: string;
  dex?: DexPose;
  dexHeight?: number;
  /** One short line above the title (the category, the step). */
  kicker?: React.ReactNode;
  meta?: React.ReactNode[];
  actions?: React.ReactNode;
  details?: { label: string; content: React.ReactNode };
  children?: React.ReactNode;
  /** A lower stage, for the pages under a section (a thread, a search). */
  compact?: boolean;
}) {
  const facts = meta?.filter(Boolean) ?? [];
  return (
    <div className="relative isolate overflow-hidden">
      {art && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 -z-10 h-56 sm:h-72 lg:inset-y-0 lg:left-auto lg:h-auto lg:w-[64%]",
            compact && "h-44 sm:h-56",
          )}
        >
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 64vw, 100vw"
            className="affiche-art object-cover"
            style={{ objectPosition: artPosition }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/55 to-night-950/10" />
          <div className="absolute inset-y-0 left-0 hidden w-3/4 bg-linear-to-r from-night-950 via-night-950/75 to-transparent lg:block" />
        </div>
      )}
      <div
        className={cn(
          "page-wrap relative pb-7 pt-3 sm:pb-10 sm:pt-5",
          art && (compact ? "pt-3 sm:pt-5 lg:min-h-[19rem]" : "lg:min-h-[25rem]"),
        )}
      >
        <Breadcrumb crumbs={crumbs ?? [{ name: title }]} className="mb-2.5 [&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs sm:mb-3" />
        {/* On a phone the art band takes the top: the title starts under it, Dex stands on it. */}
        <div className={cn(art && (compact ? "pt-24 sm:pt-32 lg:pt-6" : "pt-32 sm:pt-44 lg:pt-10"), !art && dex && "pr-28 sm:pr-0")}>
          {dex && (
            <div
              aria-hidden
              className={cn(
                "stage-dex dex-host absolute right-4 z-10 sm:right-8 lg:right-12",
                art ? "top-12 sm:top-16 lg:top-auto lg:bottom-0" : "top-10 lg:top-auto lg:bottom-0",
              )}
            >
              <span className="hidden lg:block">
                <Dex pose={dex} height={dexHeight} />
              </span>
              <span className="block lg:hidden">
                <Dex pose={dex} height={compact ? 104 : 132} still />
              </span>
            </div>
          )}
          {kicker && <p className="mb-2 font-heading text-base font-bold uppercase text-gold-400">{kicker}</p>}
          <h1
            className={cn(
              "affiche-name display-caps max-w-4xl break-words text-chalk-100",
              compact ? "text-[clamp(2.2rem,1.5rem+2.6vw,3.75rem)]" : "text-[clamp(2.6rem,1.7rem+3.4vw,4.75rem)]",
              dex && "lg:max-w-[calc(100%-20rem)]",
            )}
          >
            {title}
          </h1>
          <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
          <div className="max-w-2xl">
            <PageLead lead={lead} />
          </div>
          {facts.length > 0 && (
            <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
              {facts.map((fact, i) => (
                <li key={i} className="bevel-sm bg-night-800/90 px-2 py-1 text-chalk-300">
                  {fact}
                </li>
              ))}
            </ul>
          )}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
          {details && (
            <Foldable label={details.label} className="mt-4 max-w-2xl">
              {details.content}
            </Foldable>
          )}
          {children && <div className="max-w-2xl">{children}</div>}
        </div>
      </div>
      <div aria-hidden className="eclat-rule" />
    </div>
  );
}

/**
 * Dex hosting an empty state, a sign-in block or a tip: the mascot beside a
 * bevelled bubble. Server-safe (no hook), for the places that speak to the
 * visitor rather than show data.
 */
export function DexNote({
  pose = "reflexion",
  height = 110,
  title,
  children,
  className,
  role,
}: {
  pose?: DexPose;
  height?: number;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className={cn("dex-host flex items-end gap-3 sm:gap-5", className)}>
      <Dex pose={pose} height={height} still className="shrink-0" />
      <div className="dex-bubble min-w-0 flex-1 sm:flex-none">
        {title && <p className="font-heading text-lg font-bold uppercase leading-tight text-chalk-100">{title}</p>}
        <div className={cn("text-sm leading-relaxed text-chalk-300", title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}
