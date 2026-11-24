"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import Link from "@/components/link";
import { Dex } from "@/components/mascot";
import type { Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { prefix } from "@/i18n/links";
import { trackEvent, trackSiteSearch } from "@/lib/analytics";
import type { EntrySearch } from "@/lib/search";
import { closest, prepare, searchIndex } from "@/lib/search-score";
import { cn } from "@/lib/utils";

/**
 * Global search: heroes, items, skills, skins, patch notes and sections, from
 * any page. Ctrl+K (Cmd+K on Mac) opens and closes it. The index is one static
 * file per language, requested when the search button is aimed at or the
 * dialog first opens: it weighs nothing until you search.
 */
const INDEX = new Map<Locale, Promise<EntrySearch[]>>();

function load(locale: Locale): Promise<EntrySearch[]> {
  let promise = INDEX.get(locale);
  if (!promise) {
    promise = fetch(`/${locale}/search.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    INDEX.set(locale, promise);
  }
  return promise;
}

/** Window event that opens the dialog, for triggers outside the header. */
export const OPEN_SEARCH_EVENT = "mlbbdex:open-search";

/** Pages shown before anything is typed. */
const BY_GROUP = 6;

export function GlobalSearch() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const [entries, setEntries] = useState<EntrySearch[] | null>(null);
  const list = useRef<HTMLDivElement>(null);
  // The search under way, for the keyboard shortcuts that close the dialog.
  const abandon = useRef<() => void>(() => {});

  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abandon.current();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        abandon.current();
        setOpen(false);
      }
    };
    // A button elsewhere on the page (the home page search) opens the same dialog.
    const request = () => setOpen(true);
    window.addEventListener("keydown", shortcut);
    window.addEventListener(OPEN_SEARCH_EVENT, request);
    return () => {
      window.removeEventListener("keydown", shortcut);
      window.removeEventListener(OPEN_SEARCH_EVENT, request);
    };
  }, []);

  useEffect(() => {
    if (!open || entries) return;
    let cancelled = false;
    load(locale).then((e) => {
      if (!cancelled) setEntries(e);
    });
    return () => {
      cancelled = true;
    };
  }, [open, entries, locale]);

  // Search keys computed once per index, not on every keystroke.
  const prepared = useMemo(() => (entries ?? []).map(prepare), [entries]);
  // Without a query, the sections; otherwise the matches from the first
  // letter on, forgiving typos (`lib/search-score.ts`).
  const groups = useMemo(() => {
    if (!entries) return [];
    if (!search.trim()) {
      const pages = entries.filter((e) => e.type === "page").sort((a, b) => a.title.localeCompare(b.title));
      return [{ type: "page" as const, entries: pages.slice(0, BY_GROUP) }];
    }
    return searchIndex(search, prepared);
  }, [entries, prepared, search]);
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  // Nothing found: the nearest names, offered instead of a dead end. The
  // arrows and Enter then go through them.
  const nearest = useMemo(
    () => (flat.length === 0 && search.trim() ? closest(search, prepared) : []),
    [flat, prepared, search],
  );
  const options = flat.length > 0 ? flat : nearest;
  const field = useRef<HTMLInputElement>(null);
  // Skins and skills come without an image: they take their hero's icon,
  // whose entry holds the hero page address without an anchor.
  const icons = useMemo(
    () => new Map((entries ?? []).flatMap((e) => (e.type === "hero" && e.image ? [[e.href, e.image]] : []))),
    [entries],
  );
  const imageOf = (e: EntrySearch) => e.image ?? icons.get(e.href.split("#")[0]) ?? null;

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  /**
   * The search reaches the audience measurement when the dialog closes, once:
   * filed under the type of the result chosen, or under no category when the
   * visitor gave up — a term with no result shows what the index lacks.
   */
  const record = (chosen?: EntrySearch) => {
    trackSiteSearch(search, chosen?.type ?? false, flat.length);
    // Which result was picked, and at which rank (1 is the top): tells
    // whether the ranking puts first what visitors want.
    if (chosen && search.trim()) {
      const rank = flat.indexOf(chosen);
      trackEvent("Search", "Pick", chosen.href, rank < 0 ? 0 : rank + 1);
    }
  };
  useEffect(() => {
    abandon.current = () => {
      if (open) trackSiteSearch(search, false, flat.length);
    };
  }, [open, search, flat]);

  const close = (chosen?: EntrySearch) => {
    record(chosen);
    setOpen(false);
    setSearch("");
    setActive(0);
  };

  /**
   * A result pointing to a tab of the open page ("#skins") only changes the
   * anchor: the router would not fire `hashchange`, which the hero page
   * listens to in order to open the tab. The browser handles it then — first
   * clearing the anchor if it is already the right one, so the event fires.
   * Returns true if navigation was done.
   */
  const anchorLocale = (href: string) => {
    const [path, anchor] = prefix(href, locale).split("#");
    if (anchor === undefined || path !== window.location.pathname) return false;
    if (window.location.hash === `#${anchor}`) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    window.location.hash = anchor;
    return true;
  };

  const go = (target: EntrySearch) => {
    close(target);
    if (!anchorLocale(target.href)) router.push(prefix(target.href, locale));
  };

  const keyboard = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && options[active]) {
      e.preventDefault();
      go(options[active]);
    }
  };

  const pick = (e: EntrySearch, click: React.MouseEvent) => {
    if (anchorLocale(e.href)) click.preventDefault();
    close(e);
  };
  const option = (e: EntrySearch, i: number) => (
    <SearchOption
      key={`${e.type}-${e.href}-${e.title}`}
      entry={e}
      id={`${id}-${i}`}
      index={i}
      active={i === active}
      image={imageOf(e)}
      onPick={pick}
      onHover={setActive}
    />
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // The index starts loading as soon as the button is aimed at, so the
        // first letter typed already has its suggestions.
        onPointerEnter={() => void load(locale)}
        onFocus={() => void load(locale)}
        onTouchStart={() => void load(locale)}
        aria-label={t("search.open")}
        aria-keyshortcuts="Control+K Meta+K"
        className="bevel-sm flex h-9 min-w-9 items-center justify-center gap-2 bg-night-800 px-2 text-sm text-chalk-300 transition-colors hover:bg-night-700 hover:text-gold-300 active:translate-y-px sm:px-2.5"
      >
        <Search size={16} aria-hidden />
        <span className="hidden 2xl:inline">{t("search.open")}</span>
        <kbd className="hidden bg-night-950/60 px-1 text-[0.7rem] text-chalk-500 2xl:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-night-950/80 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("search.open")}
            className="bevel flex max-h-[75vh] w-full max-w-xl flex-col border border-night-700 bg-night-900 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-night-800 px-4">
              <Search size={18} aria-hidden className="shrink-0 text-chalk-500" />
              <input
                ref={field}
                autoFocus
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                role="combobox"
                aria-expanded
                aria-autocomplete="list"
                aria-controls={`${id}-list`}
                aria-activedescendant={options[active] ? `${id}-${active}` : undefined}
                aria-label={t("search.placeholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActive(0);
                }}
                onKeyDown={keyboard}
                placeholder={t("search.placeholder")}
                className="min-w-0 flex-1 bg-transparent py-3.5 text-base text-chalk-100 outline-none placeholder:text-chalk-500 sm:text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActive(0);
                    field.current?.focus();
                  }}
                  aria-label={t("search.clear")}
                  className="-mr-2 grid size-11 shrink-0 place-items-center text-chalk-500 transition-colors hover:text-gold-300"
                >
                  <X size={18} aria-hidden />
                </button>
              )}
              <kbd className="bevel-sm hidden bg-night-800 px-1.5 text-[0.7rem] text-chalk-500 sm:inline">Esc</kbd>
            </div>

            <div ref={list} id={`${id}-list`} role="listbox" className="overflow-y-auto overscroll-contain p-2">
              {!entries ? (
                <p className="px-3 py-6 text-center text-sm text-chalk-500">{t("search.loading")}</p>
              ) : flat.length === 0 ? (
                <>
                  <div className="flex items-end justify-center gap-3 px-3 py-6">
                    <Dex pose="triste" height={110} still />
                    <div className="dex-bubble max-w-xs text-left text-sm">
                      <p className="font-heading text-base font-bold uppercase text-chalk-100">{t("search.none")}</p>
                      <p className="mt-1 text-chalk-400">{t(nearest.length > 0 ? "search.dexClosest" : "search.dexEmpty")}</p>
                    </div>
                  </div>
                  {nearest.length > 0 && (
                    <div className="mb-2">
                      <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.18em] text-chalk-500">
                        {t("search.closest")}
                      </p>
                      {nearest.map((e, i) => option(e, i))}
                    </div>
                  )}
                </>
              ) : (
                groups.map((g) => (
                  <div key={g.type} className="mb-2">
                    <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.18em] text-chalk-500">
                      {t(`search.groups.${g.type}`)}
                    </p>
                    {g.entries.map((e) => option(e, flat.indexOf(e)))}
                  </div>
                ))
              )}
            </div>
            <p className="hidden border-t border-night-800 px-4 py-2 text-xs text-chalk-500 sm:block">{t("search.help")}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** One result row: a portrait (the hero's for skins and skills), the name, its detail. */
function SearchOption({
  entry: e,
  id,
  index,
  active,
  image,
  onPick,
  onHover,
}: {
  entry: EntrySearch;
  id: string;
  index: number;
  active: boolean;
  image: string | null;
  onPick: (e: EntrySearch, click: React.MouseEvent) => void;
  onHover: (index: number) => void;
}) {
  const hero = e.type === "hero";
  return (
    <Link
      id={id}
      data-index={index}
      role="option"
      aria-selected={active}
      href={e.href}
      onClick={(click) => onPick(e, click)}
      onMouseEnter={() => onHover(index)}
      className={cn(
        "bevel-sm flex min-h-11 items-center gap-3 px-3 py-1.5",
        active ? "bg-night-800 text-gold-400" : "text-chalk-200",
      )}
    >
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded bg-night-800 text-xs font-bold text-chalk-500",
          hero ? "size-10" : "size-8",
        )}
      >
        {image ? (
          <Image src={image} alt="" width={hero ? 40 : 32} height={hero ? 40 : 32} className="size-full object-cover" />
        ) : (
          e.title.charAt(0)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{e.title}</span>
        {e.detail && <span className="block truncate text-xs text-chalk-500">{e.detail}</span>}
      </span>
    </Link>
  );
}
