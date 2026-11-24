import type { Metadata } from "next";
import { CommunityBuildCard } from "@/components/community-build-card";
import { Pager } from "@/components/pager";
import Link from "@/components/link";
import { SectionTitle } from "@/components/ui";
import { HeroTile } from "@/components/hero-tile";
import { Dex, DexSays } from "@/components/mascot";
import { MetaPoster, artOf } from "@/components/meta/meta-poster";
import { PosterHero } from "@/components/meta/poster-hero";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage, metaPaged } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { buildNames } from "@/lib/build-catalog";
import { INDEX_THRESHOLD, sortBuilds, toPublic, weekVotes } from "@/lib/community-builds";
import { readCommunity } from "@/lib/community-builds-server";
import { heroesBySlug } from "@/lib/data";
import { pageHref, paging, SIZE_CARDS, slicePage } from "@/lib/pager";

/**
 * Community builds hub: the week's most voted builds, the heroes that have
 * some (as portraits, their count of builds in gold), and the latest ones. Rendered on each request - votes move all the
 * time - and indexable: it is the entry point of the section.
 */
export const dynamic = "force-dynamic";

const PATH = "/builds";
const WEEK_COUNT = 6;
const LATEST_COUNT = 12;

export function metaBuilds(locale: Locale, page = 1): Metadata {
  const t = createT(locale);
  return metaPaged(
    metaPage(locale, {
      title: t("pages.seo.communityBuilds.title"),
      description: t("pages.seo.communityBuilds.description"),
      path: PATH,
      keywords: ["builds", "community", "votes", "Mobile Legends", "MLBB"],
    }),
    locale,
    PATH,
    page,
  );
}

export async function CommunityBuilds({ locale, page = 1 }: { locale: Locale; page?: number }) {
  const t = createT(locale);
  const { builds: stored, viewer, now } = await readCommunity();
  const itemNames = buildNames(locale, t).items;
  const heroOf = (slug: string) => {
    const h = heroesBySlug.get(slug);
    return { name: h?.name ?? slug, icon: h?.images.icon ?? null, portrait: h?.images.portrait ?? null };
  };

  const week = stored
    ? sortBuilds(stored, "week", now)
        .filter((b) => weekVotes(b, now) > 0)
        .slice(0, WEEK_COUNT)
    : [];
  const latest = stored ? sortBuilds(stored, "recent", now).slice(0, LATEST_COUNT) : [];
  const counts = new Map<string, number>();
  for (const b of stored ?? []) counts.set(b.build.hero, (counts.get(b.build.hero) ?? 0) + 1);
  const heroes = [...counts]
    .filter(([slug]) => heroesBySlug.has(slug))
    .sort((a, b) => b[1] - a[1] || heroOf(a[0]).name.localeCompare(heroOf(b[0]).name));
  // The heroes that have builds grow with the section: read one page at a
  // time, each page a real address the server answers.
  const view = paging(heroes.length, page, SIZE_CARDS);
  const heroesPage = slicePage(heroes, view.page, SIZE_CARDS);

  const cards = (list: typeof latest) => (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {list.map((b) => (
        <CommunityBuildCard
          key={b.id}
          build={toPublic(b, viewer, now)}
          t={t}
          locale={locale}
          hero={heroOf(b.build.hero)}
          itemNames={itemNames}
          signedIn={viewer !== null}
          showHero
        />
      ))}
    </div>
  );

  // The poster: the hero with the most builds; Dex with an idea while there is none.
  const top = heroes[0];
  const topHero = top ? heroesBySlug.get(top[0]) : undefined;
  const create = (
    <Link href="/tools/build" className="btn btn-primary">
      {t("pages.communityBuilds.createCta")}
    </Link>
  );

  return (
    <>
      <MetaPoster
        title={t("pages.communityBuilds.title")}
        lead={t("pages.communityBuilds.lead")}
        art={topHero ? artOf(topHero.slug) : null}
        portrait={topHero?.images.portrait ?? null}
        compact
        actions={create}
        feature={
          topHero && top ? (
            <PosterHero
              href={`/builds/${topHero.slug}`}
              kicker={t("pages.communityBuilds.poster.kicker")}
              name={topHero.name}
              figure={String(top[1])}
              unit=""
              caption={t("pages.communityBuilds.buildCount", { n: top[1] })}
              label={t("pages.communityBuilds.buildCount", { n: top[1] })}
            />
          ) : (
            <Dex pose="idee" height={220} priority className="max-lg:hidden lg:ml-auto" />
          )
        }
      />
      <ExtendMessages messages={messagesPage(locale, ["pages.communityBuildsUI"])}>
        <div className="page-wrap space-y-16 py-10 sm:py-14">
          {stored === null ? (
            <DexSays pose="triste">
              <p role="alert">{t("pages.communityBuilds.unavailable")}</p>
            </DexSays>
          ) : stored.length === 0 ? (
            <DexSays pose="surpris">
              <p>{t("pages.communityBuilds.emptyStore")}</p>
              <p className="mt-3">{create}</p>
            </DexSays>
          ) : (
            <>
              <section aria-labelledby="week-title">
                <SectionTitle id="week-title">{t("pages.communityBuilds.weekTitle")}</SectionTitle>
                {week.length ? (
                  cards(week)
                ) : (
                  <DexSays pose="dodo" height={96}>
                    <p>{t("pages.communityBuilds.weekEmpty")}</p>
                  </DexSays>
                )}
              </section>

              <section aria-labelledby="heroes-title">
                <SectionTitle id="heroes-title">{t("pages.communityBuilds.byHeroTitle")}</SectionTitle>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3 lg:grid-cols-8">
                  {heroesPage.map(([slug, n]) => {
                    const h = heroesBySlug.get(slug);
                    return (
                      <li key={slug} className="min-w-0">
                        <HeroTile
                          href={`/builds/${slug}`}
                          name={h?.name ?? slug}
                          portrait={h?.images.portrait ?? h?.images.icon ?? null}
                          figure={String(n)}
                          label={t("pages.communityBuilds.buildCount", { n })}
                          sizes="(min-width: 1024px) 11vw, (min-width: 640px) 18vw, 31vw"
                        />
                      </li>
                    );
                  })}
                </ul>
                <Pager paging={view} href={(n) => pageHref(PATH, null, n)} t={t} />
              </section>

              <section aria-labelledby="latest-title">
                <SectionTitle id="latest-title">{t("pages.communityBuilds.latestTitle")}</SectionTitle>
                {cards(latest)}
              </section>
            </>
          )}

          <section aria-labelledby="rules-title">
            <div aria-hidden className="eclat-rule mb-8" />
            <DexSays pose="reflexion" height={110}>
              <h2 id="rules-title" className="font-heading text-lg font-bold text-chalk-100">
                {t("pages.communityBuilds.rulesTitle")}
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>{t("pages.communityBuilds.rules1")}</li>
                <li>{t("pages.communityBuilds.rules2", { n: INDEX_THRESHOLD })}</li>
                <li>{t("pages.communityBuilds.rules3")}</li>
              </ul>
            </DexSays>
          </section>
        </div>
      </ExtendMessages>
    </>
  );
}
