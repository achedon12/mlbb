import type { Metadata } from "next";
import { ExtendMessages } from "@/i18n/provider";
import { serializeJsonLd } from "@/lib/html";
import { FreeRotationTeaser } from "@/components/free-rotation-teaser";
import { HeroList } from "@/components/hero-list";
import { heroArt } from "@/components/hero-art";
import { PosterHeader } from "@/components/poster-header";
import { Score } from "@/components/ui";
import { allHeroes, heroAnalyses, countSkins } from "@/lib/data";
import { rankingFull, rateBySlug } from "@/lib/tier-list";
import { longDate, dateMeasure, listNames, patchCurrent } from "@/lib/freshness";
import type { Locale } from "@/i18n/config";
import { createT, messagesPage } from "@/i18n/translations";
import type { Role } from "@/lib/types";
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
      portrait: h.images.portrait ?? h.images.icon,
      skins: h.skins.length,
      analysis: h.analysis !== null,
      win: rate?.win ?? null,
      tier: rate?.tier ?? null,
    };
  });

  // The poster: the five strongest heroes of the patch, side by side.
  const poster = rankingFull.slice(0, 5).map((e) => heroArt(e.hero.slug));
  // The role filter's art: the strongest hero of each role.
  const roleArt: Partial<Record<Role, string>> = {};
  for (const e of rankingFull) {
    for (const r of e.hero.roles) {
      if (!roleArt[r] && e.hero.images.portrait) roleArt[r] = e.hero.images.portrait;
    }
  }

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.heroesList"])}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <PosterHeader
        title={t("pages.heroes.title")}
        lead={t("pages.heroes.lead", {
          heroes: allHeroes.length,
          skins: countSkins,
          analyses: heroAnalyses.length,
        })}
        art={poster}
        aside={
          <p className="hidden text-right lg:block">
            <Score value={allHeroes.length} className="text-[clamp(5rem,3rem+5vw,8.5rem)]" />
            <span className="mt-2 block font-heading text-lg font-bold uppercase text-chalk-300">
              {t("pages.heroesList.account", { n: "" }).trim()}
            </span>
          </p>
        }
      >
        <FreeRotationTeaser locale={locale} className="mt-5 max-w-md" />
      </PosterHeader>
      <div className="page-wrap pb-12 pt-6">
        <HeroList heroes={previews} page={page} roleArt={roleArt} />
      </div>
    </ExtendMessages>
  );
}
