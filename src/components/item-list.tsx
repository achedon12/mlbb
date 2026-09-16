"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { SearchField } from "@/components/search-field";
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
import { Chip } from "@/components/chip";
import { ChipActive, FilterBar } from "@/components/filter-bar";
import { Drawer } from "@/components/drawer";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { keySearch, cn } from "@/lib/utils";

/**
 * Item catalogue.
 *
 * A dense grid of icons rather than stacked cards: we compare
 * items, and comparing means seeing them together. The full detail opens
 * in a side panel, which avoids repeating ten lines of statistics
 * on every thumbnail. Each item also has its own page, rendered on the server.
 */
export type { PreviewItem };

/** Hero cited by an item: enough to show their thumbnail. */
export interface HeroThumb {
  name: string;
  portrait: string | null;
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
}: {
  items: PreviewItem[];
  categories: string[];
  /** Heroes who pick each item (by item slug), most played first. */
  usedBy: Record<string, string[]>;
  heroThumbs: Record<string, HeroThumb>;
}) {
  const [search, setSearch] = useState("");
  const t = useT();
  const locale = useLocale();
  const [category, setCategory] = useState<string | null>(null);

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
  }, [active]);

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

  const item = items.find((o) => o.slug === active) ?? null;

  // Recipes name their components: we find them by name, and read
  // recipes backwards to know what each item is used to craft.
  const catalog = useMemo<Catalog>(
    () => ({ ...catalogRecipes(items), usedBy, heroes: heroThumbs }),
    [items, usedBy, heroThumbs],
  );

  return (
    <div>
      <FilterBar
        search={<SearchField value={search} onChange={setSearch} label={t("pages.itemsList.search")} dense />}
        active={category && <ChipActive label={t(`categories.${category}`)} onRemove={() => setCategory(null)} />}
        count={
          <span aria-live="polite">
            {t("pages.itemsList.account", { n: results.length })}
            {results.length !== items.length && ` ${t("pages.itemsList.countOf", { total: items.length })}`}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {t(`categories.${c}`)}
            </Chip>
          ))}
        </div>
      </FilterBar>

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
          {results.map((o) => {
            const selected = o.slug === item?.slug;
            return (
              <li key={o.slug} className="offscreen">
                <button
                  type="button"
                  id={o.slug}
                  onClick={() => select(selected ? null : o.slug)}
                  aria-pressed={selected}
                  className={cn(
                    "bevel-sm flex h-full w-full flex-col items-center gap-1.5 border p-2 text-center transition-colors",
                    selected
                      ? "border-gold-500 bg-gold-500/10"
                      : "border-night-700/70 bg-night-900/60 hover:border-gold-500/50",
                  )}
                >
                  <span className="relative size-11 shrink-0">
                    {o.image ? (
                      <Image src={o.image} alt="" width={44} height={44} className="size-full object-contain" />
                    ) : (
                      <span className="grid size-full place-items-center bg-night-800 text-[0.6rem] text-chalk-500">
                        —
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium leading-tight text-chalk-100">
                    {o.name}
                  </span>
                  {o.price !== null && (
                    // The unit is spelled out: a bare number under
                    // an item icon reads as a level or a quantity,
                    // not as a price.
                    <span className="text-xs tabular-nums text-gold-400">
                      {o.price.toLocaleString(LOCALE_HTML[locale])} {t("pages.itemsList.gold")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
          {item ? (
            <ItemSheet item={item} catalog={catalog} />
          ) : (
            <p className="bevel border border-dashed border-night-700 p-5 text-sm leading-relaxed text-chalk-500">
              {t("pages.itemsList.choose")}
            </p>
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

/** Detailed item card, shared by the side column and the drawer. */
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
  return (
            <div className={cn("p-5", !withoutFrame && "bevel border border-night-700/70 bg-night-900/60")}>
              <div className="flex items-start gap-3">
                {item.image && (
                  <span className="relative size-14 shrink-0">
                    <Image src={item.image} alt="" fill sizes="56px" className="object-contain" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-bold leading-tight text-chalk-100">
                    {item.name}
                  </h2>
                  {item.summary && (
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-chalk-500">
                      {item.summary}
                    </p>
                  )}
                  {item.price !== null && (
                    <p className="mt-1 text-sm text-chalk-500">
                      {t("pages.itemsList.price")}{" "}
                      <span className="font-heading text-gold-400">
                        {item.price.toLocaleString(LOCALE_HTML[locale])} {t("pages.itemsList.gold")}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <EffectsItem item={item} t={t} />
                <RecipeItem item={item} catalog={catalog} t={t} locale={locale} to={toAnchor} />
                {users.length > 0 && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsList.usedBy")}</dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {users.map((slug) => (
                        <Link
                          key={slug}
                          href={`/heroes/${slug}`}
                          className="bevel-sm group flex items-center gap-1.5 border border-night-700/70 bg-night-900/60 py-1 pl-1 pr-2 transition-colors hover:border-gold-500/60"
                        >
                          <HeroPortrait
                            source={catalog.heroes[slug]?.portrait ?? null}
                            name={catalog.heroes[slug]?.name ?? slug}
                            size="micro"
                            decorative
                          />
                          <span className="text-xs text-chalk-300 group-hover:text-gold-400">{catalog.heroes[slug]?.name ?? slug}</span>
                        </Link>
                      ))}
                    </dd>
                    <p className="mt-1.5 text-xs text-chalk-500">{t("pages.itemsList.usedByHelp")}</p>
                  </div>
                )}
              </dl>

              {/* The item page adds what the card cannot hold: rates per hero and per rank. */}
              <Link
                href={`/items/${item.slug}`}
                className="mt-5 inline-block text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
              >
                {t("pages.itemsList.fullPage")} →
              </Link>
            </div>
  );
}
