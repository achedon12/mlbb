"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
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

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const t = useT();
  const [active, setActive] = useState(tabs[0]?.id);
  const [openTabs, setOpen] = useState(() => new Set(tabs[0] ? [tabs[0].id] : []));
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);

  // A tab without content has no reason to appear: a hero with no skin and
  // no analysis must not show empty sections.
  const visible = tabs.filter((o) => o.content);

  const openTab = (id: string) => {
    setActive(id);
    setOpen((o) => (o.has(id) ? o : new Set(o).add(id)));
  };

  // The hash picks the tab on arrival, then on every internal link to
  // another anchor of the same page.
  useEffect(() => {
    const followAnchor = (scroll: boolean) => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!visible.some((o) => o.id === id)) return;
      openTab(id);
      if (scroll) list.current?.scrollIntoView({ block: "start" });
    };
    followAnchor(true);
    const onChange = () => followAnchor(true);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
    // A page's tabs do not change after render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (id: string) => {
    openTab(id);
    // replaceState: switching tabs does not fill the browser history.
    window.history.replaceState(null, "", `#${id}`);
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
      <div
        ref={list}
        role="tablist"
        aria-label={t("common.sections")}
        className="flex scroll-mt-20 flex-wrap gap-1 border-b border-night-700/70"
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
              aria-controls={`${base}-${o.id}-panneau`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(o.id)}
              onKeyDown={(e) => byKeyboard(e, i)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 font-heading text-sm font-semibold transition-colors",
                selected
                  ? "border-gold-500 text-gold-400"
                  : "border-transparent text-chalk-500 hover:text-chalk-100",
              )}
            >
              {o.label}
              {o.counter !== undefined && (
                <span className="ml-1.5 text-xs font-medium text-chalk-500">
                  {o.counter}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.map((o) => (
        <div
          key={o.id}
          role="tabpanel"
          id={`${base}-${o.id}-panneau`}
          aria-labelledby={`${base}-${o.id}`}
          hidden={o.id !== active}
          tabIndex={0}
          className="pt-8 outline-none"
        >
          {!o.deferred || openTabs.has(o.id) ? o.content : (o.preview ?? null)}
        </div>
      ))}
    </div>
  );
}
