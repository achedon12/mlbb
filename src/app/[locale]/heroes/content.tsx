import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import { serializeJsonLd } from "@/lib/html";
import { HeroList } from "@/components/hero-list";
import { PageHeader } from "@/components/ui";
import { allHeroes, heroAnalyses, countSkins } from "@/lib/data";
import { rankingFull, rateBySlug } from "@/lib/tier-list";
import { longDate, dateMeasure, listNames, patchCurrent } from "@/lib/freshness";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import { heroListData, metaPage, metaPaged } from "@/i18n/seo";
import { pageCount, SIZE_CARDS } from "@/lib/pager";

/**
 * Hero catalogue, shared by `/heroes` and `/heroes/page/n`.
 *
 * The two routes render the same thing at a different offset, so neither
 * reads a query string: they stay prerendered, which is how the most visited
 * page of the site is served.
 */

export const PATH_HEROES = "/heroes";

/** How many pages the catalogue holds, for the routes to prerender them. */
export const pagesHeroes = () => pageCount(allHeroes.length, SIZE_CARDS);

/** Description built from data: roster size, patch and measurement date, top three of the tier list. */
function descriptionCatalog(locale: Locale): string {
  const t = createT(locale);
  return t("pages.seo.heroes.description", {
    n: allHeroes.length,
    v: patchCurrent.version,
    date: longDate(locale),
    top: listNames(locale, rankingFull.slice(0, 3).map((e) => e.hero.name)),
    skins: countSkins,
    analyses: heroAnalyses.length,
  });
}

export function metaHeroes(locale: Locale, page = 1): Metadata {
  const t = createT(locale);
  return metaPaged(
    metaPage(locale, {
      title: t("pages.seo.heroes.title", { n: allHeroes.length, v: patchCurrent.version }),
      description: descriptionCatalog(locale),
      share: t("pages.heroes.ogDescription", { heroes: allHeroes.length, skins: countSkins }),
      path: PATH_HEROES,
    }),
    locale,
    PATH_HEROES,
    page,
  );
}

export function Heroes({ locale, page = 1 }: { locale: Locale; page?: number }) {
  const t = createT(locale);

  const structuredData = heroListData(locale, {
    name: t("pages.heroes.listLd"),
    description: descriptionCatalog(locale),
    path: PATH_HEROES,
    heroes: allHeroes.map((h) => ({ name: h.name, slug: h.slug })),
    changed: dateMeasure,
  });

  // Only the fields shown by the thumbnails are sent to the client.
  const previews = allHeroes.map((h) => {
    const rate = rateBySlug.get(h.slug);
    return {
      slug: h.slug,
      name: h.name,
      roles: h.roles,
      lanes: h.lanes,
      portrait: h.images.icon ?? h.images.portrait,
      skins: h.skins.length,
      analysis: h.analysis !== null,
      win: rate?.win ?? null,
      tier: rate?.tier ?? null,
    };
  });

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList"])}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PageHeader
        title={t("pages.heroes.title")}
        lead={t("pages.heroes.lead", {
          heroes: allHeroes.length,
          skins: countSkins,
          analyses: heroAnalyses.length,
        })}
      />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-4">
        <HeroList heroes={previews} page={page} />
      </div>
    </ExtendMessages>
  );
}
