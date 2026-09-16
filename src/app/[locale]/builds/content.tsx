import type { Metadata } from "next";
import { CommunityBuildCard } from "@/components/community-build-card";
import { Pager } from "@/components/pager";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { PageHeader } from "@/components/ui";
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
 * Community builds hub: the week's most voted builds, the latest ones, and
 * the heroes that have some. Rendered on each request - votes move all the
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

const sectionTitle = "font-heading text-2xl font-bold text-chalk-100";

export async function CommunityBuilds({ locale, page = 1 }: { locale: Locale; page?: number }) {
  const t = createT(locale);
  const { builds: stored, viewer, now } = await readCommunity();
  const itemNames = buildNames(locale, t).items;
  const heroOf = (slug: string) => {
    const h = heroesBySlug.get(slug);
    return { name: h?.name ?? slug, icon: h?.images.icon ?? null };
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
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
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

  return (
    <>
      <PageHeader title={t("pages.communityBuilds.title")} lead={t("pages.communityBuilds.lead")}>
        <Link
          href="/tools/build"
          className="bevel-sm mt-5 inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("pages.communityBuilds.createCta")}
        </Link>
      </PageHeader>
      <ExtendMessages messages={messagesPage(locale, ["pages.communityBuildsUI"])}>
        <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
          {stored === null ? (
            <p role="alert" className="border border-blood-500/40 p-4 text-chalk-300">
              {t("pages.communityBuilds.unavailable")}
            </p>
          ) : stored.length === 0 ? (
            <p className="border border-dashed border-night-700 p-6 text-chalk-300">{t("pages.communityBuilds.emptyStore")}</p>
          ) : (
            <>
              <section aria-labelledby="week-title">
                <h2 id="week-title" className={sectionTitle}>
                  {t("pages.communityBuilds.weekTitle")}
                </h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                {week.length ? cards(week) : <p className="mt-4 text-chalk-400">{t("pages.communityBuilds.weekEmpty")}</p>}
              </section>

              <section aria-labelledby="latest-title">
                <h2 id="latest-title" className={sectionTitle}>
                  {t("pages.communityBuilds.latestTitle")}
                </h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                {cards(latest)}
              </section>

              <section aria-labelledby="heroes-title">
                <h2 id="heroes-title" className={sectionTitle}>
                  {t("pages.communityBuilds.byHeroTitle")}
                </h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                <ul className="mt-5 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {heroesPage.map(([slug, n]) => {
                    const h = heroOf(slug);
                    return (
                      <li key={slug}>
                        <Link
                          href={`/builds/${slug}`}
                          className="flex min-h-14 items-center gap-3 border border-night-800 bg-night-900/60 p-2 transition-colors hover:border-gold-500/60"
                        >
                          <HeroPortrait source={h.icon} name={h.name} size="icon" decorative />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-chalk-100">{h.name}</span>
                            <span className="block text-xs text-chalk-500">{t("pages.communityBuilds.buildCount", { n })}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <Pager paging={view} href={(n) => pageHref(PATH, null, n)} t={t} />
              </section>
            </>
          )}

          <section aria-labelledby="rules-title" className="max-w-3xl border-t border-night-800 pt-6 text-sm leading-relaxed text-chalk-400">
            <h2 id="rules-title" className="font-semibold text-chalk-300">
              {t("pages.communityBuilds.rulesTitle")}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("pages.communityBuilds.rules1")}</li>
              <li>{t("pages.communityBuilds.rules2", { n: INDEX_THRESHOLD })}</li>
              <li>{t("pages.communityBuilds.rules3")}</li>
            </ul>
          </section>
        </div>
      </ExtendMessages>
    </>
  );
}
