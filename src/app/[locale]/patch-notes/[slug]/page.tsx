import type { Metadata } from "next";
import { createT } from "@/i18n/translations";
import { cleanHtml, serializeJsonLd } from "@/lib/html";
import { notFound } from "next/navigation";
import { BodyArticle } from "@/components/article";
import { WikiCredit } from "@/components/wiki-credit";
import { Foldable } from "@/components/foldable";
import { PageHeader } from "@/components/ui";
import { NewHero } from "@/components/new-hero";
import { HeroPatch } from "@/components/hero-patch";
import { PatchToc } from "@/components/patch-toc";
import { heroesBySlug, illustrations, patchDetails, detailedPatches } from "@/lib/data";
import { article, articles, toHtml } from "@/lib/content";
import { countAdjustments, longDate, listNames, patchCurrent } from "@/lib/freshness";
import { site } from "@/lib/site";
import type { DetailedPatch, PatchSection } from "@/lib/types";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { postData, metaPage } from "@/i18n/seo";
import { cn } from "@/lib/utils";
import { HeroChanges, changedHeroCount } from "./hero-changes";

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

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const patch = patchOf(patches, slug);

  if (patch) {
    const t = createT(locale);
    // Description built from data: date, adjustments by direction and first heroes affected.
    const names = [...new Set(patch.adjustments.map((a) => heroesBySlug.get(a.slug)?.name ?? a.name))].slice(0, 4);
    const version = patch.date ? `${patch.version} (${longDate(locale, patch.date)})` : patch.version;
    return metaPage(locale, {
      title: titlePatch(locale, patch),
      description: names.length
        ? t("pages.seo.patch.description", {
            version,
            ...countAdjustments(patch.adjustments),
            heroes: listNames(locale, names),
          })
        : t("pages.patchNotes.officialDescription", { version: patch.version }),
      share: t("pages.patchNotes.officialShare", { version: patch.version }),
      path: `/patch-notes/${slug}`,
      type: "article",
      published: patch.date ?? undefined,
    });
  }

  const a = article("patch-notes", slug, locale);
  if (!a) return {};

  return metaPage(locale, {
    title: a.title,
    description: a.summary,
    path: `/patch-notes/${slug}`,
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
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: titlePatch(locale, patch),
      ...(patch.date ? { datePublished: patch.date, dateModified: patch.date } : {}),
      inLanguage: translated ? LOCALE_HTML[locale] : "en",
      isBasedOn: patch.link,
      publisher: { "@type": "Organization", name: site.name, url: site.url },
      mainEntityOfPage: `${site.url}/${locale}/patch-notes/${slug}`,
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        />

        <PageHeader
          title={`Patch ${patch.version}`}
          lead={t("pages.patchNotes.officialDescription", { version: patch.version })}
          crumbs={[
            { name: t("nav.patchNotes.label"), href: "/patch-notes" },
            {
              name: `Patch ${patch.version}`,
              siblings: Object.values(patchDetails)
                .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
                .map((p) => ({ name: `Patch ${p.version}`, href: `/patch-notes/${p.version}` })),
            },
          ]}
          meta={[
            t("pages.patchNotes.official"),
            t("pages.patchNotes.nSections", { n: patch.toc.length }),
            patch.date ? (
              <time key="date" dateTime={patch.date}>
                {t("pages.patchNotes.publishedOn", { date: longDate(locale, patch.date) })}
              </time>
            ) : null,
          ]}
        />

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
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
          <div className="mt-8 gap-10 sm:mt-10 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
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
                        className="scroll-mt-24 font-heading text-2xl font-bold text-chalk-100"
                      >
                        {section.title}
                      </h2>
                      <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
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

              <WikiCredit
                t={t}
                href={patch.link}
                messageKey={translated ? "pages.patchNotes.creditTranslated" : "pages.patchNotes.credit"}
                className="mt-12 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500"
              />
            </article>
          </div>
        </div>
      </>
    );
  }

  // ── Written analysis ───────────────────────────────────────────────────
  const a = article("patch-notes", slug, locale);
  if (!a) notFound();

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
        html={toHtml(a.content)}
        back={{ href: "/patch-notes", label: t("pages.patchNotes.all") }}
      />
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
