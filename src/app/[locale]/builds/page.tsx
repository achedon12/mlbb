import type { Metadata } from "next";
import { CommunityBuildCard } from "@/components/community-build-card";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { buildNames } from "@/lib/build-catalog";
import { INDEX_THRESHOLD, sortBuilds, toPublic, weekVotes } from "@/lib/community-builds";
import { readCommunity } from "@/lib/community-builds-server";
import { herosParSlug } from "@/lib/donnees";

/**
 * Community builds hub: the week's most voted builds, the latest ones, and
 * the heroes that have some. Rendered on each request - votes move all the
 * time - and indexable: it is the entry point of the section.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/builds";
const WEEK_COUNT = 6;
const LATEST_COUNT = 12;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.communityBuilds.title"),
    description: t("pages.seo.communityBuilds.description"),
    chemin: PATH,
    motsCles: ["builds", "community", "votes", "Mobile Legends", "MLBB"],
  });
}

const sectionTitle = "font-titre text-2xl font-bold text-craie-100";

export default async function CommunityBuildsPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const { builds: stored, viewer, now } = await readCommunity();
  const itemNames = buildNames(locale, t).items;
  const heroOf = (slug: string) => {
    const h = herosParSlug.get(slug);
    return { name: h?.nom ?? slug, icon: h?.visuels.icone ?? null };
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
    .filter(([slug]) => herosParSlug.has(slug))
    .sort((a, b) => b[1] - a[1] || heroOf(a[0]).name.localeCompare(heroOf(b[0]).name));

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
      <EnTetePage titre={t("pages.communityBuilds.title")} chapeau={t("pages.communityBuilds.lead")}>
        <Link
          href="/tools/build"
          className="biseau-sm mt-5 inline-flex min-h-11 items-center bg-or-500 px-4 text-sm font-semibold text-nuit-950 transition-colors hover:bg-or-400"
        >
          {t("pages.communityBuilds.createCta")}
        </Link>
      </EnTetePage>
      <CompleterMessages messages={messagesPage(locale, ["pages.communityBuildsUI"])}>
        <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
          {stored === null ? (
            <p role="alert" className="border border-sang-500/40 p-4 text-craie-300">
              {t("pages.communityBuilds.unavailable")}
            </p>
          ) : stored.length === 0 ? (
            <p className="border border-dashed border-nuit-700 p-6 text-craie-300">{t("pages.communityBuilds.emptyStore")}</p>
          ) : (
            <>
              <section aria-labelledby="week-title">
                <h2 id="week-title" className={sectionTitle}>
                  {t("pages.communityBuilds.weekTitle")}
                </h2>
                <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
                {week.length ? cards(week) : <p className="mt-4 text-craie-400">{t("pages.communityBuilds.weekEmpty")}</p>}
              </section>

              <section aria-labelledby="latest-title">
                <h2 id="latest-title" className={sectionTitle}>
                  {t("pages.communityBuilds.latestTitle")}
                </h2>
                <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
                {cards(latest)}
              </section>

              <section aria-labelledby="heroes-title">
                <h2 id="heroes-title" className={sectionTitle}>
                  {t("pages.communityBuilds.byHeroTitle")}
                </h2>
                <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
                <ul className="mt-5 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {heroes.map(([slug, n]) => {
                    const h = heroOf(slug);
                    return (
                      <li key={slug}>
                        <Link
                          href={`/builds/${slug}`}
                          className="flex min-h-14 items-center gap-3 border border-nuit-800 bg-nuit-900/60 p-2 transition-colors hover:border-or-500/60"
                        >
                          <PortraitHeros source={h.icon} nom={h.name} taille="icone" decoratif />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-craie-100">{h.name}</span>
                            <span className="block text-xs text-craie-500">{t("pages.communityBuilds.buildCount", { n })}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          <section aria-labelledby="rules-title" className="max-w-3xl border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-400">
            <h2 id="rules-title" className="font-semibold text-craie-300">
              {t("pages.communityBuilds.rulesTitle")}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("pages.communityBuilds.rules1")}</li>
              <li>{t("pages.communityBuilds.rules2", { n: INDEX_THRESHOLD })}</li>
              <li>{t("pages.communityBuilds.rules3")}</li>
            </ul>
          </section>
        </div>
      </CompleterMessages>
    </>
  );
}
