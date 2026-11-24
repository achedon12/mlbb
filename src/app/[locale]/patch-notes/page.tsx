import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/link";
import { ArrowRight, ExternalLink, FlaskConical, TrendingUp } from "lucide-react";
import { ListArticles } from "@/components/article";
import { EditorialPoster, ENTRANCE } from "@/components/editorial-poster";
import { Foldable } from "@/components/foldable";
import { PageLead } from "@/components/page-lead";
import { BalanceFigures, balanceOf, patchArt } from "@/components/patch-visuals";
import { SectionTitle } from "@/components/ui";
import { PageSourcesBlock } from "@/components/page-sources";
import { heroesBySlug, patches, patchDetails, sync } from "@/lib/data";
import { articles } from "@/lib/content";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import { advanceDocumented } from "@/lib/advance-fresh";
import { cn, formatShortDate } from "@/lib/utils";
import { countAdjustments, longDate, patchCurrent } from "@/lib/freshness";
import type { DetailedPatch } from "@/lib/types";
import { recapVersions } from "@/lib/patch-recap-server";
import { newestFirst } from "@/lib/patch-version";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  // The latest patch, its date and its adjustments open the description.
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
    card: true,
  });
}

const detailed = patchDetails as Record<string, DetailedPatch>;

/**
 * Patch notes hub. The live patch is the poster: its number set huge over the
 * artwork of its new hero (or of its first buffed hero), its balance in blue
 * and red under it. The other detailed patches follow as tiles, each with
 * the portrait of the hero it is shown with; the analyses as artwork cards;
 * the archive, a hundred and fifty version numbers, stays folded.
 */
export default async function PatchNotesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  const analyses = articles("patch-notes", locale);
  const withDetail = patches.filter((p) => detailed[p.version]);
  const others = patches.filter((p) => !detailed[p.version]).slice(0, 60);
  const live = detailed[patchCurrent.version] ?? patchCurrent;
  // The newest patch the rate history measures: its recap ("bilan").
  const recap = recapVersions()
    .map((v) => patchDetails[v]!)
    .sort(newestFirst)[0];
  const art = patchArt(live);
  // One hero per tile: the same buffed hero would otherwise open half the list.
  const shown = new Set<string>();

  return (
    <>
      <EditorialPoster
        art={art?.art ?? null}
        crumbs={[{ name: t("pages.patchNotes.title") }]}
        aside={
          <p className="text-sm text-chalk-400 lg:max-w-64 lg:text-right">
            {t("pages.patchNotes.listed", { n: patches.length, m: withDetail.length })}{" "}
            <time dateTime={sync.date}>{formatShortDate(sync.date, LOCALE_INTL[locale])}</time>
          </p>
        }
      >
        <h1 className="display-caps text-[clamp(2.4rem,1.7rem+2.6vw,4rem)] text-chalk-100">{t("pages.patchNotes.title")}</h1>
        <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
        <PageLead lead={t("pages.patchNotes.lead")} />

        <Link href={`/patch-notes/${live.version}`} className="group mt-8 block w-fit max-w-full sm:mt-10">
          <span className="block font-heading text-base font-bold uppercase text-gold-400">
            {live.date ? t("home.rail.patchSince", { date: longDate(locale, live.date) }) : t("home.rail.patch")}
          </span>
          <span className="affiche-name score mt-2 block text-[clamp(6rem,3rem+11vw,13rem)] transition-colors group-hover:text-gold-300">
            {live.version}
          </span>
        </Link>
        <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-5">
          <BalanceFigures balance={balanceOf(live)} t={t} size="lg" />
          <div className="flex flex-wrap gap-2">
            <Link href={`/patch-notes/${live.version}`} className="btn btn-primary">
              {t("home.readNotes")}
              <ArrowRight size={17} aria-hidden />
            </Link>
            {recap && (
              <Link href={`/patch-notes/${recap.version}/bilan`} className="btn btn-secondary">
                <TrendingUp size={16} aria-hidden />
                {t("pages.patchRecap.linkVersion", { v: recap.version })}
              </Link>
            )}
            {advanceDocumented() && (
              <Link href="/patch-notes/advance-server" className="btn btn-secondary">
                <FlaskConical size={16} aria-hidden />
                {t("nav.advanceServer.label")}
              </Link>
            )}
          </div>
        </div>
      </EditorialPoster>

      <div className={cn("page-wrap space-y-12 pb-12 pt-10 sm:space-y-20 sm:pt-14", ENTRANCE)}>
        <section aria-labelledby="patch-recent">
          <SectionTitle id="patch-recent">{t("pages.patchNotes.recent")}</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
            {withDetail.map((p) => (
              <li key={p.title}>
                <PatchTile patch={detailed[p.version]} locale={locale} current={p.version === live.version} avoid={shown} />
              </li>
            ))}
          </ul>
        </section>

        {analyses.length > 0 && (
          <section aria-labelledby="patch-analyses">
            <SectionTitle id="patch-analyses" lead={t("pages.patchNotes.analysesIntro")}>
              {t("pages.patchNotes.analyses")}
            </SectionTitle>
            <ListArticles articles={analyses} base="/patch-notes" locale={locale} />
          </section>
        )}

        <section aria-labelledby="patch-archives">
          <SectionTitle id="patch-archives" lead={t("pages.patchNotes.older")}>
            {t("pages.patchNotes.archives")}
          </SectionTitle>

          {/*
            A hundred and fifty version numbers linking to the wiki is three
            screens of a phone at the end of the page: they stay in the
            document, behind the sentence that says what they are.
          */}
          <Foldable label={t("pages.patchNotes.openArchives", { n: others.length })}>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
              {others.map((p) => (
                // The title is unique; the version is not always.
                <li key={p.title}>
                  <a
                    href={p.link}
                    rel="noreferrer nofollow"
                    target="_blank"
                    className="bevel-sm group flex items-center justify-between gap-2 bg-night-900 px-3 py-2 transition-colors hover:bg-night-800"
                  >
                    <span className="display-caps text-xl text-chalk-300 transition-colors group-hover:text-gold-400">
                      {p.version}
                    </span>
                    <ExternalLink size={12} aria-hidden className="shrink-0 text-chalk-500" />
                  </a>
                </li>
              ))}
            </ul>
          </Foldable>
        </section>

        <PageSourcesBlock locale={locale} of={{ kind: "patches" }} className="mt-0" />
      </div>
    </>
  );
}

/**
 * A detailed patch as a tile: the portrait of the hero it is shown with, its
 * number in the display face, its balance in blue and red. The live patch is
 * gold.
 */
function PatchTile({ patch, locale, current, avoid }: { patch: DetailedPatch; locale: Locale; current: boolean; avoid: Set<string> }) {
  const t = createT(locale);
  const hero = patchArt(patch, avoid);
  const portrait = hero ? (heroesBySlug.get(hero.slug)?.images.portrait ?? null) : null;
  const b = balanceOf(patch);
  return (
    <Link
      href={`/patch-notes/${patch.version}`}
      className={cn("group card-link relative flex h-full min-h-40 flex-col justify-end overflow-hidden p-4 sm:min-h-48 sm:p-5", current && "eclat-under is-active")}
    >
      {portrait && (
        <span aria-hidden className="absolute inset-y-0 right-0 w-3/5">
          <Image
            src={portrait}
            alt=""
            fill
            sizes="(min-width: 1024px) 12vw, 30vw"
            className="object-cover object-top opacity-70 transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.03] group-hover:opacity-80"
          />
          <span className="absolute inset-0 bg-linear-to-r from-night-900 via-night-900/60 to-transparent" />
        </span>
      )}
      <span className="relative">
        {patch.date && (
          <time dateTime={patch.date} className="block text-xs text-chalk-400">
            {formatShortDate(patch.date, LOCALE_INTL[locale])}
          </time>
        )}
        <span
          className={cn(
            "display-caps mt-1 block text-[2.6rem] transition-colors sm:text-5xl",
            current ? "text-gold-400" : "text-chalk-100 group-hover:text-gold-300",
          )}
        >
          {patch.version}
        </span>
        <span className="mt-2 flex gap-3 font-heading text-sm font-bold">
          {b.buff > 0 && (
            <span className="text-azure-400">
              <span aria-hidden>▲ </span>{b.buff}
              <span className="sr-only"> {t("patchHeroes.plural.buff")}</span>
            </span>
          )}
          {b.nerf > 0 && (
            <span className="text-blood-400">
              <span aria-hidden>▼ </span>{b.nerf}
              <span className="sr-only"> {t("patchHeroes.plural.nerf")}</span>
            </span>
          )}
          {b.adjust > 0 && (
            <span className="text-chalk-400">
              <span aria-hidden>◆ </span>{b.adjust}
              <span className="sr-only"> {t("patchHeroes.plural.adjust")}</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
