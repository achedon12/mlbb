"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { SearchField } from "@/components/search-field";
import { useSearchReport } from "@/components/use-search-report";
import {
  catalogRecipes,
  EffectsItem,
  RecipeItem,
  type PreviewItem,
  type CatalogRecipes,
  type ToItem,
} from "@/components/item-sheet";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { HeroTile } from "@/components/hero-tile";
import { GlyphPanel } from "@/components/glyph-panel";
import { Dex } from "@/components/mascot";
import motion from "@/components/catalogue-motion.module.css";
import { ChipActive, FilterBar } from "@/components/filter-bar";
import { Drawer } from "@/components/drawer";
import { Pager } from "@/components/pager";
import { pageHref, paging, pathWithoutPage, slicePage, SIZE_CARDS } from "@/lib/pager";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { keySearch, cn } from "@/lib/utils";

/**
 * Item catalogue.
 *
 * A dense grid of icons rather than stacked cards: we compare
 * items, and comparing means seeing them together. The full detail opens
 * in a side panel, which avoids repeating ten lines of statistics
 * on every thumbnail. Each item also has its own page, rendered on the server.
 *
 * A hundred and thirteen thumbnails is five screens of a phone: only the
 * slice the address names is shown (`/items/page/3`, prerendered by the
 * server), three to a row below `sm`, and a change of filter goes back to the
 * first page — the third page of eight results holds nothing.
 */
export type { PreviewItem };

/** Hero cited by an item: enough to show their thumbnail. */
export interface HeroThumb {
  name: string;
  /** Tall portrait, for the tiles; the icon as a fallback. */
  portrait: string | null;
  /** Square icon, for the small chips. */
  icon: string | null;
}

/**
 * The catalogue seen from recipes and builds: each item by name,
 * what it is used to craft, and the heroes who pick it.
 */
interface Catalog extends CatalogRecipes {
  usedBy: Record<string, string[]>;
  heroes: Record<string, HeroThumb>;
}

/**
 * Changes the open item.
 *
 * `replaceState` does not fire `hashchange`: so we dispatch it ourselves,
 * otherwise the display would not follow the address change.
 */
function select(slug: string | null) {
  history.replaceState(null, "", slug ? `#${slug}` : window.location.pathname);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function closeItem() {
  select(null);
}

/** In the catalogue, another item opens in place, through the anchor. */
const toAnchor: ToItem = (o, content, className) => (
  <button type="button" onClick={() => select(o.slug)} className={className}>
    {content}
  </button>
);

export function ItemList({
  items,
  categories,
  usedBy,
  heroThumbs,
  page: pageServer = 1,
}: {
  items: PreviewItem[];
  categories: string[];
  /** Heroes who pick each item (by item slug), most played first. */
  usedBy: Record<string, string[]>;
  heroThumbs: Record<string, HeroThumb>;
  /** Page the address names; the list starts there. */
  page?: number;
}) {
  const [search, setSearch] = useState("");
  const t = useT();
  const locale = useLocale();
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(pageServer);

  const slugsKnown = useMemo(() => new Set(items.map((o) => o.slug)), [items]);

  /**
   * The open item is designated by the address, not by local state.
   *
   * Hero page builds link here with an anchor, for example
   * `/items#bloodlust-axe`. Making the address the single source avoids having
   * to sync two truths: the incoming link, the selection and the shareable
   * link all describe the same thing.
   */
  const anchor = useSyncExternalStore(
    (refresh) => {
      window.addEventListener("hashchange", refresh);
      return () => window.removeEventListener("hashchange", refresh);
    },
    () => window.location.hash,
    // Server render: no known anchor.
    () => "",
  );

  const active = useMemo(() => {
    const target = decodeURIComponent(anchor.replace(/^#/, ""));
    return target && slugsKnown.has(target) ? target : null;
  }, [anchor, slugsKnown]);

  // An item designated by the address must be visible: we scroll the grid
  // to it rather than leaving the user to look for it.
  useEffect(() => {
    if (!active) return;
    const image = requestAnimationFrame(() => {
      document.getElementById(active)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(image);
  }, [active, page]);

  const results = useMemo(() => {
    const term = keySearch(search.trim());
    return items.filter((o) => {
      // The open item always stays shown, even outside the current filter.
      if (o.slug === active) return true;
      if (category && o.category !== category) return false;
      if (!term) return true;
      return (
        keySearch(o.name).includes(term) ||
        keySearch(o.bonus ?? "").includes(term) ||
        keySearch(o.passive ?? "").includes(term)
      );
    });
  }, [items, search, category, active]);
  useSearchReport(search, results.length, "Items");

  // An item named by the address is on the page that holds it, whatever page
  // the reader was on: a link like `/items#thunder-belt` must land on it.
  const rank = active ? results.findIndex((o) => o.slug === active) : -1;
  const wanted = rank >= 0 ? Math.floor(rank / SIZE_CARDS) + 1 : page;
  const view = paging(results.length, wanted, SIZE_CARDS);
  const slice = slicePage(results, view.page, SIZE_CARDS);

  // Paging in place writes the address the pager's link already held, so the
  // page being read is the page that gets shared.
  useEffect(() => {
    const path = pageHref(pathWithoutPage(window.location.pathname), null, view.page);
    window.history.replaceState(null, "", path + window.location.hash);
  }, [view.page]);

  const item = items.find((o) => o.slug === active) ?? null;

  // Recipes name their components: we find them by name, and read
  // recipes backwards to know what each item is used to craft.
  const catalog = useMemo<Catalog>(
    () => ({ ...catalogRecipes(items), usedBy, heroes: heroThumbs }),
    [items, usedBy, heroThumbs],
  );

  // Each category tab carries the icon of its most expensive item: the
  // armoury is read by its pieces before its words.
  const signOf = useMemo(() => {
    const best = new Map<string, PreviewItem>();
    for (const o of items) {
      const top = best.get(o.category);
      if (o.image && (!top || (o.price ?? 0) > (top.price ?? 0))) best.set(o.category, o);
    }
    return best;
  }, [items]);

  return (
    <div>
      <FilterBar
        search={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            label={t("pages.itemsList.search")}
            dense
          />
        }
        active={
          category && (
            <ChipActive
              label={t(`categories.${category}`)}
              onRemove={() => {
                setCategory(null);
                setPage(1);
              }}
            />
          )
        }
        count={
          <span aria-live="polite">
            {t("pages.itemsList.account", { n: results.length })}
            {results.length !== items.length && ` ${t("pages.itemsList.countOf", { total: items.length })}`}
          </span>
        }
      >
        {/* The armoury's racks: one tab per category, its best piece as its sign. */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = category === c;
            const sign = signOf.get(c)?.image;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setCategory(on ? null : c);
                  setPage(1);
                }}
                className={cn(
                  "eclat-under bevel-sm group inline-flex min-h-11 items-center gap-2 py-1 pl-1.5 pr-3.5 font-heading text-base font-bold uppercase transition-colors",
                  on ? "is-active bg-night-800 text-gold-400" : "bg-night-900 text-chalk-300 hover:bg-night-800 hover:text-chalk-100",
                )}
              >
                {sign ? (
                  <span className={cn("grid size-8 place-items-center", motion.zoom)}>
                    <Image src={sign} alt="" width={32} height={32} className="size-8 object-contain" />
                  </span>
                ) : (
                  <span aria-hidden className="size-8" />
                )}
                {t(`categories.${c}`)}
              </button>
            );
          })}
        </div>
      </FilterBar>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem] xl:gap-8">
        <div className={cn("min-w-0", motion.rise)}>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] sm:gap-3">
            {slice.map((o) => {
              const selected = o.slug === item?.slug;
              return (
                <li key={o.slug} className="offscreen">
                  <button
                    type="button"
                    id={o.slug}
                    onClick={() => select(selected ? null : o.slug)}
                    aria-pressed={selected}
                    className={cn(
                      "eclat-under bevel group flex h-full w-full flex-col items-center gap-2 px-1.5 pb-3.5 pt-4 text-center sm:px-2 sm:pt-5",
                      motion.lift,
                      selected
                        ? "is-active bg-night-800 shadow-[inset_0_0_0_1px_var(--color-gold-400),inset_0_3px_0_var(--color-gold-400)]"
                        : "bg-night-900 hover:bg-night-850",
                    )}
                  >
                    <span className={cn("relative size-14 shrink-0 sm:size-[4.5rem]", motion.zoom)}>
                      {o.image ? (
                        <Image src={o.image} alt="" width={72} height={72} className="size-full object-contain drop-shadow-[0_6px_10px_rgb(0_0_0/0.5)]" />
                      ) : (
                        <span className="grid size-full place-items-center bg-night-800 text-[0.6rem] text-chalk-500">
                          —
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-heading text-[0.85rem] font-bold leading-tight transition-colors sm:text-[0.95rem]",
                        selected ? "text-gold-300" : "text-chalk-100 group-hover:text-gold-300",
                      )}
                    >
                      {o.name}
                    </span>
                    {o.price !== null && (
                      // The unit is spelled out: a bare number under
                      // an item icon reads as a level or a quantity,
                      // not as a price.
                      <span className="mt-auto text-xs tabular-nums text-gold-400">
                        {o.price.toLocaleString(LOCALE_INTL[locale])} {t("pages.itemsList.gold")}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Pager paging={view} href={(n) => pageHref("/items", null, n)} onNavigate={setPage} t={t} />
        </div>

        <aside className="hidden h-fit lg:sticky lg:top-32 lg:block">
          {item ? (
            <ItemSheet key={item.slug} item={item} catalog={catalog} />
          ) : (
            <div className="bevel-lg flex flex-col items-center gap-4 bg-night-900 px-6 py-10 text-center">
              <Dex pose="pointe" height={150} />
              <p className="max-w-xs text-sm leading-relaxed text-chalk-300">{t("pages.itemsList.choose")}</p>
            </div>
          )}
        </aside>
      </div>

      {/*
        On mobile, the card slides up as a drawer from the bottom: no need to
        scroll down past a grid of a hundred items to read it.
      */}
      {item && (
        <Drawer title={item.name} onClose={closeItem} labelClose={t("pages.itemsList.close")}>
          <ItemSheet item={item} catalog={catalog} withoutFrame />
        </Drawer>
      )}
    </div>
  );
}

/**
 * Detailed item card, shared by the side column and the drawer: the item
 * large on its panel, the éclat crossing it as it is chosen, then its stats,
 * the heroes who carry it and its recipe.
 */
function ItemSheet({
  item,
  catalog,
  withoutFrame = false,
}: {
  item: PreviewItem;
  catalog: Catalog;
  withoutFrame?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const users = catalog.usedBy[item.slug] ?? [];
  const tiles = users.slice(0, 3);
  const others = users.slice(3);
  const heroName = (slug: string) => catalog.heroes[slug]?.name ?? slug;
  return (
    <div className={cn("p-5 sm:p-6", !withoutFrame && "bevel-lg bg-night-900")}>
      <div className="flex items-center gap-4">
        <GlyphPanel image={item.image} size={84} flash className="size-28 sm:size-32" />
        <div className="min-w-0">
          <h2 className="display-caps break-words text-[2.1rem] text-chalk-100">{item.name}</h2>
          {item.summary && <p className="mt-1.5 text-sm text-chalk-400">{item.summary}</p>}
          {item.price !== null && (
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="sr-only">{t("pages.itemsList.price")}</span>
              <span className="score text-[2.4rem]">{item.price.toLocaleString(LOCALE_INTL[locale])}</span>
              <span className="font-heading text-sm font-bold uppercase text-gold-400">{t("pages.itemsList.gold")}</span>
            </p>
          )}
        </div>
      </div>
      <div aria-hidden className="eclat mt-5 h-[3px] w-20" />

      <dl className="mt-5 space-y-4 text-sm">
        <EffectsItem item={item} t={t} />
        {users.length > 0 && (
          <div>
            <dt className="font-heading text-sm font-bold text-gold-400">{t("pages.itemsList.usedBy")}</dt>
            <dd className="mt-2">
              <ul className="grid grid-cols-3 gap-2">
                {tiles.map((slug) => (
                  <li key={slug}>
                    <HeroTile
                      href={`/heroes/${slug}`}
                      name={heroName(slug)}
                      portrait={catalog.heroes[slug]?.portrait ?? null}
                      sizes="(min-width: 1024px) 8rem, 30vw"
                    />
                  </li>
                ))}
              </ul>
              {others.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {others.map((slug) => (
                    <li key={slug}>
                      <Link
                        href={`/heroes/${slug}`}
                        className="bevel-sm group flex items-center gap-1.5 bg-night-800 py-1 pl-1 pr-2.5 transition-colors hover:bg-night-700"
                      >
                        <HeroPortrait source={catalog.heroes[slug]?.icon ?? null} name={heroName(slug)} size="mini" decorative />
                        <span className="text-xs text-chalk-200 group-hover:text-gold-400">{heroName(slug)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-chalk-500">{t("pages.itemsList.usedByHelp")}</p>
            </dd>
          </div>
        )}
        <RecipeItem item={item} catalog={catalog} t={t} locale={locale} to={toAnchor} />
      </dl>

      {/* The item page adds what the card cannot hold: rates per hero and per rank. */}
      <Link href={`/items/${item.slug}`} className="btn btn-secondary btn-sm mt-6">
        {t("pages.itemsList.fullPage")} →
      </Link>
    </div>
  );
}
