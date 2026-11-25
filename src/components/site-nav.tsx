"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { LOCALES } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { SECTIONS, sectionOf } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { NavLinks, NavPanel } from "./nav-panel";

const LOCALE_PREFIX = new RegExp(`^/(?:${LOCALES.join("|")})(?=/|$)`);

/**
 * Header navigation: six section buttons, each opening its panel.
 *
 * One tree for every width. From `xl` up the buttons sit in the header and a
 * panel drops under it, across the page; below, the burger opens the same
 * tree as a full-height sheet where the buttons are accordion headers.
 *
 * The full panels (icons, descriptions, layout) are only built in the
 * browser, for the open section: rendered on the server for each of the six
 * sections, they weighed some 85 KB of HTML in every page, and as much again
 * in its RSC payload. A closed section keeps its links in the HTML as a bare
 * list (`NavLinks`), so crawlers still find every address of the menu. The
 * labels come from the shared client catalog (`nav`), the structure from
 * `SECTIONS`: nothing is passed down from the server.
 */

const DESKTOP = "(min-width: 80rem) and (hover: hover)";

export function SiteNav({
  label,
  openLabel,
  closeLabel,
  actions,
  sheetFooter,
}: {
  /** Accessible name of the navigation landmark. */
  label: string;
  openLabel: string;
  closeLabel: string;
  /** Search, language and account, between the sections and the burger. */
  actions: React.ReactNode;
  /** Shown at the end of the mobile sheet only (the Discord invite, hidden from the narrow header). */
  sheetFooter?: React.ReactNode;
}) {
  const path = usePathname();
  // Path without its locale prefix: /fr/tier-list → /tier-list.
  const bare = path.replace(LOCALE_PREFIX, "") || "/";
  const current = sectionOf(bare);
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A navigation closes the menus (state adjusted while rendering, not in an effect).
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(null);
    setSheet(false);
  }

  // Escape, or a click outside, closes; Escape gives focus back to the button.
  useEffect(() => {
    if (!open && !sheet) return;
    const burger = document.getElementById("nav-burger");
    const onKey = (e: KeyboardEvent) => {
      // The open sheet covers the page: Tab cycles through the header (sheet,
      // search, language, account, burger) instead of walking into the links
      // hidden behind it.
      if (e.key === "Tab" && sheet && nav.current) {
        const scope = nav.current.closest("header") ?? nav.current;
        const stops = [
          ...scope.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea"),
        ].filter((el) => el.offsetParent !== null);
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : at === stops.length - 1 ? 0 : at + 1;
        e.preventDefault();
        stops[next]?.focus();
        return;
      }
      if (e.key !== "Escape") return;
      // In the sheet, the section buttons vanish with it: focus returns to the burger.
      const button = sheet ? burger : open ? document.getElementById(`nav-button-${open}`) : burger;
      if (open && !sheet && window.matchMedia(DESKTOP).matches) setOpen(null);
      else {
        setOpen(null);
        setSheet(false);
      }
      button?.focus();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (nav.current?.contains(target) || document.getElementById("nav-burger")?.contains(target)) return;
      setOpen(null);
      setSheet(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, sheet]);

  // The open sheet holds the page still behind it.
  useEffect(() => {
    if (!sheet) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [sheet]);

  const hover = (key: string | null) => {
    if (!window.matchMedia(DESKTOP).matches) return;
    clearTimeout(leave.current);
    if (key) setOpen(key);
    // A short grace period, so crossing the gap to the panel does not close it.
    else leave.current = setTimeout(() => setOpen(null), 160);
  };

  return (
    <>
      <nav
        ref={nav}
        id="site-nav"
        aria-label={label}
        className={cn(
          "xl:static xl:ml-6 xl:block xl:h-auto xl:overflow-visible xl:border-0 xl:bg-transparent xl:p-0",
          sheet
            ? "absolute inset-x-0 top-full block h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-night-800 bg-night-950 px-4 pb-10 pt-2"
            : "hidden",
        )}
      >
        <ul className="xl:flex xl:items-center xl:gap-0.5">
          {SECTIONS.map((item) => {
            const isOpen = open === item.key;
            const active = current === item.key;
            return (
              <li
                key={item.key}
                className="group/nav border-b border-night-800 xl:border-0"
                onMouseEnter={() => hover(item.key)}
                onMouseLeave={() => hover(null)}
              >
                <button
                  type="button"
                  id={`nav-button-${item.key}`}
                  aria-expanded={isOpen}
                  aria-controls={`nav-panel-${item.key}`}
                  // The section of the current page, which the underline shows.
                  aria-current={active ? "true" : undefined}
                  onClick={() => setOpen(isOpen ? null : item.key)}
                  className={cn(
                    // The sheet lists the sections in the display face, like a game menu;
                    // the bar, in the upright condensed face, the blade under the current one.
                    "relative flex w-full items-center gap-2.5 py-4 text-left font-display text-[1.7rem] font-extrabold uppercase italic leading-none transition-colors xl:h-16 xl:w-auto xl:gap-1.5 xl:px-2.5 xl:py-0 xl:font-heading xl:text-[0.95rem] xl:font-bold xl:not-italic xl:tracking-wide 2xl:px-3",
                    isOpen || active ? "text-chalk-100" : "text-chalk-300 hover:text-chalk-100",
                  )}
                >
                  <span aria-hidden className={cn("shrink-0 xl:max-2xl:hidden", active ? "text-gold-400" : "text-chalk-500")}>
                    <item.icon size={16} />
                  </span>
                  <span className="flex-1 xl:whitespace-nowrap">{t(`nav.groups.${item.key}`)}</span>
                  <ChevronDown
                    size={15}
                    aria-hidden
                    className={cn("shrink-0 text-chalk-500 transition-transform duration-200", isOpen && "rotate-180")}
                  />
                  {/* The éclat: under the current section, and sliding in under the hovered one. */}
                  <span
                    aria-hidden
                    className={cn(
                      "eclat absolute inset-x-2 bottom-0 hidden h-[3px] origin-left transition-transform duration-200 xl:block",
                      active || isOpen ? "scale-x-100" : "scale-x-0 group-hover/nav:scale-x-100",
                      !active && "opacity-70",
                    )}
                  />
                </button>
                <div
                  id={`nav-panel-${item.key}`}
                  hidden={!isOpen}
                  className="pb-4 xl:absolute xl:inset-x-0 xl:top-full xl:z-50 xl:border-y xl:border-night-800 xl:bg-night-900 xl:pb-0 xl:shadow-2xl xl:shadow-night-950/70"
                >
                  {isOpen ? <NavPanel section={item} current={bare} /> : <NavLinks section={item} />}
                </div>
              </li>
            );
          })}
        </ul>
        {sheetFooter && <div className="mt-6 xl:hidden">{sheetFooter}</div>}
      </nav>

      {/* `data-bottom-ui`: while the sheet is open, the Discord invitation steps aside. */}
      <span data-bottom-ui hidden={!sheet} />

      {/* Below `sm`, 44 px targets with a 2 px gap: the row stays as wide as it
          was with 36 px ones and still fits beside the logo at 360 px. */}
      <div className="ml-auto flex items-center gap-0.5 sm:gap-2">
        {actions}
        <button
          type="button"
          id="nav-burger"
          onClick={() => {
            // The sheet opens on the section of the current page.
            if (!sheet) setOpen(current);
            setSheet(!sheet);
          }}
          aria-expanded={sheet}
          aria-controls="site-nav"
          aria-label={sheet ? closeLabel : openLabel}
          className="grid size-10 place-items-center text-chalk-300 transition-colors hover:text-gold-400 xl:hidden"
        >
          {sheet ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>
    </>
  );
}
