import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideBody, GuideCard, GuideTools } from "@/components/guide";
import Link from "@/components/link";
import { AsideBlock } from "@/components/reading-layout";
import { PageHeader } from "@/components/ui";
import { longDate } from "@/lib/freshness";
import { guide, guideHeadings, guides, guideSlugs, readingMinutes, renderGuide, type Guide } from "@/lib/guides";
import { serializeJsonLd } from "@/lib/html";
import type { Locale } from "@/i18n/config";
import { guideData, metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return guideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = guide(slug, locale);
  if (!g) return {};
  return metaPage(locale, {
    title: g.title,
    description: g.summary,
    path: `/guides/${slug}`,
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
  if (!g) notFound();
  const t = createT(locale);
  const minutes = readingMinutes(g.content);
  const headings = guideHeadings(g.content);
  const related = relatedOf(g, locale);
  const path = `/guides/${slug}`;

  const structuredData = guideData(g, {
    path,
    locale,
    minutes,
    section: t(`pages.guides.kind.${g.kind}`),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader
        title={g.title}
        lead={g.summary}
        crumbs={[
          { name: t("pages.guides.title"), href: "/guides" },
          { name: g.short, siblings: guides(locale).map((x) => ({ name: x.short, href: `/guides/${x.slug}` })) },
        ]}
        meta={[
          t(`pages.guides.kind.${g.kind}`),
          t("pages.guides.readingTime", { n: minutes }),
          <time key="updated" dateTime={g.updated}>
            {t("pages.guides.updated", { date: longDate(locale, g.updated) })}
          </time>,
        ]}
      />

      <GuideBody
        guide={g}
        parts={renderGuide(g.content)}
        headings={headings}
        locale={locale}
        aside={
          <>
            {related.length > 0 && (
              <AsideBlock id="guide-related" title={t("pages.guides.related")}>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <GuideCard guide={r} minutes={readingMinutes(r.content)} locale={locale} />
                    </li>
                  ))}
                </ul>
                <Link href="/guides" className="mt-3 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500">
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
