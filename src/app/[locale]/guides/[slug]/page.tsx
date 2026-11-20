import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumb } from "@/components/breadcrumb";
import { GuideBody, GuideCard, GuideTools, guideArt } from "@/components/guide";
import Link from "@/components/link";
import { AsideBlock } from "@/components/reading-layout";
import { imageLane } from "@/lib/emblems";
import { longDate } from "@/lib/freshness";
import { guide, guideHeadings, guides, guideSlugs, readingMinutes, renderGuide, type Guide } from "@/lib/guides";
import { serializeJsonLd } from "@/lib/html";
import type { Locale } from "@/i18n/config";
import { guideData, metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return guideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = guide(slug, locale);
  if (!g) return notFoundMetadata(locale);
  return metaPage(locale, {
    title: g.title,
    description: g.summary,
    path: `/guides/${slug}`,
    card: true,
    type: "article",
    keywords: g.keywords,
    published: g.date,
    author: g.author,
  });
}

/** Guides offered at the end: the ones the guide names, else others of its kind. */
function relatedOf(g: Guide, locale: Locale): Guide[] {
  const all = guides(locale).filter((x) => x.slug !== g.slug);
  const named = g.related.flatMap((slug) => all.filter((x) => x.slug === slug));
  return (named.length > 0 ? named : all.filter((x) => x.kind === g.kind)).slice(0, 3);
}

export default async function GuidePage({ params }: Params) {
  const { locale, slug } = await params;
  const g = guide(slug, locale);
  if (!g) return <NotFoundPage />;
  const t = createT(locale);
  const minutes = readingMinutes(g.content);
  const headings = guideHeadings(g.content);
  const related = relatedOf(g, locale);
  const path = `/guides/${slug}`;
  const art = guideArt(g);
  const lane = g.lane ? imageLane(g.lane) : undefined;

  const structuredData = guideData(g, {
    path,
    locale,
    minutes,
    section: t(`pages.guides.kind.${g.kind}`),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      {/*
        The guide opens as an article's lead picture: the artwork of a hero
        who plays what it teaches, across the page, night closing in from the
        foot where the title sits. The frame has its height before the image
        arrives: nothing moves.
      */}
      <section aria-labelledby="guide-title" className="relative isolate overflow-hidden">
        <div aria-hidden className="relative h-[19rem] sm:h-[26rem] lg:h-[32rem]">
          {art && (
            <Image src={art} alt="" fill priority sizes="100vw" className="affiche-art object-cover object-[60%_24%]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-4/5 bg-linear-to-t from-night-950 via-night-950/75 to-transparent" />
          <div className="absolute inset-y-0 left-0 hidden w-3/5 bg-linear-to-r from-night-950/85 to-transparent lg:block" />
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-night-950/70 to-transparent" />
        </div>
        <div className="page-wrap absolute inset-x-0 top-0 pt-3 sm:pt-5">
          <Breadcrumb
            crumbs={[
              { name: t("pages.guides.title"), href: "/guides" },
              { name: g.short, siblings: guides(locale).map((x) => ({ name: x.short, href: `/guides/${x.slug}` })) },
            ]}
            className="[&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs"
          />
        </div>
        <div className="page-wrap relative -mt-40 pb-8 sm:-mt-52 sm:pb-10 lg:-mt-64">
          <p className="flex items-center gap-2.5 font-heading text-lg font-bold uppercase text-gold-400">
            {lane && <Image src={lane} alt="" width={28} height={28} className="size-7 object-contain" />}
            {t(`pages.guides.kind.${g.kind}`)}
          </p>
          <h1 id="guide-title" className="affiche-name display-caps mt-2 max-w-5xl break-words text-[clamp(2.4rem,1.3rem+4.2vw,5.5rem)] leading-[0.92] text-chalk-100">
            {g.title}
          </h1>
          <div aria-hidden className="eclat mt-5 h-[3px] w-28" />
          <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-chalk-300">
            <li className="flex items-baseline gap-1.5">
              <span aria-hidden className="score score-outline text-3xl">{minutes}</span>
              <span aria-hidden>{t("pages.guides.readingTime", { n: minutes }).replace(String(minutes), "").trim()}</span>
              <span className="sr-only">{t("pages.guides.readingTime", { n: minutes })}</span>
            </li>
            <li>
              <time dateTime={g.updated}>{t("pages.guides.updated", { date: longDate(locale, g.updated) })}</time>
            </li>
          </ul>
        </div>
        <div aria-hidden className="eclat-rule" />
      </section>

      <GuideBody
        guide={g}
        parts={renderGuide(g.content)}
        headings={headings}
        locale={locale}
        aside={
          <>
            {related.length > 0 && (
              <AsideBlock id="guide-related" title={t("pages.guides.related")}>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <GuideCard guide={r} minutes={readingMinutes(r.content)} locale={locale} compact />
                    </li>
                  ))}
                </ul>
                <Link
                  href="/guides"
                  className="mt-4 inline-flex font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
                >
                  {t("pages.guides.all")} →
                </Link>
              </AsideBlock>
            )}
            <GuideTools tools={g.tools} locale={locale} />
          </>
        }
      />
    </>
  );
}
