import type { Metadata } from "next";
import { EditorialPoster, ENTRANCE } from "@/components/editorial-poster";
import { HeroTile } from "@/components/hero-tile";
import Link from "@/components/link";
import { DexSays, type DexPose } from "@/components/mascot";
import { MethodFold } from "@/components/meta/method-fold";
import { NotFoundPage } from "@/components/not-found-page";
import { PageLead } from "@/components/page-lead";
import { patchArt } from "@/components/patch-visuals";
import { ShareImageButton } from "@/components/share-image-button";
import { artOf } from "@/components/tool-art";
import { SectionTitle } from "@/components/ui";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { guideData, metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { heroesBySlug, patchDetails } from "@/lib/data";
import { dateMeasure, longDate } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { hasRecap, type RecapEntry } from "@/lib/patch-recap";
import { recapOf, recapVersions } from "@/lib/patch-recap-server";
import { newestFirst } from "@/lib/patch-version";
import { DAYS_IMPACT, THRESHOLD_IMPACT, formatGap, plural } from "@/lib/trends";
import { cn } from "@/lib/utils";

/**
 * "Bilan du patch": the story of what a patch did to the win rates, told in
 * chapters as the page scrolls (winners, losers, surprises), each one
 * commented by Dex. Only measured facts (`patchRecap`): a hero without a
 * measure on both sides of the patch is left out, and the page says when
 * the sample is small or missing.
 *
 * Rendered at build time for the patches the history covers; any other
 * patch on its first request (it then explains why there is no measure).
 * An analysis slug or an unknown version falls on the 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return recapVersions().map((slug) => ({ slug }));
}

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = recapOf(slug);
  if (!found) return notFoundMetadata(locale);
  const t = createT(locale);
  const v = found.patch.version;
  const measured = hasRecap(found.recap);
  const meta = metaPage(locale, {
    title: t("pages.patchRecap.seoTitle", { v }),
    description: measured
      ? t("pages.patchRecap.description", { v, n: found.recap.measured, days: DAYS_IMPACT })
      : t("pages.patchRecap.descriptionNone", { v }),
    share: t("pages.patchRecap.share", { v }),
    path: `/patch-notes/${slug}/bilan`,
    card: true,
    type: "article",
    published: found.patch.date ?? undefined,
  });
  // Without a measure the page only says so: nothing to index.
  return measured ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function PatchRecapPage({ params }: Params) {
  const { locale, slug } = await params;
  const found = recapOf(slug);
  if (!found) return <NotFoundPage />;
  const { patch, recap, soon } = found;
  const t = createT(locale);
  const intl = LOCALE_INTL[locale];
  const v = patch.version;
  const percent = new Intl.NumberFormat(intl, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rate = (x: number) => percent.format(x / 100);
  const threshold = new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(THRESHOLD_IMPACT);
  const nameOf = (s: string) => heroesBySlug.get(s)?.name ?? patch.adjustments.find((a) => a.slug === s)?.name ?? s;
  const gapLine = (e: RecapEntry) => ({
    hero: nameOf(e.slug),
    gap: formatGap(Math.abs(e.gap), intl).replace(/^\+/, ""),
    unit: t(`trends.point.${plural(e.gap, intl)}`),
  });
  const lead = recap.winners[0] ?? recap.losers[0] ?? recap.surprises[0];
  const art = (lead ? artOf(lead.slug) : null) ?? patchArt(patch)?.art ?? null;
  const notesHref = `/patch-notes/${v}`;

  const tiles = (list: RecapEntry[], tone: (e: RecapEntry) => "ally" | "enemy" | "muted") => (
    <ul className="grid grid-cols-3 gap-2 sm:gap-3">
      {list.map((e) => (
        <li key={e.slug}>
          <HeroTile
            href={heroesBySlug.has(e.slug) ? `/heroes/${e.slug}` : notesHref}
            name={nameOf(e.slug)}
            portrait={heroesBySlug.get(e.slug)?.images.portrait ?? null}
            figure={formatGap(e.gap, intl)}
            label={t("pages.patchRecap.impact", { before: rate(e.before), after: rate(e.after) })}
            tone={tone(e)}
            sizes="(min-width: 1024px) 14rem, 30vw"
          />
        </li>
      ))}
    </ul>
  );
  const toneOf = (e: RecapEntry) => (e.gap > 0 ? "ally" : "enemy");

  const surprise = recap.surprises[0];
  const chapters: {
    key: "winners" | "losers" | "surprises";
    list: RecapEntry[];
    tone: (e: RecapEntry) => "ally" | "enemy" | "muted";
    pose: DexPose;
    dex: string;
    extra?: React.ReactNode;
  }[] = [
    {
      key: "winners",
      list: recap.winners,
      tone: () => "ally",
      pose: recap.winners.length ? "victoire" : "reflexion",
      dex: recap.winners.length ? t("pages.patchRecap.dex.winners", gapLine(recap.winners[0]!)) : t("pages.patchRecap.dex.winnersEmpty"),
    },
    {
      key: "losers",
      list: recap.losers,
      tone: () => "enemy",
      pose: recap.losers.length ? "surpris" : "reflexion",
      dex: recap.losers.length ? t("pages.patchRecap.dex.losers", gapLine(recap.losers[0]!)) : t("pages.patchRecap.dex.losersEmpty"),
    },
    {
      key: "surprises",
      list: recap.surprises,
      tone: toneOf,
      pose: surprise ? "surpris" : "idee",
      dex: surprise
        ? t(surprise.type === "buff" ? "pages.patchRecap.dex.surpriseBuff" : "pages.patchRecap.dex.surpriseNerf", { hero: nameOf(surprise.slug) })
        : t("pages.patchRecap.dex.surprisesEmpty"),
      extra: recap.flat.length > 0 && (
        <div className="mt-10">
          <h3 className="type-subtitle text-chalk-200">{t("pages.patchRecap.surprises.flatTitle")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-chalk-400">{t("pages.patchRecap.surprises.flatLead", { threshold })}</p>
          <div className="mt-4 max-w-2xl">{tiles(recap.flat, () => "muted")}</div>
        </div>
      ),
    },
  ];

  const averages =
    recap.meanBuff !== null && recap.meanNerf !== null
      ? t("pages.patchRecap.averages", { buff: formatGap(recap.meanBuff, intl), nerf: formatGap(recap.meanNerf, intl) })
      : recap.meanBuff !== null
        ? t("pages.patchRecap.averagesBuff", { buff: formatGap(recap.meanBuff, intl) })
        : recap.meanNerf !== null
          ? t("pages.patchRecap.averagesNerf", { nerf: formatGap(recap.meanNerf, intl) })
          : null;

  // A measured recap is an article: dated by its patch, modified with the
  // latest measurement it reads. Without a measure the page is not indexed.
  const structuredData = hasRecap(recap)
    ? guideData(
        {
          title: t("pages.patchRecap.seoTitle", { v }),
          summary: t("pages.patchRecap.description", { v, n: recap.measured, days: DAYS_IMPACT }),
          date: patch.date ?? dateMeasure,
          updated: dateMeasure,
          author: site.author,
          keywords: [],
        },
        { path: `/patch-notes/${slug}/bilan`, locale, section: t("nav.patchNotes.label") },
      )
    : null;

  const facts = [
    t("pages.patchRecap.facts.adjusted", { n: recap.adjusted }),
    t("pages.patchRecap.facts.measured", { n: recap.measured }),
    patch.date ? t("pages.patchRecap.facts.date", { date: longDate(locale, patch.date) }) : null,
  ].filter(Boolean);

  return (
    <>
      {structuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      )}
      <EditorialPoster
        art={art}
        crumbs={[
          { name: t("nav.patchNotes.label"), href: "/patch-notes" },
          { name: `Patch ${v}`, href: notesHref },
          {
            name: t("pages.patchRecap.crumb"),
            // Every recap the history covers, to move from one patch to the next.
            siblings: recapVersions()
              .map((version) => patchDetails[version]!)
              .sort(newestFirst)
              .map((p) => ({ name: `${t("pages.patchRecap.crumb")} ${p.version}`, href: `/patch-notes/${p.version}/bilan` })),
          },
        ]}
      >
        <h1 className="affiche-name">
          <span className="block font-heading text-xl font-bold uppercase text-gold-400 sm:text-2xl">{t("pages.patchRecap.kicker")}</span>{" "}
          <span className="score mt-1 block text-[clamp(5rem,2.5rem+10vw,12rem)]">{v}</span>
        </h1>
        <PageLead lead={t("pages.patchRecap.lead", { days: DAYS_IMPACT })} />
        <ul className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {facts.map((fact, i) => (
            <li key={i} className="bevel-sm bg-night-800/90 px-2 py-1 text-chalk-300">
              {fact}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-start gap-x-4 gap-y-3">
          <ShareImageButton card={{ kind: "recap", version: v }} name="Patch recap" variant="primary" />
          <Link href={notesHref} className="btn btn-secondary">
            {t("pages.patchRecap.back")}
          </Link>
        </div>
      </EditorialPoster>

      <div className={cn("page-wrap pb-14 pt-8 sm:pt-12", ENTRANCE)}>
        {recap.sample === "none" ? (
          <DexSays pose="surpris" className="max-w-3xl">
            <p>{soon ? t("pages.patchRecap.dex.noneSoon") : t("pages.patchRecap.dex.noneOld")}</p>
            <p className="mt-2 text-sm text-chalk-400">
              {soon ? t("pages.patchRecap.sample.noneSoon") : t("pages.patchRecap.sample.noneOld", { days: DAYS_IMPACT })}
            </p>
          </DexSays>
        ) : (
          <>
            <DexSays pose="salut" className="max-w-3xl">
              <p>{t("pages.patchRecap.dex.intro", { v })}</p>
              {recap.sample === "small" && (
                <p className="mt-2 text-sm text-chalk-400">{t("pages.patchRecap.sample.small", { n: recap.measured })}</p>
              )}
              {recap.young && <p className="mt-2 text-sm text-chalk-400">{t("pages.patchRecap.young", { days: DAYS_IMPACT })}</p>}
            </DexSays>

            {chapters.map((c, i) => (
              <div key={c.key}>
                <div aria-hidden className="eclat-rule mt-12 sm:mt-16" />
                <section aria-labelledby={`recap-${c.key}`} className="recap-chapter scroll-mt-24 pt-10 sm:pt-14">
                  <p className="font-heading text-base font-bold uppercase text-gold-400">{t("pages.patchRecap.chapter", { n: i + 1 })}</p>
                  <SectionTitle id={`recap-${c.key}`} lead={t(`pages.patchRecap.${c.key}.lead`)}>
                    {t(`pages.patchRecap.${c.key}.title`)}
                  </SectionTitle>
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
                    <div className="min-w-0 max-w-2xl">
                      {c.list.length > 0 ? (
                        tiles(c.list, c.tone)
                      ) : (
                        <p className="text-chalk-300">{t(`pages.patchRecap.${c.key}.empty`, { threshold })}</p>
                      )}
                    </div>
                    <DexSays pose={c.pose} height={110} side="right">
                      <p>{c.dex}</p>
                    </DexSays>
                  </div>
                  {c.extra}
                </section>
              </div>
            ))}

            <div aria-hidden className="eclat-rule mt-12 sm:mt-16" />
            <section className="recap-chapter pt-10 sm:pt-14">
              {averages && <p className="max-w-3xl text-lg text-chalk-200">{averages}</p>}
              <DexSays pose="idee" className="mt-6 max-w-3xl">
                <p>{t("pages.patchRecap.dex.outro")}</p>
              </DexSays>
            </section>
          </>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="text-chalk-300">{t("pages.patchRecap.notes")}</span>
          <Link href={notesHref} className="btn btn-secondary btn-sm">
            {t("pages.patchRecap.back")}
          </Link>
        </div>

        <MethodFold label={t("pages.patchRecap.method")} className="mt-10">
          <p>{t("pages.patchRecap.methodText", { days: DAYS_IMPACT, threshold })}</p>
        </MethodFold>
      </div>
    </>
  );
}
