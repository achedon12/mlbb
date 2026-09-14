import type { Metadata } from "next";
import Link from "@/components/link";
import { ExternalLink, FileText } from "lucide-react";
import { ListArticles } from "@/components/article";
import { PageHeader } from "@/components/ui";
import { patches, patchDetails, sync } from "@/lib/data";
import { articles } from "@/lib/content";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { formatShortDate } from "@/lib/utils";
import { countAdjustments, longDate, patchCurrent } from "@/lib/freshness";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  // Le dernier patch, sa date et ses ajustements ouvrent la description.
  const version = patchCurrent.date
    ? `${patchCurrent.version} (${longDate(locale, patchCurrent.date)})`
    : patchCurrent.version;
  return metaPage(locale, {
    title: t("pages.seo.patchNotes.title", { v: patchCurrent.version }),
    description: patchCurrent.adjustments.length
      ? t("pages.seo.patchNotes.description", {
          version,
          ...countAdjustments(patchCurrent.adjustments),
          m: Object.keys(patchDetails).length,
          n: patches.length,
        })
      : t("pages.patchNotes.metaDescription", { n: patches.length }),
    share: t("pages.patchNotes.ogDescription", { n: patches.length }),
    path: "/patch-notes",
  });
}

const detailed = patchDetails as Record<string, { version: string }>;

export default async function PatchNotesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const analyses = articles("patch-notes", locale);
  const withDetail = patches.filter((p) => detailed[p.version]);
  const others = patches.filter((p) => !detailed[p.version]).slice(0, 60);

  return (
    <>
      <PageHeader
        title={t("pages.patchNotes.title")}
        lead={t("pages.patchNotes.lead")}
      >
        <p className="mt-6 text-sm text-chalk-500">
          {t("pages.patchNotes.listed", { n: patches.length, m: withDetail.length })}{" "}
          <time dateTime={sync.date}>{formatShortDate(sync.date, LOCALE_HTML[locale])}</time>
        </p>
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-12">
        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.patchNotes.recent")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {withDetail.map((p) => (
              <li key={p.title}>
                <Link
                  href={`/patch-notes/${p.version}`}
                  className="bevel group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                >
                  <FileText size={18} aria-hidden className="shrink-0 text-gold-400" />
                  <span className="font-heading text-lg font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                    {p.version}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {analyses.length > 0 && (
          <section>
            <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.patchNotes.analyses")}</h2>
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
            <p className="mt-3 text-sm text-chalk-500">
              {t("pages.patchNotes.analysesIntro")}
            </p>
            <div className="mt-6">
              <ListArticles articles={analyses} base="/patch-notes" locale={locale} />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.patchNotes.archives")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-3 text-sm text-chalk-500">
            {t("pages.patchNotes.older")}
          </p>

          <ul className="mt-6 grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {others.map((p) => (
              // Le titre est unique ; la version ne l'est pas toujours.
              <li key={p.title}>
                <a
                  href={p.link}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className="bevel-sm group flex items-center justify-between gap-2 border border-night-700/70 px-3 py-2 text-sm transition-colors hover:border-gold-500/60"
                >
                  <span className="tabular-nums text-chalk-300 transition-colors group-hover:text-gold-400">
                    {p.version}
                  </span>
                  <ExternalLink size={12} aria-hidden className="shrink-0 text-chalk-500" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
