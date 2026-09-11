import type { Metadata } from "next";
import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import Link from "@/components/lien";
import { BalanceSummary, HeroChips, StatusBadge, TestNotice, VersionDate } from "@/components/advance-changes";
import { CreditWiki } from "@/components/credit-wiki";
import { EnTetePage } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { advanceArchive, advanceSource, advanceSyncedAt, advanceVersions, isUnderTest } from "@/lib/advance-server";
import { dateLongue, patchActuel } from "@/lib/fraicheur";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/patch-notes/advance-server";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  const latest = advanceVersions(locale)[0];
  return metaPage(locale, {
    titre: latest
      ? t("pages.advanceServer.seo.title", { v: latest.version })
      : t("pages.advanceServer.seo.titleGeneric"),
    // The latest version, its date and its hero counts open the description.
    description: latest
      ? t("pages.advanceServer.seo.description", {
          version: latest.date ? `${latest.version} (${dateLongue(locale, latest.date)})` : latest.version,
          buffs: latest.balance.buff,
          nerfs: latest.balance.nerf,
          adjust: latest.balance.adjust,
        })
      : t("pages.advanceServer.lead"),
    partage: t("pages.advanceServer.seo.share"),
    chemin: PATH,
    motsCles: t("pages.advanceServer.seo.keywords")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  });
}

export default async function AdvanceServerPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const versions = advanceVersions(locale);
  const latest = versions.at(0);
  const live = patchActuel.version;
  const latestUnderTest = latest ? isUnderTest(latest.version, live) : false;
  const heroCount = (n: number) =>
    t(`pages.advanceServer.heroCount.${new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other"}`, { n });
  const title2 = "font-titre text-2xl font-bold text-craie-100";

  return (
    <>
      <EnTetePage
        titre={t("pages.advanceServer.title")}
        chapeau={t("pages.advanceServer.lead")}
        miettes={[{ nom: t("nav.patchNotes.label"), href: "/patch-notes" }, { nom: t("pages.advanceServer.crumb") }]}
      >
        <p className="mt-6 text-sm text-craie-500">
          {t("pages.advanceServer.syncedAt", { date: dateLongue(locale, advanceSyncedAt) })}
        </p>
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <TestNotice t={t}>
          {latest && (
            <p className="mt-2">
              {latestUnderTest
                ? t("pages.advanceServer.statusUnderTest", { v: latest.version, live })
                : latest.date
                  ? t("pages.advanceServer.statusNone", { live, v: latest.version, date: dateLongue(locale, latest.date) })
                  : t("pages.advanceServer.statusNoneUndated", { live, v: latest.version })}
            </p>
          )}
        </TestNotice>

        {!latest && <p className="text-craie-300">{t("pages.advanceServer.empty")}</p>}

        {latest && (
          <section aria-labelledby="advance-latest">
            <h2 id="advance-latest" className={title2}>
              {t("pages.advanceServer.latest")}
            </h2>
            <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

            <div className="biseau mt-6 border border-nuit-700/70 bg-nuit-900/60 p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="font-titre text-2xl font-bold text-craie-100">
                  {t("pages.advanceServer.heading", { v: latest.version })}
                </h3>
                <StatusBadge underTest={latestUnderTest} live={live} t={t} />
              </div>
              <p className="mt-1 text-sm text-craie-500">
                <VersionDate version={latest} locale={locale} t={t} />
              </p>
              {latest.summary && <p className="mt-3 text-sm leading-relaxed text-craie-300">{latest.summary}</p>}
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
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-or-400 hover:text-or-500"
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
            <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-craie-500">
              {t("pages.advanceServer.versionsIntro", { n: versions.length })}
            </p>

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {versions.map((v) => (
                <li key={v.version}>
                  <Link
                    href={`${PATH}/${v.version}`}
                    className="biseau group flex h-full flex-col gap-1 border border-nuit-700/70 bg-nuit-900/60 p-4 transition-colors hover:border-or-500/60"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <FileText size={18} aria-hidden className="shrink-0 text-or-400" />
                      <span className="font-titre text-lg font-bold text-craie-100 transition-colors group-hover:text-or-400">
                        {v.version}
                      </span>
                      {isUnderTest(v.version, live) && <StatusBadge underTest live={live} t={t} />}
                    </span>
                    <span className="text-xs text-craie-500">
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
            <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-craie-500">
              {t("pages.advanceServer.archiveIntro", { n: advanceArchive.length })}
            </p>

            <ul className="mt-6 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {advanceArchive.map((a) => (
                <li key={a.title}>
                  <a
                    href={a.url}
                    rel="noreferrer nofollow"
                    target="_blank"
                    className="biseau-sm group flex items-center justify-between gap-2 border border-nuit-700/70 px-3 py-2 text-sm transition-colors hover:border-or-500/60"
                  >
                    <span className="tabular-nums text-craie-300 transition-colors group-hover:text-or-400">
                      {a.version}
                    </span>
                    <ExternalLink size={12} aria-hidden className="shrink-0 text-craie-500" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <CreditWiki
          t={t}
          href={advanceSource}
          cle="pages.advanceServer.credit"
          className="border-t border-nuit-800 pt-6 text-xs leading-relaxed text-craie-500"
        />
      </div>
    </>
  );
}
