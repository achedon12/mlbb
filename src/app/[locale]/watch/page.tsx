import type { Metadata } from "next";
import Link from "@/components/link";
import { ExternalLink } from "lucide-react";
import { ActionLink, PageHeader } from "@/components/ui";
import { ENTRANCE } from "@/components/editorial-poster";
import { Dex } from "@/components/mascot";
import { measureWatch, sources, watch } from "@/lib/watch";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { cn, formatShortDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.watch.metaTitle"),
    description: t("pages.watch.metaDescription"),
    share: t("pages.watch.ogDescription"),
    path: "/watch",
    card: true,
  });
}

export default async function WatchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const news = watch();
  const date = (iso: string) => formatShortDate(iso, LOCALE_INTL[locale]);
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

      <div className={`page-wrap pb-10 pt-8 sm:py-14 ${ENTRANCE}`}>
        {news.length === 0 ? (
          // Nothing collected: Dex says so, and why, rather than a blank page.
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-6">
            <Dex pose="dodo" height={190} />
            <div className="dex-bubble max-w-xl sm:mb-8">
              <p className="leading-relaxed text-chalk-200 sm:text-lg">{t("pages.watch.none")}</p>
              <p className="mt-4">
                <ActionLink href="/news">{t("pages.news.all")}</ActionLink>
              </p>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {news.map((a, i) => (
              <li key={a.link} className={i === 0 ? "lg:col-span-2 2xl:col-span-3" : undefined}>
                <a
                  href={a.link}
                  rel="noreferrer nofollow"
                  target="_blank"
                  className="group card-link flex h-full gap-4 p-4 sm:p-6"
                >
                  {/* The source as a crest: the publisher is what tells two entries apart. */}
                  <span
                    aria-hidden
                    className={cn(
                      "bevel display-caps grid shrink-0 place-items-center bg-night-800 text-gold-400 transition-colors group-hover:bg-gold-400 group-hover:text-night-950",
                      i === 0 ? "size-16 text-3xl sm:size-24 sm:text-5xl" : "size-12 text-2xl",
                    )}
                  >
                    {a.source.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1 break-words">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-heading font-bold uppercase text-gold-400">{a.source}</span>
                      {a.date && (
                        <time dateTime={a.date} className="text-chalk-400">
                          {date(a.date)}
                        </time>
                      )}
                    </div>
                    <h2
                      className={cn(
                        "display-caps mt-2 text-balance text-chalk-100 transition-colors group-hover:text-gold-300",
                        i === 0 ? "text-[clamp(2rem,1.4rem+2vw,3.25rem)]" : "text-[1.6rem] sm:text-[1.85rem]",
                      )}
                    >
                      {a.title}
                    </h2>
                    {/*
                      The excerpt is a taste of the post, not the post: two
                      lines on a phone, where twenty of them stacked ran seven
                      screens. The text itself is untouched.
                    */}
                    {a.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm leading-snug text-chalk-400 sm:line-clamp-3 sm:leading-relaxed">
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

        <p className="mt-12 max-w-3xl border-t border-night-800 pt-5 text-xs leading-relaxed text-chalk-500">
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
