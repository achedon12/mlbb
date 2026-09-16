import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import { ItemList } from "@/components/item-list";
import { PageHeader } from "@/components/ui";
import visuals from "@/data/game/visuals.json";
import { buildsPlayed, categoriesItems, heroesBySlug, countItems, itemsFor } from "@/lib/data";
import { visualItem } from "@/lib/build-visuals";
import type { HeroThumb } from "@/components/item-list";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import { metaPage, metaPaged } from "@/i18n/seo";
import { listNames, itemsPopular, patchCurrent } from "@/lib/freshness";
import { pageCount, SIZE_CARDS } from "@/lib/pager";

const PATH_ITEMS = "/items";

/** How many pages the catalogue holds, for the routes to prerender them. */
export const pagesItems = () => pageCount(countItems, SIZE_CARDS);

export function metaItems(locale: Locale, page = 1): Metadata {
  const t = createT(locale);
  const popular = itemsPopular(locale);
  const values = { n: countItems, v: patchCurrent.version, top: listNames(locale, popular) };
  return metaPaged(
    metaPage(locale, {
      title: t("pages.seo.items.title", values),
      description: popular.length
        ? t("pages.seo.items.description", values)
        : t("pages.items.metaDescription", { n: countItems }),
      share: t("pages.items.ogDescription", { n: countItems }),
      path: PATH_ITEMS,
    }),
    locale,
    PATH_ITEMS,
    page,
  );
}

const images = visuals.items as Record<string, string>;

/**
 * Item catalogue, shared by `/items` and `/items/page/n`.
 *
 * A hundred and thirteen thumbnails ran five screens on a phone below the
 * filters: the grid is cut into pages of twenty-four, each at an address the
 * server prerenders, and every item stays reachable from the sitemap and
 * from its own page.
 */
export async function Items({ locale, page = 1 }: { locale: Locale; page?: number }) {
  const t = createT(locale);
  const previews = itemsFor(locale).map((o) => ({ ...o, image: images[o.slug] ?? null }));

  // Heroes that take each item in their most played builds, all
  // ranks combined, most played first. The browser only receives
  // ids, and a single table of the heroes cited.
  const usage = new Map<string, Map<string, number>>();
  for (const [slug, byLane] of Object.entries(buildsPlayed)) {
    for (const byRank of Object.values(byLane)) {
      for (const build of byRank.all ?? []) {
        for (const name of build.items) {
          const target = visualItem(name).slug;
          if (!target) continue;
          const byHero = usage.get(target) ?? new Map<string, number>();
          usage.set(target, byHero);
          byHero.set(slug, Math.max(byHero.get(slug) ?? 0, build.pickRate ?? 0));
        }
      }
    }
  }
  const usedBy = Object.fromEntries(
    [...usage].map(([item, byHero]) => [
      item,
      [...byHero].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([slug]) => slug),
    ]),
  );
  const heroThumbs: Record<string, HeroThumb> = {};
  for (const slug of new Set(Object.values(usedBy).flat())) {
    const h = heroesBySlug.get(slug);
    if (h) heroThumbs[slug] = { name: h.name, portrait: h.images.icon ?? h.images.portrait };
  }

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.itemsList"])}>
      <PageHeader title={t("pages.items.title")} lead={t("pages.items.lead", { n: countItems })} />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-4">
        <ItemList
          items={previews}
          categories={categoriesItems}
          usedBy={usedBy}
          heroThumbs={heroThumbs}
          page={page}
        />
      </div>
    </ExtendMessages>
  );
}
