import type { Metadata } from "next";
import Link from "@/components/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { measureWatch, sources, watch } from "@/lib/watch";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { formatShortDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.watch.metaTitle"),
    description: t("pages.watch.metaDescription"),
    share: t("pages.watch.ogDescription"),
    path: "/watch",
  });
}

export default async function WatchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const news = watch();
  const date = (iso: string) => formatShortDate(iso, LOCALE_HTML[locale]);
  const [creditBefore, creditAfter = ""] = t("pages.watch.credit").split("{link}");

  return (
    <>
      <PageHeader
        title={t("pages.watch.title")}
        lead={t("pages.watch.lead")}
      >
        <p className="mt-3 text-sm text-chalk-500">
          {t("pages.watch.lastCollected", { date: date(measureWatch) })}{" "}
          {sources.map((s, i) => (
            <span key={s.slug}>
              {i > 0 && ", "}
              <a href={s.site} rel="noreferrer nofollow" className="text-gold-400 hover:underline">
                {s.name}
              </a>
            </span>
          ))}
        </p>
      </PageHeader>

      <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:py-14">
        {news.length === 0 ? (
          <p className="text-chalk-500">
            {t("pages.watch.none")}
          </p>
        ) : (
          <ul className="space-y-2 sm:space-y-3">
            {news.map((a) => (
              <li key={a.link}>
                <a
                  href={a.link}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className="bevel group flex gap-3 border border-night-700/70 bg-night-900/60 p-3 transition-colors hover:border-gold-500/60 sm:gap-4 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold-400">
                        {a.source}
                      </span>
                      {a.date && (
                        <time dateTime={a.date} className="text-xs text-chalk-500">
                          {date(a.date)}
                        </time>
                      )}
                    </div>
                    <h2 className="mt-1 font-heading font-bold leading-snug text-chalk-100 transition-colors group-hover:text-gold-400 sm:mt-1.5 sm:text-lg">
                      {a.title}
                    </h2>
                    {/*
                      The excerpt is a taste of the post, not the post: two
                      lines on a phone, where twenty of them stacked ran seven
                      screens. The text itself is untouched.
                    */}
                    {a.excerpt && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-chalk-500 sm:mt-2 sm:line-clamp-3 sm:leading-relaxed">
                        {a.excerpt}
                      </p>
                    )}
                  </div>
                  <ExternalLink
                    size={16}
                    aria-hidden
                    className="mt-1 shrink-0 text-chalk-500 transition-colors group-hover:text-gold-400"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 border-t border-night-800 pt-5 text-xs leading-relaxed text-chalk-500">
          {creditBefore}
          <Link href="/patch-notes" className="text-gold-400 hover:underline">
            {t("nav.patchNotes.label")}
          </Link>
          {creditAfter}
        </p>
      </div>
    </>
  );
}
