import { newestFirst } from "@/lib/patch-version";
import { AuthorNote } from "@/components/author-note";
import { DiscordInvite } from "@/components/discord-invite";
import type { Metadata } from "next";
import { createT, messagesPage } from "@/i18n/translations";
import { cleanHtml, serializeJsonLd } from "@/lib/html";
import { BodyArticle } from "@/components/article";
import { PatchCredit } from "@/components/patch-credit";
import { PageSourcesBlock } from "@/components/page-sources";
import { Foldable } from "@/components/foldable";
import { EditorialPoster, ENTRANCE } from "@/components/editorial-poster";
import { PageLead } from "@/components/page-lead";
import { BalanceFigures, balanceOf, patchArt } from "@/components/patch-visuals";
import { BookOpen, Sparkles, TrendingUp } from "lucide-react";
import Link from "@/components/link";
import { NewHero } from "@/components/new-hero";
import { HeroPatch } from "@/components/hero-patch";
import { PatchToc } from "@/components/patch-toc";
import { heroesBySlug, illustrations, patchDetails, detailedPatches } from "@/lib/data";
import { article, articleBody, articles, patchAnalysis } from "@/lib/content";
import { hasRecap } from "@/lib/patch-recap";
import { recapOf } from "@/lib/patch-recap-server";
import { countAdjustments, longDate, listNames, patchCurrent } from "@/lib/freshness";
import { absoluteUrl, site } from "@/lib/site";
import { ogPath } from "@/lib/og/layout";
import type { DetailedPatch, PatchSection } from "@/lib/types";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { postData, metaPage, notFoundMetadata } from "@/i18n/seo";
import { cn } from "@/lib/utils";
import { HeroChanges, changedHeroCount } from "./hero-changes";
import { NotFoundPage } from "@/components/not-found-page";
import { ReportError } from "@/components/report-error";
import { SupportCard } from "@/components/support-links";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

const patches = patchDetails;

/**
 * "MLBB Patch 2.1.88: All Hero Buffs & Nerfs (42 changes)": the number of
 * heroes affected, taken from the notes, tells the patch's scale right away.
 */
function titlePatch(locale: Locale, patch: DetailedPatch): string {
  const t = createT(locale);
  const n = changedHeroCount(patch);
  if (n === 0) return t("pages.seo.patch.title", { v: patch.version });
  const shape = new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other";
  return t(`pages.seo.patch.titleChanges.${shape}`, { v: patch.version, n });
}

/**
 * A single route serves two things: the official notes taken from the wiki,
 * designated by their version number, and the written analyses, designated
 * by their slug. The two cannot collide — a version
 * number is never an article slug.
 *
 * The build renders the current patch and the analyses (read from `content/`);
 * older patches are rendered on their first request then cached until the
 * next deploy. An unknown slug still falls on the 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return [
    ...Object.keys(patches)
      .filter((version) => patches[version] === patchCurrent)
      .map((version) => ({ slug: version })),
    ...articles("patch-notes").map((a) => ({ slug: a.slug })),
  ];
}

/** The patch a slug designates; own keys only, so "constructor" is not a patch. */
const patchOf = (list: Record<string, DetailedPatch>, slug: string): DetailedPatch | undefined =>
  Object.hasOwn(list, slug) ? list[slug] : undefined;

/** Description built from data: date, adjustments by direction and first heroes affected. */
function descriptionPatch(locale: Locale, patch: DetailedPatch): string {
  const t = createT(locale);
  const names = [...new Set(patch.adjustments.map((a) => heroesBySlug.get(a.slug)?.name ?? a.name))].slice(0, 4);
  const version = patch.date ? `${patch.version} (${longDate(locale, patch.date)})` : patch.version;
  return names.length
    ? t("pages.seo.patch.description", { version, ...countAdjustments(patch.adjustments), heroes: listNames(locale, names) })
    : t("pages.patchNotes.officialDescription", { version: patch.version });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const patch = patchOf(patches, slug);

  if (patch) {
    const t = createT(locale);
    return metaPage(locale, {
      title: titlePatch(locale, patch),
      description: descriptionPatch(locale, patch),
      share: t("pages.patchNotes.officialShare", { version: patch.version }),
      path: `/patch-notes/${slug}`,
      card: true,
      type: "article",
      published: patch.date ?? undefined,
    });
  }

  const a = article("patch-notes", slug, locale);
  if (!a) return notFoundMetadata(locale);

  return metaPage(locale, {
    title: a.title,
    description: a.summary,
    path: `/patch-notes/${slug}`,
    card: true,
    type: "article",
    keywords: a.keywords,
    published: a.date,
    author: a.author,
  });
}

export default async function PatchPage({ params }: Params) {
  const { locale, slug } = await params;
  const patch = patchOf(detailedPatches(locale), slug);
  const t = createT(locale);

  // ── Official notes taken from the wiki ────────────────────────────────
  if (patch) {
    // A patch not yet translated is served in its original language.
    const translated = patch !== patchDetails[slug];
    // The recap is linked only once measured: without data it is a noindex page.
    const found = patch.adjustments.length > 0 ? recapOf(slug) : null;
    const measured = found !== null && hasRecap(found.recap);
    const analysis = patchAnalysis(patch.version, locale);
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: titlePatch(locale, patch),
      // The meta description: date, buffs and nerfs, first heroes affected.
      description: descriptionPatch(locale, patch),
      image: absoluteUrl(ogPath(locale, `/patch-notes/${slug}`)),
      ...(patch.date ? { datePublished: patch.date, dateModified: patch.date } : {}),
      inLanguage: translated ? LOCALE_HTML[locale] : "en",
      isBasedOn: patch.adjustmentsSource === "liquipedia" && patch.liquipedia ? [patch.link, patch.liquipedia] : patch.link,
      author: { "@type": "Organization", name: site.name, url: site.url },
      publisher: { "@type": "Organization", name: site.name, url: site.url },
      mainEntityOfPage: `${site.url}/${locale}/patch-notes/${slug}`,
      about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        />

        <EditorialPoster
          art={patchArt(patch)?.art ?? null}
          crumbs={[
            { name: t("nav.patchNotes.label"), href: "/patch-notes" },
            {
              name: `Patch ${patch.version}`,
              siblings: Object.values(patchDetails)
                .sort(newestFirst)
                .map((p) => ({ name: `Patch ${p.version}`, href: `/patch-notes/${p.version}` })),
            },
          ]}
        >
          <h1 className="affiche-name">
            <span className="block font-heading text-xl font-bold uppercase text-gold-400 sm:text-2xl">Patch</span>{" "}
            <span className="score mt-1 block text-[clamp(6rem,3rem+11vw,13rem)]">{patch.version}</span>
          </h1>
          <PageLead lead={t("pages.patchNotes.officialDescription", { version: patch.version })} />
          <ul className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {[
              t("pages.patchNotes.official"),
              t("pages.patchNotes.nSections", { n: patch.toc.length }),
              patch.date ? (
                <time key="date" dateTime={patch.date}>
                  {t("pages.patchNotes.publishedOn", { date: longDate(locale, patch.date) })}
                </time>
              ) : null,
            ]
              .filter(Boolean)
              .map((fact, i) => (
                <li key={i} className="bevel-sm bg-night-800/90 px-2 py-1 text-chalk-300">
                  {fact}
                </li>
              ))}
          </ul>
          {patch.adjustments.length > 0 && <BalanceFigures balance={balanceOf(patch)} t={t} size="lg" className="mt-7" />}
          {/* The measured story of the patch (winners, losers, surprises), once
            the history measures it, and the written analysis when there is one. */}
          {(measured || analysis) && (
            <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              {analysis && (
                <Link href={analysis.href} className="btn btn-secondary btn-sm">
                  <BookOpen size={14} aria-hidden />
                  {t("pages.patchNotes.analysisLink", { v: patch.version })}
                </Link>
              )}
              {measured && (
                <>
                  <Link href={`/patch-notes/${slug}/bilan`} className="btn btn-secondary btn-sm">
                    <TrendingUp size={14} aria-hidden />
                    {t("pages.patchRecap.link")}
                  </Link>
                  <span className="text-sm text-chalk-400">{t("pages.patchRecap.linkLead")}</span>
                </>
              )}
            </p>
          )}
          {patch.newHeroes.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {patch.newHeroes.map((h) => (
                <li key={h.slug}>
                  <a href={`#${patch.sections.find((x) => x.role === "newHeroes")?.anchor ?? "hero-changes"}`} className="btn btn-primary btn-sm">
                    <Sparkles size={14} aria-hidden />
                    {t("home.patch.newHero", { name: h.name })}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </EditorialPoster>

        <div className={cn("page-wrap pb-12 pt-8 sm:pt-12", ENTRANCE)}>
          {/* The author's signed opinion on this patch, when there is one. */}
          <AuthorNote kind="patchs" version={patch.version} locale={locale} className="mb-10 sm:mb-14" />
          {patch.adjustments.length > 0 && (
            <HeroChanges
              patch={patch}
              locale={locale}
              anchorDetail={patch.sections.find((s) => s.role === "adjustments")?.anchor ?? null}
            />
          )}

          {/*
            The table of contents accompanies the reading rather than preceding it: a
            patch note is browsed by section, it is almost never read
            in full.
          */}
          {patch.adjustments.length > 0 && <div aria-hidden className="eclat-rule mt-12 sm:mt-16" />}
          <div className="mt-10 gap-12 sm:mt-14 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="mb-10 lg:mb-0">
              {patch.toc.length > 0 && <PatchToc entries={patch.toc} />}
            </aside>

            <article className="min-w-0 max-w-3xl">
              {/*
                The notes are rendered section by section, in their original
                order. Two sections are taken over by a rich component at
                their exact place — the new heroes showcase and the
                adjustments table — the rest keeps the wiki's HTML, cleaned
                at sync time. The source is credited under the article,
                as its license requires.
              */}
              {patch.sections.map((section, i) => (
                <section key={section.anchor ?? i} className="mb-12">
                  {section.title && (
                    <>
                      <h2
                        id={section.anchor ?? undefined}
                        className="display-caps scroll-mt-24 text-[2rem] font-extrabold text-chalk-100 sm:text-[2.5rem]"
                      >
                        {section.title}
                      </h2>
                      <div aria-hidden className="eclat mt-3 h-[3px] w-20" />
                    </>
                  )}

                  <FoldSection
                    role={section.role}
                    label={
                      section.role === "newHeroes"
                        ? t("pages.patchNotes.openNewHeroes", { n: patch.newHeroes.length })
                        : t("pages.patchNotes.openAdjustments", { n: patch.adjustments.length })
                    }
                    className={section.title ? "mt-5" : undefined}
                  >
                    {section.role === "newHeroes" ? (
                      <div className="space-y-10">
                        {patch.newHeroes.map((h) => {
                          const sheet = heroesBySlug.get(h.slug);
                          const illus = illustrations[h.slug] ?? {};
                          const illustration =
                            (h.epithet ? illus[h.epithet] : undefined) ??
                            Object.values(illus)[0] ??
                            null;
                          return (
                            <NewHero
                              key={h.slug}
                              locale={locale}
                              hero={{
                                ...h,
                                portrait: sheet?.images.portrait ?? null,
                                illustration,
                                roles: sheet?.roles ?? [],
                                sheet: Boolean(sheet),
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : section.role === "adjustments" ? (
                      <HeroPatch
                        adjustments={patch.adjustments.map((a) => ({
                          ...a,
                          portrait:
                            heroesBySlug.get(a.slug)?.images.icon ??
                            heroesBySlug.get(a.slug)?.images.portrait ??
                            null,
                          sheet: heroesBySlug.has(a.slug),
                        }))}
                        summary={patch.balance}
                      />
                    ) : (
                      <div
                        className="prose-mlbb"
                        dangerouslySetInnerHTML={{ __html: cleanHtml(section.html) }}
                      />
                    )}
                  </FoldSection>
                </section>
              ))}

              <PageSourcesBlock locale={locale} of={{ kind: "patch" }}>
                <PatchCredit t={t} patch={patch} translated={translated} className="" />
              </PageSourcesBlock>
              <ReportError messages={messagesPage(locale, ["pages.reportError"])} path={`/patch-notes/${slug}`} className="mt-6" />
              <SupportCard placement="PatchNotes" className="mt-8" />
            </article>
          </div>
        </div>
      </>
    );
  }

  // ── Written analysis ───────────────────────────────────────────────────
  const a = article("patch-notes", slug, locale);
  if (!a) return <NotFoundPage />;

  const structuredData = postData(a, `/patch-notes/${slug}`, locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <BodyArticle
        locale={locale}
        article={a}
        {...articleBody(a.content)}
        others={articles("patch-notes", locale)}
        back={{ href: "/patch-notes", label: t("pages.patchNotes.all") }}
      />
      <div className="page-wrap pb-12">
        <DiscordInvite t={t} context="patch" />
        <ReportError messages={messagesPage(locale, ["pages.reportError"])} path={`/patch-notes/${slug}`} className="mt-6" />
        <SupportCard placement="PatchNotes" className="mt-8" />
      </div>
    </>
  );
}

/**
 * Body of one section of the notes, folded when it is a long one.
 *
 * A patch note is read by section, never end to end: the showcase of a new
 * hero and the hero-by-hero adjustment list alone ran for six screens on a
 * phone, below a summary that already said what the patch does. Those two
 * keep their heading and their anchor — the table of contents still lands on
 * them — and put their body in a closed `Foldable`, whose content stays in
 * the document. Prose sections are short: they are shown as they are.
 */
function FoldSection({
  role,
  label,
  className,
  children,
}: {
  role: PatchSection["role"];
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (role !== "newHeroes" && role !== "adjustments") {
    return <div className={className}>{children}</div>;
  }
  return (
    // The body keeps the full width of the column: the fold adds a summary
    // line, not a frame around a component that already has one.
    <Foldable label={label} className={cn(className, "[&>div]:px-0 [&>div]:pb-0 [&>div]:text-base")}>
      {children}
    </Foldable>
  );
}
