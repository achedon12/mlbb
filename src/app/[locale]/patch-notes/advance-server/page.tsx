import type { Metadata } from "next";
import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import Link from "@/components/link";
import { BalanceSummary, HeroChips, StatusBadge, TestNotice, VersionDate } from "@/components/advance-changes";
import { WikiCredit } from "@/components/wiki-credit";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { advanceArchive, advanceSource, advanceSyncedAt, advanceVersions, isUnderTest } from "@/lib/advance-server";
import { longDate, patchCurrent } from "@/lib/freshness";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/patch-notes/advance-server";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  const latest = advanceVersions(locale)[0];
  return metaPage(locale, {
    title: latest
      ? t("pages.advanceServer.seo.title", { v: latest.version })
      : t("pages.advanceServer.seo.titleGeneric"),
    // The latest version, its date and its hero counts open the description.
    description: latest
      ? t("pages.advanceServer.seo.description", {
          version: latest.date ? `${latest.version} (${longDate(locale, latest.date)})` : latest.version,
          buffs: latest.balance.buff,
          nerfs: latest.balance.nerf,
          adjust: latest.balance.adjust,
        })
      : t("pages.advanceServer.lead"),
    share: t("pages.advanceServer.seo.share"),
    path: PATH,
    keywords: t("pages.advanceServer.seo.keywords")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  });
}

export default async function AdvanceServerPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const versions = advanceVersions(locale);
  const latest = versions.at(0);
  const live = patchCurrent.version;
  const latestUnderTest = latest ? isUnderTest(latest.version, live) : false;
  const heroCount = (n: number) =>
    t(`pages.advanceServer.heroCount.${new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other"}`, { n });
  const title2 = "font-heading text-2xl font-bold text-chalk-100";

  return (
    <>
      <PageHeader
        title={t("pages.advanceServer.title")}
        lead={t("pages.advanceServer.lead")}
        crumbs={[{ name: t("nav.patchNotes.label"), href: "/patch-notes" }, { name: t("pages.advanceServer.crumb") }]}
      >
        <p className="mt-6 text-sm text-chalk-500">
          {t("pages.advanceServer.syncedAt", { date: longDate(locale, advanceSyncedAt) })}
        </p>
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <TestNotice t={t}>
          {latest && (
            <p className="mt-2">
              {latestUnderTest
                ? t("pages.advanceServer.statusUnderTest", { v: latest.version, live })
                : latest.date
                  ? t("pages.advanceServer.statusNone", { live, v: latest.version, date: longDate(locale, latest.date) })
                  : t("pages.advanceServer.statusNoneUndated", { live, v: latest.version })}
            </p>
          )}
        </TestNotice>

        {!latest && <p className="text-chalk-300">{t("pages.advanceServer.empty")}</p>}

        {latest && (
          <section aria-labelledby="advance-latest">
            <h2 id="advance-latest" className={title2}>
              {t("pages.advanceServer.latest")}
            </h2>
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

            <div className="bevel mt-6 border border-night-700/70 bg-night-900/60 p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.advanceServer.heading", { v: latest.version })}
                </h3>
                <StatusBadge underTest={latestUnderTest} live={live} t={t} />
              </div>
              <p className="mt-1 text-sm text-chalk-500">
                <VersionDate version={latest} locale={locale} t={t} />
              </p>
              {latest.summary && <p className="mt-3 text-sm leading-relaxed text-chalk-300">{latest.summary}</p>}
              <div className="mt-4">
                <BalanceSummary balance={latest.balance} t={t} />
              </div>
              {latest.heroes.length > 0 && (
                <div className="mt-5">
                  <HeroChips heroes={latest.heroes} t={t} headingLevel={4} />
                </div>
              )}
              <Link
                href={`${PATH}/${latest.version}`}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-500"
              >
                {t("pages.advanceServer.readAll", { v: latest.version })}
                <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </section>
        )}

        {versions.length > 0 && (
          <section aria-labelledby="advance-versions">
            <h2 id="advance-versions" className={title2}>
              {t("pages.advanceServer.versions")}
            </h2>
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-chalk-500">
              {t("pages.advanceServer.versionsIntro", { n: versions.length })}
            </p>

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {versions.map((v) => (
                <li key={v.version}>
                  <Link
                    href={`${PATH}/${v.version}`}
                    className="bevel group flex h-full flex-col gap-1 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <FileText size={18} aria-hidden className="shrink-0 text-gold-400" />
                      <span className="font-heading text-lg font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                        {v.version}
                      </span>
                      {isUnderTest(v.version, live) && <StatusBadge underTest live={live} t={t} />}
                    </span>
                    <span className="text-xs text-chalk-500">
                      <VersionDate version={v} locale={locale} t={t} /> · {heroCount(v.heroes.length)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {advanceArchive.length > 0 && (
          <section aria-labelledby="advance-archive">
            <h2 id="advance-archive" className={title2}>
              {t("pages.advanceServer.archive")}
            </h2>
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-chalk-500">
              {t("pages.advanceServer.archiveIntro", { n: advanceArchive.length })}
            </p>

            <ul className="mt-6 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {advanceArchive.map((a) => (
                <li key={a.title}>
                  <a
                    href={a.url}
                    rel="noreferrer nofollow"
                    target="_blank"
                    className="bevel-sm group flex items-center justify-between gap-2 border border-night-700/70 px-3 py-2 text-sm transition-colors hover:border-gold-500/60"
                  >
                    <span className="tabular-nums text-chalk-300 transition-colors group-hover:text-gold-400">
                      {a.version}
                    </span>
                    <ExternalLink size={12} aria-hidden className="shrink-0 text-chalk-500" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <WikiCredit
          t={t}
          href={advanceSource}
          messageKey="pages.advanceServer.credit"
          className="border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500"
        />
      </div>
    </>
  );
}
