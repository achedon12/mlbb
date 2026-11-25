import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import {
  BalanceSummary,
  EntryCard,
  HeroChips,
  LineList,
  StatusBadge,
  TestNotice,
  VersionDate,
} from "@/components/advance-changes";
import { WikiCredit } from "@/components/wiki-credit";
import { EditorialPoster, ENTRANCE } from "@/components/editorial-poster";
import { advanceArt } from "@/components/patch-visuals";
import { cn } from "@/lib/utils";
import Link from "@/components/link";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import {
  advanceVersion,
  advanceVersionNumbers,
  advanceVersions,
  isTranslated,
  isUnderTest,
  type AdvanceCategory,
} from "@/lib/advance-server";
import { heroesBySlug } from "@/lib/data";
import { longDate, listNames, patchCurrent } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { site } from "@/lib/site";
import { advanceDocumented } from "@/lib/advance-fresh";
import { NotFoundPage } from "@/components/not-found-page";
import { ReportError } from "@/components/report-error";

type Params = { params: Promise<{ locale: Locale; version: string }> };

const PATH = "/patch-notes/advance-server";
const CATEGORY_ORDER: AdvanceCategory[] = ["items", "emblems", "spells", "system"];

/**
 * The build renders the newest version, the one under test; the older ones are
 * rendered on their first request then cached until the next deploy. An
 * unknown version still falls on the 404 (`advanceVersion`).
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return advanceVersionNumbers.slice(0, 1).map((version) => ({ version }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, version } = await params;
  const v = advanceVersion(locale, version);
  if (!v) return notFoundMetadata(locale);
  const t = createT(locale);
  // The date, the hero counts and the first heroes named fill the description.
  const names = [...new Set(v.heroes.map((h) => heroesBySlug.get(h.slug)?.name ?? h.name))].slice(0, 4);
  const label = v.date ? `${v.version} (${longDate(locale, v.date)})` : v.version;
  const meta = metaPage(locale, {
    title: t("pages.advanceServer.seo.title", { v: v.version }),
    description: names.length
      ? t("pages.advanceServer.seo.descriptionVersion", {
          version: label,
          buffs: v.balance.buff,
          nerfs: v.balance.nerf,
          adjust: v.balance.adjust,
          heroes: listNames(locale, names),
        })
      : t("pages.advanceServer.seo.descriptionVersionNoHeroes", { version: label }),
    share: t("pages.advanceServer.seo.share"),
    path: `${PATH}/${v.version}`,
    type: "article",
    published: v.date ?? undefined,
    keywords: t("pages.advanceServer.seo.keywords")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  });
  // Frozen since the wiki stopped documenting the test server: kept as an
  // archive, out of the index (`advanceDocumented`).
  return advanceDocumented() ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function AdvanceServerVersionPage({ params }: Params) {
  const { locale, version } = await params;
  const v = advanceVersion(locale, version);
  if (!v) return <NotFoundPage />;
  const t = createT(locale);
  const live = patchCurrent.version;
  const translated = isTranslated(locale, v.version);
  const heading = t("pages.advanceServer.heading", { v: v.version });
  const n = new Set(v.heroes.map((h) => h.slug)).size;
  const plural = new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other";
  const title2 = "type-section scroll-mt-24 text-chalk-100";
  // The heading names the version: the number is set huge, the words around it stay a line.
  const [headingBefore = "", headingAfter = ""] = heading.split(v.version).map((x) => x.trim());

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t("pages.advanceServer.seo.title", { v: v.version }),
    ...(v.date ? { datePublished: v.date, dateModified: v.date } : {}),
    inLanguage: translated ? LOCALE_HTML[locale] : "en",
    isBasedOn: v.url,
    publisher: { "@type": "Organization", name: site.name, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}${PATH}/${v.version}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

      <EditorialPoster
        art={advanceArt(v.heroes)}
        crumbs={[
          { name: t("nav.patchNotes.label"), href: "/patch-notes" },
          { name: t("pages.advanceServer.crumb"), href: PATH },
          {
            name: heading,
            siblings: advanceVersions(locale).map((x) => ({
              name: t("pages.advanceServer.heading", { v: x.version }),
              href: `${PATH}/${x.version}`,
            })),
          },
        ]}
      >
        <p className="flex flex-wrap items-center gap-3 font-heading text-base font-bold uppercase text-gold-400">
          {t("pages.advanceServer.eyebrow")}
          <StatusBadge underTest={isUnderTest(v.version, live)} live={live} t={t} />
        </p>
        <h1 className="affiche-name mt-3">
          {headingBefore && <span className="block font-heading text-xl font-bold uppercase text-chalk-200 sm:text-2xl">{headingBefore}</span>}{" "}
          <span className="score mt-1 block text-[clamp(5.5rem,3rem+9vw,11rem)]">{v.version}</span>
          {headingAfter && <span className="mt-2 block font-heading text-xl font-bold uppercase text-chalk-200">{headingAfter}</span>}
        </h1>
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-chalk-300">
          <VersionDate version={v} locale={locale} t={t} />
          <span aria-hidden>·</span>
          <a
            href={v.url}
            rel="noreferrer nofollow"
            target="_blank"
            className="inline-flex items-center gap-1 text-gold-400 hover:underline"
          >
            {t("pages.advanceServer.sourceLink")}
            <ExternalLink size={12} aria-hidden />
          </a>
        </p>
        {v.heroes.length > 0 && <BalanceSummary balance={v.balance} t={t} size="lg" />}
      </EditorialPoster>

      <div className={cn("page-wrap pb-12 pt-10 sm:pt-14", ENTRANCE)}>
        <div className="mx-auto max-w-5xl">
        <div className="max-w-3xl">
          <TestNotice t={t} />
        </div>

        <div className="mt-12 space-y-16 sm:mt-16 sm:space-y-20">
          {(v.summary || v.designerNotes.length > 0) && (
            <section aria-labelledby="advance-summary" className="space-y-6">
              {v.summary && (
                <div>
                  <h2 id="advance-summary" className={title2}>
                    {t("pages.advanceServer.summary")}
                  </h2>
                  <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
                  <p className="mt-4 leading-relaxed text-chalk-300">{v.summary}</p>
                </div>
              )}
              {v.designerNotes.length > 0 && (
                <div>
                  <h2 id={v.summary ? undefined : "advance-summary"} className={title2}>
                    {t("pages.advanceServer.designers")}
                  </h2>
                  <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
                  <blockquote className="bevel mt-5 space-y-3 bg-night-900 p-5 leading-relaxed text-chalk-200 shadow-[inset_3px_0_0_var(--color-gold-400)] sm:p-6 sm:text-lg">
                    {v.designerNotes.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </blockquote>
                </div>
              )}
            </section>
          )}

          {v.newHeroes.length > 0 && (
            <section aria-labelledby="advance-new-heroes">
              <h2 id="advance-new-heroes" className={title2}>
                {t("pages.advanceServer.newHeroes")}
              </h2>
              <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
              <ul className="mt-4 space-y-2">
                {v.newHeroes.map((h) => (
                  <li key={h.title} className="flex flex-wrap items-baseline gap-x-2 text-chalk-300">
                    <span className="font-heading text-sm font-bold uppercase text-gold-400">
                      {t(`pages.advanceServer.kind.${h.kind}`)}
                    </span>
                    {h.slug && heroesBySlug.has(h.slug) ? (
                      <Link href={`/heroes/${h.slug}`} className="font-semibold text-chalk-100 hover:text-gold-400">
                        {h.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-chalk-100">{h.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="advance-heroes">
            <h2 id="advance-heroes" className={title2}>
              {t("pages.advanceServer.heroChanges")}
            </h2>
            <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
            {v.heroes.length === 0 ? (
              <p className="mt-4 text-sm text-chalk-300">{t("pages.advanceServer.noHeroChanges")}</p>
            ) : (
              <>
                <p className="mt-4 text-sm text-chalk-300">
                  {t(`pages.advanceServer.heroChangesSummary.${plural}`, { n, v: v.version })}
                </p>
                <div className="mt-8">
                  <HeroChips heroes={v.heroes} t={t} />
                </div>

                <h3 className="display-caps mt-14 text-[2rem] font-extrabold text-chalk-100">{t("pages.advanceServer.details")}</h3>
                <div className="mt-4 space-y-3">
                  {v.heroes.map((h, i) => {
                    const page = heroesBySlug.get(h.slug);
                    return (
                      <EntryCard
                        key={`${h.slug}-${i}`}
                        id={i === v.heroes.findIndex((x) => x.slug === h.slug) ? `hero-${h.slug}` : undefined}
                        entry={{ ...h, name: page?.name ?? h.name }}
                        t={t}
                        portrait={page?.images.icon ?? page?.images.portrait ?? null}
                        href={page ? `/heroes/${h.slug}` : undefined}
                        headingLevel={4}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {CATEGORY_ORDER.map((category) => {
            const sections = v.sections.filter((s) => s.category === category);
            if (sections.length === 0) return null;
            return (
              <section key={category} aria-labelledby={`advance-${category}`}>
                <h2 id={`advance-${category}`} className={title2}>
                  {t(`pages.advanceServer.categories.${category}`)}
                </h2>
                <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
                <div className="mt-6 space-y-8">
                  {sections.map((s, i) => (
                    <div key={i}>
                      <h3 className="type-subtitle text-chalk-100">{s.title}</h3>
                      {s.entries.length > 0 && (
                        <div className="mt-3 space-y-3">
                          {s.entries.map((e, j) => (
                            <EntryCard
                              key={j}
                              entry={e}
                              t={t}
                              href={category === "items" && e.slug ? `/items/${e.slug}` : undefined}
                              headingLevel={4}
                            />
                          ))}
                        </div>
                      )}
                      {s.lines.length > 0 && (
                        <div className="mt-3">
                          <LineList lines={s.lines} t={t} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="space-y-4 border-t border-night-800 pt-6">
            <Link href={PATH} className="text-sm font-semibold text-gold-400 hover:text-gold-500">
              ← {t("pages.advanceServer.allVersions")}
            </Link>
            <WikiCredit
              t={t}
              href={v.url}
              messageKey={translated ? "pages.advanceServer.creditTranslated" : "pages.advanceServer.credit"}
              className="text-xs leading-relaxed text-chalk-500"
            />
            <ReportError messages={messagesPage(locale, ["pages.reportError"])} path={`${PATH}/${version}`} />
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
