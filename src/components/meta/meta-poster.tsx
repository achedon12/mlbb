import Image from "next/image";
import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "@/components/breadcrumb";
import { PageLead } from "@/components/page-lead";
import { illustrations } from "@/lib/data";
import { cn } from "@/lib/utils";

/** First official artwork of a hero, the one the hero page opens on. */
export function artOf(slug: string): string | null {
  const art = illustrations[slug];
  return art ? (Object.values(art)[0] ?? null) : null;
}

/**
 * The opening poster of the Meta pages (tier list, statistics, meta report,
 * community builds): the official artwork of the hero the page puts first
 * across the right of the screen, night closing in where the text sits, the
 * page's title, lead and facts on the left, and `feature` — the hero's name
 * in giant capitals with its one big figure — over the art.
 *
 * On a phone the art is a block at the top, the feature pulled up over its
 * foot and the title under it. The art's frame has its size before the
 * image arrives, and the image is loaded first: nothing moves when it does.
 * The one strong moment of the page is here (`affiche-art`, `affiche-name`
 * in globals.css), and it stops under `prefers-reduced-motion`.
 */
export function MetaPoster({
  title,
  lead,
  crumbs,
  facts,
  actions,
  art,
  portrait,
  feature,
  children,
  compact = false,
}: {
  title: string;
  lead: string;
  crumbs?: Crumb[];
  /** Short facts as chips under the lead; empty entries are dropped. */
  facts?: ReactNode[];
  /** Links of the page, under the facts. */
  actions?: ReactNode;
  /** The artwork; the tall portrait stands in when the hero has none. */
  art: string | null;
  portrait?: string | null;
  /** Over the art: the hero's name, its crest and figure. */
  feature?: ReactNode;
  /** Under the lead, in the title column. */
  children?: ReactNode;
  /** A lower poster, for pages whose content must come up sooner. */
  compact?: boolean;
}) {
  const list = facts?.filter(Boolean) ?? [];
  // No picture at all: no empty frame on a phone, the title comes up under the breadcrumb.
  const bare = !art && !portrait;
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className={cn(
          "relative h-[19rem] sm:h-[26rem] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[70%]",
          compact && "h-[15rem] sm:h-[20rem]",
          bare && "max-lg:hidden",
        )}
      >
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 70vw, 100vw"
            className="affiche-art object-cover object-[60%_24%]"
          />
        ) : (
          portrait && (
            <span className="absolute inset-y-0 right-[8%] aspect-[240/390]">
              <Image src={portrait} alt="" fill priority sizes="(min-width: 640px) 22rem, 60vw" className="affiche-art object-cover" />
            </span>
          )
        )}
        <div className="absolute inset-x-0 bottom-0 h-4/5 bg-linear-to-t from-night-950 via-night-950/70 to-transparent" />
        <div className="absolute inset-y-0 left-0 hidden w-3/5 bg-linear-to-r from-night-950 via-night-950/70 to-transparent lg:block" />
        <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-night-950/70 to-transparent" />
      </div>

      <div className="page-wrap absolute inset-x-0 top-0 pt-3 sm:pt-5">
        <Breadcrumb crumbs={crumbs ?? [{ name: title }]} className="[&_ol]:text-xs" />
      </div>

      <div
        className={cn(
          "page-wrap relative grid grid-cols-1 gap-x-12 gap-y-6 pb-8 sm:pb-10 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-end lg:pb-12 lg:pt-20",
          bare && "max-lg:pt-14",
          compact ? "lg:min-h-[26rem]" : "lg:min-h-[clamp(32rem,calc(78svh-4rem),44rem)]",
        )}
      >
        <div className="order-2 min-w-0 lg:order-none">
          <h1 className="display-caps text-[clamp(2.6rem,1.7rem+3.4vw,4.75rem)] text-chalk-100">{title}</h1>
          <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
          <PageLead lead={lead} />
          {list.length > 0 && (
            <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
              {list.map((fact, i) => (
                <li key={i} className="bevel-sm bg-night-800 px-2 py-1 text-chalk-300">
                  {fact}
                </li>
              ))}
            </ul>
          )}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">{actions}</div>}
          {children}
        </div>
        {feature && (
          <div
            className={cn(
              "relative order-1 min-w-0 lg:order-none lg:mt-0",
              !bare && (compact ? "-mt-28 sm:-mt-36" : "-mt-36 sm:-mt-48"),
            )}
          >
            {feature}
          </div>
        )}
      </div>
      <div aria-hidden className="eclat-rule" />
    </section>
  );
}
