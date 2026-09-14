"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/link";
import { ChevronRight, ChevronsUpDown, House } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { keySearch, cn } from "@/lib/utils";

export interface Crumb {
  name: string;
  /** Link of the crumb; absent for the current page. */
  href?: string;
  /**
   * Pages of the same level, offered from the current crumb: move from one
   * hero, patch or rank to another without going back up to the list.
   */
  siblings?: { name: string; href: string }[];
}

/** Beyond this, the list of sibling pages opens with a filter field. */
const THRESHOLD_FILTER = 10;
const WIDTH_PANEL = 288;

/**
 * Breadcrumb.
 *
 * Renders the position in the site and emits the `BreadcrumbList` markup at
 * the same time: search engines then show the path under the result rather
 * than the raw URL, and the reader goes up a level without the browser's
 * address bar.
 *
 * Home always starts the trail: no page has to declare it. The trail sets its
 * own background, readable on an illustrated header as on a plain one. When
 * the page has siblings, the last crumb offers them in a menu.
 */
export function Breadcrumb({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  const t = useT();
  const locale = useLocale();
  const trail: Crumb[] = [{ name: t("common.home"), href: "/" }, ...crumbs];
  // Search engines want full addresses, locale included: a link without a
  // prefix is only resolved by the proxy's redirect.
  const address = (href: string) => `${site.url}/${locale}${href === "/" ? "" : href}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.name,
      ...(m.href ? { item: address(m.href) } : {}),
    })),
  };

  const current = trail.at(-1)!;
  const siblings = current.siblings && current.siblings.length > 1 ? current.siblings : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
      />
      <nav aria-label={t("common.breadcrumb")} className={className}>
        <ol className="bevel-sm inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 border border-night-700/60 bg-night-950/70 px-3 py-1.5 text-sm backdrop-blur-sm">
          {trail.map((m, i) => {
            const last = i === trail.length - 1;
            const home = i === 0;
            return (
              <li key={`${m.name}-${i}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} aria-hidden className="shrink-0 text-chalk-600" />}
                {m.href && !last ? (
                  <Link
                    href={m.href}
                    className="flex items-center gap-1.5 text-chalk-400 transition-colors hover:text-gold-400"
                  >
                    {home && <House size={14} aria-hidden className="shrink-0" />}
                    {/* On mobile, the house icon is enough to say "home". */}
                    <span className={cn(home && "sr-only sm:not-sr-only")}>{m.name}</span>
                  </Link>
                ) : last && siblings ? (
                  <SisterPages name={m.name} siblings={siblings} />
                ) : (
                  <span aria-current="page" className="truncate font-medium text-chalk-100">
                    {m.name}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * Last crumb, opening the list of sibling pages. The panel is rendered at the
 * document root — the trail's bevelled shape would clip it — and sits under
 * the crumb without overflowing the screen. It closes on an outside click, on
 * Escape, on page scroll and when a page is chosen.
 */
function SisterPages({ name, siblings }: { name: string; siblings: { name: string; href: string }[] }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const closeOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !panel.current?.contains(target)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // The current page in the middle of the list, without scrolling the page.
    const current = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list.current && current) {
      list.current.scrollTop = current.offsetTop - list.current.clientHeight / 2;
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    // The panel starts at the crumb, and moves back if it would leave the screen.
    const button = root.current?.getBoundingClientRect();
    if (button) {
      setPosition({
        top: button.bottom + 10,
        left: Math.max(16, Math.min(button.left, window.innerWidth - 16 - WIDTH_PANEL)),
      });
    }
    setFilter("");
    setOpen((o) => !o);
  };

  const term = keySearch(filter.trim());
  const visible = term ? siblings.filter((f) => keySearch(f.name).includes(term)) : siblings;

  return (
    <span ref={root} className="flex min-w-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        title={t("common.siblings", { name: name })}
        className="flex min-w-0 items-center gap-1 font-medium text-chalk-100 transition-colors hover:text-gold-400"
      >
        <span aria-current="page" className="truncate">
          {name}
        </span>
        <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-chalk-500" />
        <span className="sr-only">{t("common.siblings", { name: name })}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panel}
            id={`${id}-panel`}
            style={{ top: position.top, left: position.left, width: WIDTH_PANEL }}
            className="fixed z-50 max-w-[calc(100vw-2rem)] border border-night-700 bg-night-900 shadow-xl shadow-black/40"
          >
            {siblings.length > THRESHOLD_FILTER && (
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("common.filter")}
                aria-label={t("common.filter")}
                className="w-full border-b border-night-800 bg-transparent px-3 py-2 text-sm text-chalk-100 outline-none placeholder:text-chalk-500"
              />
            )}
            <ul ref={list} className="relative max-h-72 overflow-y-auto p-1">
              {visible.map((f) => (
                <li key={f.href}>
                  <Link
                    href={f.href}
                    onClick={() => setOpen(false)}
                    aria-current={f.name === name ? "page" : undefined}
                    className={cn(
                      "block truncate rounded-sm px-3 py-1.5 text-sm transition-colors",
                      f.name === name ? "bg-night-800 text-gold-400" : "text-chalk-300 hover:bg-night-850 hover:text-gold-400",
                    )}
                  >
                    {f.name}
                  </Link>
                </li>
              ))}
              {visible.length === 0 && <li className="px-3 py-2 text-sm text-chalk-500">{t("search.none")}</li>}
            </ul>
          </div>,
          document.body,
        )}
    </span>
  );
}
