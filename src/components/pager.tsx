import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "@/components/link";
import type { T } from "@/i18n/t";
import { pageSteps, type Paging } from "@/lib/pager";
import { cn } from "@/lib/utils";

/**
 * Pagination of a long list.
 *
 * Real addresses, never buttons: every page is an `<a href="/heroes/page/2">`
 * the server prerenders, so the second page of the catalogue opens with
 * JavaScript switched off and a crawler reaches it like any other link. A
 * path and not a query, so these pages keep being served from the full-route
 * cache. `rel="prev"` and `rel="next"` name the reading order, the first page
 * keeps the bare address the canonical points at, and every parameter of the
 * current address — a filter, a sort, a search term — travels along in the
 * links (`pageHref`).
 *
 * Neither server nor client component: it holds no state and no hook, so
 * pages render it directly and filtered lists, which live in the browser,
 * render it too — passing `onNavigate` there, which turns a click into a
 * local change of page without reloading, the address staying what the link
 * says.
 */
export function Pager({
  paging,
  href,
  onNavigate,
  t,
  labelledBy,
  className,
}: {
  paging: Paging;
  /** Address of a page number, filters included (`pageHref`). */
  href: (page: number) => string;
  /**
   * Called instead of following the link, for a list already in the browser.
   * Left out on a server-rendered list: the link is then followed as it is.
   */
  onNavigate?: (page: number) => void;
  t: T;
  /** Identifier of the list's heading, when it has one. */
  labelledBy?: string;
  className?: string;
}) {
  const { page, pages, first, last, total } = paging;
  if (pages <= 1) return null;

  const steps = pageSteps(page, pages);
  const classes = (current: boolean) =>
    cn(
      // 44 px tall at every width — the touch target — but narrower on a
      // phone, where nine steps and two arrows have to share 390 px.
      "bevel-sm grid min-h-11 min-w-10 place-items-center px-2 text-sm font-semibold transition-colors sm:min-w-11 sm:px-3",
      current
        ? "bg-gold-500 text-night-950"
        : "border border-night-700 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400",
    );

  /** A page link; `onNavigate` keeps the click local without losing the address. */
  const step = (n: number, rel?: "prev" | "next", body?: React.ReactNode, label?: string) => (
    <Link
      href={href(n)}
      rel={rel}
      scroll={!onNavigate}
      prefetch={false}
      aria-label={label}
      aria-current={!rel && n === page ? "page" : undefined}
      onClick={
        onNavigate &&
        ((event: React.MouseEvent) => {
          // A modified click (new tab, download) keeps the browser's job.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onNavigate(n);
        })
      }
      className={classes(!rel && n === page)}
    >
      {body ?? n}
    </Link>
  );

  return (
    <nav
      aria-label={labelledBy ? undefined : t("common.pager.label")}
      aria-labelledby={labelledBy}
      className={cn("mt-6 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2", className)}
    >
      {page > 1 ? (
        step(page - 1, "prev", <ChevronLeft size={18} aria-hidden />, t("common.pager.previous"))
      ) : (
        <span aria-hidden className={cn(classes(false), "opacity-30")}>
          <ChevronLeft size={18} />
        </span>
      )}
      {steps.map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-chalk-500">
            …
          </span>
        ) : (
          <span key={n}>{step(n, undefined, undefined, t("common.pager.page", { n }))}</span>
        ),
      )}
      {page < pages ? (
        step(page + 1, "next", <ChevronRight size={18} aria-hidden />, t("common.pager.next"))
      ) : (
        <span aria-hidden className={cn(classes(false), "opacity-30")}>
          <ChevronRight size={18} />
        </span>
      )}
      {/* Position in the whole list, announced when the page changes. */}
      <p aria-live="polite" className="basis-full text-center text-xs text-chalk-500">
        {t("common.pager.status", { page, pages, first, last, total })}
      </p>
    </nav>
  );
}
