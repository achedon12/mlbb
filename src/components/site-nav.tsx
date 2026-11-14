"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { LOCALES } from "@/i18n/config";
import { sectionOf } from "@/lib/sections";
import { cn } from "@/lib/utils";

const LOCALE_PREFIX = new RegExp(`^/(?:${LOCALES.join("|")})(?=/|$)`);

/**
 * Header navigation: six section buttons, each opening its panel.
 *
 * One tree for every width. From `xl` up the buttons sit in the header and a
 * panel drops under it, across the page; below, the burger opens the same
 * tree as a full-height sheet where the buttons are accordion headers. The
 * panels themselves are server-rendered (`NavPanel`) and handed in as
 * children: the links are in the HTML of every page, and the browser only
 * runs this toggle.
 */
export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  panel: React.ReactNode;
}

const DESKTOP = "(min-width: 80rem) and (hover: hover)";

export function SiteNav({
  items,
  label,
  openLabel,
  closeLabel,
  actions,
  sheetFooter,
}: {
  items: NavItem[];
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

  // The link of the page itself is marked current, in every panel.
  useEffect(() => {
    nav.current?.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      if (a.pathname === path) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }, [path]);

  // Escape, or a click outside, closes; Escape gives focus back to the button.
  useEffect(() => {
    if (!open && !sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const button = open ? document.getElementById(`nav-button-${open}`) : document.getElementById("nav-burger");
      if (open && window.matchMedia(DESKTOP).matches) setOpen(null);
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
          {items.map((item) => {
            const isOpen = open === item.key;
            const active = current === item.key;
            return (
              <li
                key={item.key}
                className="border-b border-night-800 xl:border-0"
                onMouseEnter={() => hover(item.key)}
                onMouseLeave={() => hover(null)}
              >
                <button
                  type="button"
                  id={`nav-button-${item.key}`}
                  aria-expanded={isOpen}
                  aria-controls={`nav-panel-${item.key}`}
                  onClick={() => setOpen(isOpen ? null : item.key)}
                  className={cn(
                    "relative flex w-full items-center gap-2 py-3.5 text-left font-heading text-lg font-semibold transition-colors xl:w-auto xl:gap-1.5 xl:rounded-md xl:px-2.5 xl:py-2 2xl:px-3 xl:font-body xl:text-sm xl:font-medium",
                    isOpen || active ? "text-chalk-100" : "text-chalk-300 hover:text-chalk-100",
                  )}
                >
                  <span aria-hidden className={cn("shrink-0 xl:max-2xl:hidden", active ? "text-gold-400" : "text-chalk-500")}>
                    {item.icon}
                  </span>
                  <span className="flex-1 xl:whitespace-nowrap">{item.label}</span>
                  <ChevronDown
                    size={15}
                    aria-hidden
                    className={cn("shrink-0 text-chalk-500 transition-transform duration-200", isOpen && "rotate-180")}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 -bottom-px hidden h-0.5 bg-gold-500 xl:block",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
                <div
                  id={`nav-panel-${item.key}`}
                  hidden={!isOpen}
                  className="pb-4 xl:absolute xl:inset-x-0 xl:top-full xl:z-50 xl:border-b xl:border-night-700/80 xl:bg-night-900 xl:pb-0 xl:shadow-2xl xl:shadow-night-950/70"
                >
                  {item.panel}
                </div>
              </li>
            );
          })}
        </ul>
        {sheetFooter && <div className="mt-6 xl:hidden">{sheetFooter}</div>}
      </nav>

      {/* `data-bottom-ui`: while the sheet is open, the Discord invitation steps aside. */}
      <span data-bottom-ui hidden={!sheet} />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
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
