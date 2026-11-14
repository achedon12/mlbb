import { Users } from "lucide-react";
import type { Metadata } from "next";
import { DiscordAlternative, Rules, SearchForm, ThreadList, Unavailable, ago } from "@/components/community/parts";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { CATEGORIES } from "@/lib/community/constants";
import { categoryStats, listThreads } from "@/lib/community/store";
import { requestTime } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";

/**
 * Community hub: the forum's categories with their activity, the latest
 * threads across all of them, the teammate finder. Rendered on each request,
 * indexable: it is the entry point of the section.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.community.seo.title"),
    description: t("pages.community.seo.description"),
    path: "/community",
    keywords: ["forum", "community", "Mobile Legends", "MLBB", "teammates"],
  });
}

const sectionTitle = "font-heading text-xl font-bold text-chalk-100 sm:text-2xl";

export default async function CommunityPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const now = await requestTime();
  const data = databaseConfigured()
    ? await Promise.all([categoryStats(), listThreads({ sort: "latest", page: 1 })]).catch(() => null)
    : null;

  return (
    <>
      <PageHeader
        title={t("pages.community.title")}
        lead={t("pages.community.lead")}
        details={{ label: t("pages.community.rules.title"), content: <Rules t={t} /> }}
      >
        <div className="mt-5">
          <SearchForm t={t} locale={locale} />
        </div>
      </PageHeader>
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {!data ? (
          <Unavailable t={t} />
        ) : (
          <>
            <section aria-labelledby="categories-title">
              <h2 id="categories-title" className={sectionTitle}>
                {t("pages.community.categoriesTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.map((c) => {
                  const stats = data[0].get(c);
                  return (
                    <li key={c}>
                      <Link
                        href={`/community/${c}`}
                        className="bevel flex h-full flex-col border border-night-800 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                      >
                        <span className="font-semibold text-chalk-100">{t(`pages.community.categories.${c}.name`)}</span>
                        <span className="mt-1 flex-1 text-sm leading-relaxed text-chalk-400">{t(`pages.community.categories.${c}.description`)}</span>
                        <span className="mt-3 text-xs text-chalk-500">
                          {t("pages.community.threadCount", { n: stats?.threads ?? 0 })}
                          {stats?.lastPostAt && ` · ${ago(locale, stats.lastPostAt, now)}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="latest-title">
              <h2 id="latest-title" className={sectionTitle}>
                {t("pages.community.latestTitle")}
              </h2>
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <div className="mt-5">
                <ThreadList threads={data[1].threads.slice(0, 10)} t={t} locale={locale} now={now} showCategory emptyText={t("pages.community.emptyAll")} />
              </div>
            </section>
          </>
        )}

        <section aria-labelledby="teammates-title" className="grid gap-4 lg:grid-cols-2">
          <div className="bevel border border-night-800 bg-night-900/60 p-5">
            <h2 id="teammates-title" className="flex items-center gap-2 font-heading text-xl font-bold text-chalk-100">
              <Users size={20} aria-hidden className="text-gold-400" />
              {t("pages.community.teammatesTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-chalk-400">{t("pages.community.teammatesLead")}</p>
            <Link
              href="/community/teammates"
              className="bevel-sm mt-4 inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
            >
              {t("pages.community.teammatesCta")}
            </Link>
          </div>
          <DiscordAlternative t={t} text={t("pages.community.discordText")} />
        </section>
      </div>
    </>
  );
}
