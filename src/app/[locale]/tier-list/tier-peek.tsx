"use client";

import { useId, useRef, type ReactNode } from "react";
import { ChevronRight, Info, X } from "lucide-react";
import Link from "@/components/link";
import { LightImage } from "@/components/light-image";
import { trackEvent } from "@/lib/analytics";
import { usualIcon } from "@/lib/tier-list-filters";
import { cn } from "@/lib/utils";
import "@/components/meta/meta.css";

/** Matomo category of every tier list event. */
export const CATEGORY = "Tier list";

/**
 * A hero's preview in the tier list: who counters it and what it builds,
 * as slugs; the names and pictures come from the tier's `PeekDict`, once,
 * rather than repeated on every hero that shares a counter or an item.
 */
export interface PeekData {
  /** Heroes it loses to the most. */
  c: string[];
  /** Item slugs of its most played build. */
  i: string[];
}

export interface PeekDict {
  /** Name of each counter, and its icon when it is not in the usual slot. */
  heroes: Record<string, { name: string; icon?: string | null }>;
  items: Record<string, { name: string; image: string | null }>;
}

export interface LabelsPeek {
  /** "Preview of {name}": the button's accessible name. */
  open: string;
  close: string;
  counters: string;
  items: string;
  full: string;
  win: string;
  ban: string;
  pick: string;
}

/** Same breakpoint as the stylesheet: below it, the preview is a bottom sheet. */
const ANCHORED = "(min-width: 40rem)";
const HOVER = "(hover: hover) and (pointer: fine)";
/** Room the preview needs under its hero before it opens above instead. */
const ROOM_BELOW = 300;
const WIDTH = 320;

/**
 * A hero of the tier list with its preview: the hero's link (its card or
 * its row, `children`) stays the main target — a tap opens the hero page —
 * and a button beside it opens the preview. On a desktop, resting the mouse
 * on the hero opens it too.
 *
 * The preview is a native popover: one open at a time, closed by Escape or
 * a tap outside, drawn above everything without a portal. On a phone it is a
 * bottom sheet; from `sm` up it is anchored under (or over) the hero.
 */
export function PeekItem({
  slug,
  name,
  rates,
  peek,
  dict,
  labels,
  variant,
  children,
}: {
  slug: string;
  name: string;
  rates: { win: string; ban: string; pick: string };
  peek: PeekData;
  dict: PeekDict;
  labels: LabelsPeek;
  variant: "tile" | "line";
  children: ReactNode;
}) {
  const id = useId();
  const item = useRef<HTMLLIElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // How the open preview was opened: one opened by the mouse closes when it leaves.
  const by = useRef<"hover" | "click" | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const isOpen = () => panel.current?.matches(":popover-open") ?? false;

  const hoverable = (e: React.PointerEvent) =>
    e.pointerType === "mouse" && window.matchMedia(HOVER).matches && window.matchMedia(ANCHORED).matches;

  const onEnter = (e: React.PointerEvent) => {
    if (!hoverable(e)) return;
    clear();
    if (isOpen()) return;
    timer.current = setTimeout(() => {
      if (isOpen()) return;
      by.current = "hover";
      panel.current?.showPopover();
      trackEvent(CATEGORY, "Preview hovered", slug);
    }, 450);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (!hoverable(e)) return;
    clear();
    timer.current = setTimeout(() => {
      if (by.current === "hover" && isOpen()) panel.current?.hidePopover();
    }, 250);
  };

  // Anchored under the hero, or over it when the screen ends too soon; the
  // stylesheet ignores the coordinates on a phone.
  const place = () => {
    const li = item.current;
    const el = panel.current;
    if (!li || !el) return;
    if (!window.matchMedia(ANCHORED).matches) {
      el.style.removeProperty("--peek-top");
      el.style.removeProperty("--peek-left");
      el.removeAttribute("data-above");
      return;
    }
    const r = li.getBoundingClientRect();
    // Right edge on the hero's, where its button sits, kept inside the screen.
    const left = Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8));
    const above = window.innerHeight - r.bottom < ROOM_BELOW && r.top > ROOM_BELOW;
    el.style.setProperty("--peek-left", `${left}px`);
    el.style.setProperty("--peek-top", `${above ? r.top - 6 : r.bottom + 6}px`);
    el.toggleAttribute("data-above", above);
  };

  const onBeforeToggle = (e: React.ToggleEvent<HTMLDivElement>) => {
    if (e.newState === "open") {
      place();
      // An anchored preview does not follow the page: it closes on scroll.
      if (window.matchMedia(ANCHORED).matches) {
        window.addEventListener("scroll", () => panel.current?.hidePopover(), { once: true, passive: true });
      }
    } else {
      by.current = null;
      clear();
    }
  };

  const icon = (s: string) => {
    const known = dict.heroes[s];
    return known?.icon === undefined ? usualIcon(s) : known.icon;
  };

  return (
    <li ref={item} className="tl-peek-item" onPointerEnter={onEnter} onPointerLeave={onLeave}>
      {children}
      <button
        type="button"
        popoverTarget={id}
        aria-label={labels.open.replace("{name}", name)}
        title={labels.open.replace("{name}", name)}
        className={cn("tl-peek-button", variant === "tile" ? "is-tile" : "is-line")}
        onClick={() => {
          if (isOpen()) return;
          by.current = "click";
          trackEvent(CATEGORY, "Preview opened", slug);
        }}
      >
        <Info aria-hidden className="size-4.5" />
      </button>

      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={labels.open.replace("{name}", name)}
        className="tl-peek"
        onBeforeToggle={onBeforeToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/heroes/${slug}`}
            data-track="Preview hero"
            data-track-name={slug}
            className="display-caps text-2xl text-chalk-100 transition-colors hover:text-gold-300"
          >
            {name}
          </Link>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label={labels.close}
            className="tl-peek-close"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <dl className="tl-peek-rates">
          <div>
            <dt>{labels.win}</dt>
            <dd className="text-gold-400">{rates.win}</dd>
          </div>
          <div>
            <dt>{labels.ban}</dt>
            <dd>{rates.ban}</dd>
          </div>
          <div>
            <dt>{labels.pick}</dt>
            <dd>{rates.pick}</dd>
          </div>
        </dl>

        {peek.c.length > 0 && (
          <div className="mt-3">
            <p className="tl-peek-label">{labels.counters}</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {peek.c.map((s) => {
                const src = icon(s);
                const counterName = dict.heroes[s]?.name ?? s;
                return (
                  <li key={s}>
                    <Link
                      href={`/heroes/${s}`}
                      data-track="Preview counter"
                      data-track-name={s}
                      className="tl-peek-chip"
                    >
                      {src ? (
                        <LightImage src={src} alt="" width={28} height={28} className="bevel-sm size-7 object-cover" />
                      ) : null}
                      <span className="truncate">{counterName}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {peek.i.length > 0 && (
          <div className="mt-3">
            <p className="tl-peek-label">{labels.items}</p>
            <ul className="mt-1.5 grid grid-cols-3 gap-2">
              {peek.i.map((s) => {
                const o = dict.items[s];
                return (
                  <li key={s}>
                    <Link
                      href={`/items/${s}`}
                      data-track="Preview item"
                      data-track-name={s}
                      className="tl-peek-item-link"
                    >
                      {o?.image ? (
                        <LightImage src={o.image} alt="" width={40} height={40} className="size-10 object-contain" />
                      ) : (
                        <span aria-hidden className="size-10 bg-night-800" />
                      )}
                      <span className="line-clamp-2 text-center text-[0.7rem] leading-tight text-chalk-300">
                        {o?.name ?? s}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Link
          href={`/heroes/${slug}`}
          data-track="Full guide"
          data-track-name={slug}
          className="btn btn-primary mt-4 w-full"
        >
          {labels.full}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
    </li>
  );
}
