import type { Metadata } from "next";
import { createT } from "@/i18n/translations";
import { cleanHtml, serializeJsonLd } from "@/lib/html";
import { notFound } from "next/navigation";
import { BodyArticle } from "@/components/article";
import { WikiCredit } from "@/components/wiki-credit";
import { Breadcrumb } from "@/components/breadcrumb";
import { NewHero } from "@/components/new-hero";
import { HeroPatch } from "@/components/hero-patch";
import { PatchToc } from "@/components/patch-toc";
import { heroesBySlug, illustrations, patchDetails, detailedPatches } from "@/lib/data";
import { article, articles, toHtml } from "@/lib/content";
import { countAdjustments, longDate, listNames } from "@/lib/freshness";
import { site } from "@/lib/site";
import type { DetailedPatch } from "@/lib/types";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { postData, metaPage } from "@/i18n/seo";
import { HeroChanges, changedHeroCount } from "./hero-changes";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

const patches = patchDetails;

/**
 * « MLBB Patch 2.1.88: All Hero Buffs & Nerfs (42 changes) » : le nombre de
 * heros touches, tire des notes, dit d'emblee l'ampleur du patch.
 */
function titlePatch(locale: Locale, patch: DetailedPatch): string {
  const t = createT(locale);
  const n = changedHeroCount(patch);
  if (n === 0) return t("pages.seo.patch.title", { v: patch.version });
  const shape = new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other";
  return t(`pages.seo.patch.titleChanges.${shape}`, { v: patch.version, n });
}

/**
 * Une meme route sert deux choses : les notes officielles reprises du wiki,
 * designees par leur numero de version, et les analyses redigees, designees
 * par leur slug. Les deux ne peuvent pas entrer en collision — un numero de
 * version n'est jamais un slug d'article.
 */
export function generateStaticParams() {
  return [
    ...Object.keys(patches).map((version) => ({ slug: version })),
    ...articles("patch-notes").map((a) => ({ slug: a.slug })),
  ];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const patch = patches[slug];

  if (patch) {
    const t = createT(locale);
    // Description en donnees : date, ajustements par sens et premiers heros touches.
    const names = [...new Set(patch.adjustments.map((a) => heroesBySlug.get(a.slug)?.name ?? a.name))].slice(0, 4);
    const version = patch.date ? `${patch.version} (${longDate(locale, patch.date)})` : patch.version;
    return metaPage(locale, {
      title: titlePatch(locale, patch),
      description: names.length
        ? t("pages.seo.patch.description", {
            version,
            ...countAdjustments(patch.adjustments),
            heros: listNames(locale, names),
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
  const patch = detailedPatches(locale)[slug];
  const t = createT(locale);

  // ── Notes officielles reprises du wiki ────────────────────────────────
  if (patch) {
    // Un patch pas encore traduit est servi dans sa langue d'origine.
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

        <div className="mx-auto max-w-6xl px-4 py-12">
          <Breadcrumb
            crumbs={[
              { name: t("nav.patchNotes.label"), href: "/patch-notes" },
              {
                name: `Patch ${patch.version}`,
                siblings: Object.values(patchDetails)
                  .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
                  .map((p) => ({ name: `Patch ${p.version}`, href: `/patch-notes/${p.version}` })),
              },
            ]}
          />

          <header className="mt-6 border-b border-night-800 pb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">
              {t("pages.patchNotes.official")}
            </p>
            <h1 className="mt-2 font-heading text-4xl font-bold text-chalk-100">
              Patch {patch.version}
            </h1>
            <p className="mt-3 text-sm text-chalk-500">
              {t("pages.patchNotes.nSections", { n: patch.toc.length })}
              {patch.date && (
                <>
                  {" · "}
                  <time dateTime={patch.date}>
                    {t("pages.patchNotes.publishedOn", { date: longDate(locale, patch.date) })}
                  </time>
                </>
              )}
            </p>
          </header>

          {patch.adjustments.length > 0 && (
            <HeroChanges
              patch={patch}
              locale={locale}
              anchorDetail={patch.sections.find((s) => s.role === "adjustments")?.anchor ?? null}
            />
          )}

          {/*
            Le sommaire accompagne la lecture plutot que de la preceder : une
            note de patch se parcourt par sections, on n'en lit presque jamais
            l'integralite.
          */}
          <div className="mt-10 gap-10 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="mb-10 lg:mb-0">
              {patch.toc.length > 0 && <PatchToc entries={patch.toc} />}
            </aside>

            <article className="min-w-0 max-w-3xl">
              {/*
                Les notes sont rendues section par section, dans leur ordre
                d'origine. Deux sections sont reprises par un composant riche a
                leur place exacte — la presentation des nouveaux heros et le
                tableau des ajustements — le reste garde le HTML du wiki, nettoye
                a la synchronisation. La source est creditee sous l'article,
                comme l'exige sa licence.
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

                  <div className={section.title ? "mt-5" : undefined}>
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
                  </div>
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

  // ── Analyse redigee ───────────────────────────────────────────────────
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
