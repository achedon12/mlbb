import type { Metadata } from "next";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "@/components/link";
import { BalanceSummary, HeroChips, StatusBadge, TestNotice, VersionDate } from "@/components/advance-changes";
import { advanceArt } from "@/components/patch-visuals";
import { WikiCredit } from "@/components/wiki-credit";
import { SectionTitle } from "@/components/ui";
import { EditorialPoster, ENTRANCE } from "@/components/editorial-poster";
import { PageLead } from "@/components/page-lead";
import { DexSays } from "@/components/mascot";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { advanceArchive, advanceSource, advanceSyncedAt, advanceVersions, isUnderTest } from "@/lib/advance-server";
import { longDate, patchCurrent } from "@/lib/freshness";
import { advanceDocumented } from "@/lib/advance-fresh";

type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/patch-notes/advance-server";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  const latest = advanceVersions(locale)[0];
  // The wiki no longer documents the test server: the hub stays reachable as
  // an archive, out of the index and the sitemap, until a source resumes.
  const archived = !advanceDocumented();
  const meta = metaPage(locale, {
    title: latest
      ? t(archived ? "pages.advanceServer.archived.seoTitle" : "pages.advanceServer.seo.titleHub", { v: latest.version })
      : t("pages.advanceServer.seo.titleGeneric"),
    // The latest version, its date and its hero counts open the description.
    description: latest && archived
      ? t("pages.advanceServer.archived.seoDescription", { version: latest.version })
      : latest
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
  return archived ? { ...meta, robots: { index: false, follow: true } } : meta;
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
  const art = latest ? advanceArt(latest.heroes) : null;
  const archived = !advanceDocumented();

  return (
    <>
      <EditorialPoster
        art={art}
        crumbs={[{ name: t("nav.patchNotes.label"), href: "/patch-notes" }, { name: t("pages.advanceServer.crumb") }]}
        aside={<p className="text-sm text-chalk-400 lg:text-right">{t("pages.advanceServer.syncedAt", { date: longDate(locale, advanceSyncedAt) })}</p>}
      >
        <h1 className="display-caps max-w-4xl text-balance text-[clamp(2.4rem,1.6rem+2.8vw,4.25rem)] text-chalk-100">
          {t(archived ? "pages.advanceServer.archived.title" : "pages.advanceServer.title")}
        </h1>
        <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
        <PageLead
          lead={
            archived && latest ? t("pages.advanceServer.archived.lead", { v: latest.version }) : t("pages.advanceServer.lead")
          }
        />
        {latest && (
          <>
            <Link href={`${PATH}/${latest.version}`} className="group mt-8 block w-fit max-w-full">
              <span className="flex flex-wrap items-center gap-3 font-heading text-base font-bold uppercase text-gold-400">
                {t(archived ? "pages.advanceServer.archived.latest" : "pages.advanceServer.latest")}
                <StatusBadge underTest={latestUnderTest} live={live} t={t} />
              </span>
              <span className="affiche-name score mt-2 block text-[clamp(5.5rem,3rem+9vw,11rem)] transition-colors group-hover:text-gold-300">
                {latest.version}
              </span>
            </Link>
            <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-5">
              <BalanceSummary balance={latest.balance} t={t} size="lg" />
              <Link href={`${PATH}/${latest.version}`} className="btn btn-primary">
                {t("pages.advanceServer.readAll", { v: latest.version })}
                <ArrowRight size={17} aria-hidden />
              </Link>
              {archived && (
                <Link href={`/patch-notes/${live}`} className="btn btn-secondary">
                  {t("pages.advanceServer.archived.current", { v: live })}
                </Link>
              )}
            </div>
          </>
        )}
      </EditorialPoster>

      <div className={cn("page-wrap space-y-14 pb-12 pt-10 sm:space-y-20 sm:pt-14", ENTRANCE)}>
        <div className="max-w-3xl">
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
        </div>

        {!latest && (
          <DexSays pose="dodo" height={130}>
            <p className="text-chalk-200">{t("pages.advanceServer.empty")}</p>
          </DexSays>
        )}

        {latest && (
          <section aria-labelledby="advance-latest">
            <SectionTitle id="advance-latest" lead={latest.summary || undefined}>
              {t("pages.advanceServer.heading", { v: latest.version })}
            </SectionTitle>
            <p className="-mt-2 mb-6 text-sm text-chalk-400 sm:-mt-4">
              <VersionDate version={latest} locale={locale} t={t} />
            </p>
            {latest.heroes.length > 0 && <HeroChips heroes={latest.heroes} t={t} headingLevel={3} />}
          </section>
        )}

        {versions.length > 0 && (
          <section aria-labelledby="advance-versions">
            <SectionTitle id="advance-versions" lead={t("pages.advanceServer.versionsIntro", { n: versions.length })}>
              {t("pages.advanceServer.versions")}
            </SectionTitle>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
              {versions.map((v) => {
                const testing = isUnderTest(v.version, live);
                return (
                  <li key={v.version}>
                    <Link
                      href={`${PATH}/${v.version}`}
                      className={cn("group card-link flex h-full min-h-36 flex-col justify-end p-4 sm:p-5", testing && "eclat-under is-active")}
                    >
                      {testing && (
                        <span className="mb-2">
                          <StatusBadge underTest live={live} t={t} />
                        </span>
                      )}
                      <span className="text-xs text-chalk-400">
                        <VersionDate version={v} locale={locale} t={t} />
                      </span>
                      <span
                        className={cn(
                          "display-caps mt-1 block text-[2.6rem] transition-colors sm:text-5xl",
                          testing ? "text-gold-400" : "text-chalk-100 group-hover:text-gold-300",
                        )}
                      >
                        {v.version}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-x-3 font-heading text-sm font-bold">
                        <span className="text-chalk-300">{heroCount(v.heroes.length)}</span>
                        {v.balance.buff > 0 && (
                          <span className="text-azure-400">
                            <span aria-hidden>▲ </span>
                            {v.balance.buff}
                            <span className="sr-only"> {t("patchHeroes.plural.buff")}</span>
                          </span>
                        )}
                        {v.balance.nerf > 0 && (
                          <span className="text-blood-400">
                            <span aria-hidden>▼ </span>
                            {v.balance.nerf}
                            <span className="sr-only"> {t("patchHeroes.plural.nerf")}</span>
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {advanceArchive.length > 0 && (
          <section aria-labelledby="advance-archive">
            <SectionTitle id="advance-archive" lead={t("pages.advanceServer.archiveIntro", { n: advanceArchive.length })}>
              {t("pages.advanceServer.archive")}
            </SectionTitle>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {advanceArchive.map((a) => (
                <li key={a.title}>
                  <a
                    href={a.url}
                    rel="noreferrer nofollow"
                    target="_blank"
                    className="bevel-sm group flex items-center justify-between gap-2 bg-night-900 px-3 py-2 transition-colors hover:bg-night-800"
                  >
                    <span className="display-caps text-xl text-chalk-300 transition-colors group-hover:text-gold-400">
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
