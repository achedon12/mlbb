"use client";

import { Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { classesChip } from "@/components/chip";
import { useT } from "@/i18n/provider";
import { resolveAnchor, type AnchorAliases } from "@/lib/anchors";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Tabs.
 *
 * A hero page stacks analysis, skills, counters, builds and sometimes
 * fourteen skins: in one piece, it becomes unusable. Tabs split it up
 * without hiding anything.
 *
 * Panels are rendered by the server and stay in the document — only their
 * visibility changes. Hidden content therefore stays indexable, and
 * navigating triggers no request. Exception: a `deferred` panel (charts,
 * gallery) is only mounted when first opened: mounting it upfront weighed
 * down hydration of the whole page. Its `preview`, a light server-rendered
 * summary, stands in until then: search engines and script-less readers find
 * the essentials there as text.
 *
 * Images in a hidden panel stay lazy-loaded: the browser only requests them
 * when the panel opens (checked in Chromium).
 *
 * The open tab is read from and written to the URL hash (#skins, #builds…):
 * a link can lead straight to a tab, and a shared URL reopens the same one.
 * `aliases` maps renamed tab ids to the current ones, so that links shared
 * before the rename ("#histoire") still open their tab.
 *
 * `trackAs`, when given, files each tab the visitor opens (a click, the
 * keyboard, or a link to its anchor once on the page — not the tab the page
 * lands on) as a Matomo event of that category, action "Tab opened", name
 * the tab id: which parts of a page are read.
 *
 * `sectionsOnMobile` turns the tabs, under `md`, into stacked sections that
 * fold: on a phone, a row of tabs hides most of the page behind taps few
 * make, while one long column never lets the reader reach its end. Each
 * section has its own header (a button that folds it), the ones in
 * `openOnMobile` start open, and a sticky row of chips follows the scroll,
 * lights the section being read and jumps to any other. Folded content stays
 * in the document, hidden by CSS only, like a hidden tab: nothing is lost for
 * search engines. The same markup is the tab layout from `md` up; only
 * classes change, so the server render needs to know nothing of the screen.
 * With `trackAs`, a section unfolded by the visitor is filed as "Section
 * opened" and a chip tapped as "Section nav", both named after the section id.
 */
export interface Tab {
  id: string;
  label: string;
  /** Counter shown next to the label, when it adds something. */
  counter?: number;
  content: React.ReactNode;
  /** Mounts the content only when first opened. */
  deferred?: boolean;
  /** Server-rendered summary, shown until a deferred panel is mounted. */
  preview?: React.ReactNode;
}

/** Below `md`, where `sectionsOnMobile` stacks the panels. Matches Tailwind's `max-md`. */
const MOBILE_QUERY = "(max-width: 767.98px)";
const isMobile = () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const onMobileChange = (refresh: () => void) => {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", refresh);
  return () => query.removeEventListener("change", refresh);
};
/** Sticky site header (4rem) plus the chip row: a section scrolled to lands under both. */
const STICKY_OFFSET = 132;

export function Tabs({
  tabs,
  aliases = {},
  trackAs,
  sectionsOnMobile = false,
  openOnMobile,
}: {
  tabs: Tab[];
  aliases?: AnchorAliases;
  trackAs?: string;
  /** Under `md`, stacked folding sections with a sticky chip nav instead of tabs. */
  sectionsOnMobile?: boolean;
  /** Sections open on arrival on a phone; the first two by default. */
  openOnMobile?: string[];
}) {
  const t = useT();
  const [active, setActive] = useState(tabs[0]?.id);
  const [openTabs, setOpen] = useState(() => new Set(tabs[0] ? [tabs[0].id] : []));
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const sections = useRef<Record<string, HTMLElement | null>>({});
  const row = useRef<HTMLDivElement>(null);
  // Until when the scroll follows a jump rather than the reader: the section
  // jumped to stays lit even if the page cannot scroll it all the way up.
  const spyPausedUntil = useRef(0);
  // Below `md` with stacked sections, a panel is a region named by its
  // folding header: the tab naming it is hidden there. The server render
  // and the first browser render keep the tab roles.
  const stacked = useSyncExternalStore(onMobileChange, () => sectionsOnMobile && isMobile(), () => false);

  // A tab without content has no reason to appear: a hero with no skin and
  // no analysis must not show empty sections.
  const visible = tabs.filter((o) => o.content);

  // Unfolded sections on a phone. The same set in the server render and the
  // first browser render: the layout is decided by CSS alone.
  const [unfolded, setUnfolded] = useState(() => new Set(openOnMobile ?? visible.slice(0, 2).map((o) => o.id)));
  // The section being read on a phone, lit in the chip row.
  const [reading, setReading] = useState(visible[0]?.id);

  // The open tab, also for the anchor listener, which keeps its first render's closure.
  const current = useRef(active);

  const openTab = (id: string, byVisitor = false) => {
    if (byVisitor && trackAs && id !== current.current) trackEvent(trackAs, "Tab opened", id);
    current.current = id;
    setActive(id);
    setOpen((o) => (o.has(id) ? o : new Set(o).add(id)));
  };

  const unfold = (id: string) => {
    setUnfolded((o) => (o.has(id) ? o : new Set(o).add(id)));
    setOpen((o) => (o.has(id) ? o : new Set(o).add(id)));
  };

  /** Brings a section's header just under the sticky header and chip row. */
  const scrollToSection = (id: string, smooth: boolean) => {
    spyPausedUntil.current = performance.now() + 1200;
    // After the render that unfolds it.
    requestAnimationFrame(() => {
      const el = sections.current[id];
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET;
      window.scrollTo({ top, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
    });
  };

  // The hash picks the tab on arrival, then on every internal link to
  // another anchor of the same page.
  useEffect(() => {
    const followAnchor = (scroll: boolean, byVisitor = false) => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const renamed = resolveAnchor(hash, aliases);
      const id = renamed ?? hash;
      if (!visible.some((o) => o.id === id)) return;
      if (renamed) window.history.replaceState(null, "", `#${id}`);
      openTab(id, byVisitor);
      if (sectionsOnMobile && isMobile()) {
        unfold(id);
        setReading(id);
        if (scroll) scrollToSection(id, false);
      } else if (scroll) list.current?.scrollIntoView({ block: "start" });
    };
    followAnchor(true);
    const onChange = () => followAnchor(true, true);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
    // A page's tabs and aliases do not change after render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The section being read, on a phone: the last one whose header has passed
  // under the sticky row. Measured once per frame, from a passive listener.
  useEffect(() => {
    if (!sectionsOnMobile) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!isMobile() || performance.now() < spyPausedUntil.current) return;
      let now = visible[0]?.id;
      for (const o of visible) {
        const el = sections.current[o.id];
        if (el && el.getBoundingClientRect().top <= STICKY_OFFSET + 24) now = o.id;
      }
      setReading(now);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
    // A page's tabs do not change after render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsOnMobile]);

  // The lit chip stays in view within its row, which scrolls sideways.
  useEffect(() => {
    const strip = row.current;
    const chip = strip?.querySelector<HTMLElement>(`[data-chip="${reading}"]`);
    if (!strip || !chip || !isMobile()) return;
    const left = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [reading]);

  const choose = (id: string) => {
    openTab(id, true);
    // replaceState: switching tabs does not fill the browser history.
    window.history.replaceState(null, "", `#${id}`);
  };

  /** A chip of the sticky row: unfolds its section and scrolls to it. */
  const jump = (id: string) => {
    if (trackAs) trackEvent(trackAs, "Section nav", id);
    current.current = id;
    setActive(id);
    unfold(id);
    setReading(id);
    window.history.replaceState(null, "", `#${id}`);
    scrollToSection(id, true);
  };

  /** A section header, on a phone: folds or unfolds it. */
  const toggle = (id: string) => {
    if (unfolded.has(id)) {
      setUnfolded((o) => {
        const next = new Set(o);
        next.delete(id);
        return next;
      });
      return;
    }
    if (trackAs) trackEvent(trackAs, "Section opened", id);
    unfold(id);
  };

  /** Arrows and Home/End, as a screen reader expects on tabs. */
  function byKeyboard(event: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: visible.length - 1,
    };
    const target = keys[event.key];
    if (target === undefined) return;

    event.preventDefault();
    const next = (target + visible.length) % visible.length;
    choose(visible[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      {sectionsOnMobile && (
        <nav
          aria-label={t("common.jumpToSection")}
          className="sticky top-16 z-30 -mx-[clamp(1rem,0.4rem+2.4vw,3rem)] mb-2 border-b border-night-800 bg-night-950/95 backdrop-blur md:hidden"
        >
          <div ref={row} className="flex gap-2 overflow-x-auto px-[clamp(1rem,0.4rem+2.4vw,3rem)] py-2.5 [scrollbar-width:none]">
            {visible.map((o) => (
              <button
                key={o.id}
                type="button"
                data-chip={o.id}
                aria-current={o.id === reading ? "true" : undefined}
                onClick={() => jump(o.id)}
                className={cn(
                  classesChip(o.id === reading),
                  "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap font-heading font-bold uppercase",
                )}
              >
                {o.label}
                {o.counter !== undefined && <span className="text-xs opacity-70">{o.counter}</span>}
              </button>
            ))}
          </div>
        </nav>
      )}
      <div
        ref={list}
        role="tablist"
        aria-label={t("common.sections")}
        className={cn("flex scroll-mt-20 flex-wrap gap-x-1 border-b border-night-800", sectionsOnMobile && "max-md:hidden")}
      >
        {visible.map((o, i) => {
          const selected = o.id === active;
          return (
            <button
              key={o.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              role="tab"
              id={`${base}-${o.id}`}
              aria-selected={selected}
              aria-controls={`${base}-${o.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(o.id)}
              onKeyDown={(e) => byKeyboard(e, i)}
              className={cn(
                "eclat-under px-3 py-3 font-heading text-lg font-bold uppercase leading-none transition-colors sm:px-4 sm:text-xl",
                selected
                  ? "text-gold-400"
                  : "text-chalk-400 hover:text-chalk-100",
              )}
            >
              {o.label}
              {o.counter !== undefined && (
                <span className="ml-1.5 text-sm text-chalk-500">
                  {o.counter}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.map((o) => {
        const content =
          // The first tab is open from the server render on, like the non-deferred ones.
          !o.deferred || o.id === tabs[0]?.id ? (
            o.content
          ) : openTabs.has(o.id) ? (
            // Only ever rendered in the browser, once opened: in the server
            // render, a Suspense boundary would move the panel's HTML out of
            // place. Content loading lazily keeps the preview on screen until
            // it arrives.
            <Suspense fallback={o.preview ?? null}>{o.content}</Suspense>
          ) : (
            (o.preview ?? null)
          );
        const panelId = `${base}-${o.id}-panel`;

        if (!sectionsOnMobile) {
          return (
            <div
              key={o.id}
              role="tabpanel"
              id={panelId}
              aria-labelledby={`${base}-${o.id}`}
              hidden={o.id !== active}
              tabIndex={0}
              className="pt-8"
            >
              {content}
            </div>
          );
        }

        // A tab panel from `md` up (only the active one shown), a folding
        // section below: CSS alone decides.
        const open = unfolded.has(o.id);
        return (
          <div
            key={o.id}
            ref={(el) => {
              sections.current[o.id] = el;
            }}
            className={cn("max-md:border-b max-md:border-night-800", o.id !== active && "md:hidden")}
          >
            <h2 className="md:hidden">
              <button
                type="button"
                id={`${base}-${o.id}-header`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(o.id)}
                className="flex min-h-14 w-full items-center gap-2 py-3 text-left font-heading text-xl font-bold uppercase leading-none text-chalk-100"
              >
                <span className="min-w-0 flex-1">
                  {o.label}
                  {o.counter !== undefined && <span className="ml-1.5 text-sm text-chalk-500">{o.counter}</span>}
                </span>
                <ChevronDown
                  size={22}
                  aria-hidden
                  className={cn("shrink-0 text-gold-400 transition-transform", open && "rotate-180")}
                />
              </button>
            </h2>
            <div
              role={stacked ? "region" : "tabpanel"}
              id={panelId}
              aria-labelledby={stacked ? `${base}-${o.id}-header` : `${base}-${o.id}`}
              tabIndex={stacked ? undefined : 0}
              className={cn("md:pt-8", open ? "max-md:pb-8 max-md:pt-2" : "max-md:hidden")}
            >
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
