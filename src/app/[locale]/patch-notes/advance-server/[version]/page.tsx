import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import {
  BalanceSummary,
  EntryCard,
  HeroChips,
  LineList,
  StatusBadge,
  TestNotice,
  VersionDate,
} from "@/components/advance-changes";
import { CreditWiki } from "@/components/credit-wiki";
import { FilAriane } from "@/components/fil-ariane";
import Link from "@/components/lien";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import {
  advanceVersion,
  advanceVersionNumbers,
  advanceVersions,
  isTranslated,
  isUnderTest,
  type AdvanceCategory,
} from "@/lib/advance-server";
import { herosParSlug } from "@/lib/donnees";
import { dateLongue, listeNoms, patchActuel } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Langue; version: string }> };

const PATH = "/patch-notes/advance-server";
const CATEGORY_ORDER: AdvanceCategory[] = ["items", "emblems", "spells", "system"];

export function generateStaticParams() {
  return advanceVersionNumbers.map((version) => ({ version }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, version } = await params;
  const v = advanceVersion(locale, version);
  if (!v) return {};
  const t = creerT(locale);
  // The date, the hero counts and the first heroes named fill the description.
  const names = [...new Set(v.heroes.map((h) => herosParSlug.get(h.slug)?.nom ?? h.name))].slice(0, 4);
  const label = v.date ? `${v.version} (${dateLongue(locale, v.date)})` : v.version;
  return metaPage(locale, {
    titre: t("pages.advanceServer.seo.title", { v: v.version }),
    description: names.length
      ? t("pages.advanceServer.seo.descriptionVersion", {
          version: label,
          buffs: v.balance.buff,
          nerfs: v.balance.nerf,
          adjust: v.balance.adjust,
          heroes: listeNoms(locale, names),
        })
      : t("pages.advanceServer.seo.descriptionVersionNoHeroes", { version: label }),
    partage: t("pages.advanceServer.seo.share"),
    chemin: `${PATH}/${v.version}`,
    type: "article",
    publie: v.date ?? undefined,
    motsCles: t("pages.advanceServer.seo.keywords")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  });
}

export default async function AdvanceServerVersionPage({ params }: Params) {
  const { locale, version } = await params;
  const v = advanceVersion(locale, version);
  if (!v) notFound();
  const t = creerT(locale);
  const live = patchActuel.version;
  const translated = isTranslated(locale, v.version);
  const heading = t("pages.advanceServer.heading", { v: v.version });
  const n = new Set(v.heroes.map((h) => h.slug)).size;
  const plural = new Intl.PluralRules(locale).select(n) === "one" ? "one" : "other";
  const title2 = "scroll-mt-24 font-heading text-2xl font-bold text-chalk-100";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t("pages.advanceServer.seo.title", { v: v.version }),
    ...(v.date ? { datePublished: v.date, dateModified: v.date } : {}),
    inLanguage: translated ? LOCALE_HTML[locale] : "en",
    isBasedOn: v.url,
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}${PATH}/${v.version}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />

      <div className="mx-auto max-w-4xl px-4 py-12">
        <FilAriane
          miettes={[
            { nom: t("nav.patchNotes.label"), href: "/patch-notes" },
            { nom: t("pages.advanceServer.crumb"), href: PATH },
            {
              nom: heading,
              freres: advanceVersions(locale).map((x) => ({
                nom: t("pages.advanceServer.heading", { v: x.version }),
                href: `${PATH}/${x.version}`,
              })),
            },
          ]}
        />

        <header className="mt-6 border-b border-night-800 pb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">{t("pages.advanceServer.eyebrow")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-heading text-3xl font-bold text-chalk-100 sm:text-4xl">{heading}</h1>
            <StatusBadge underTest={isUnderTest(v.version, live)} live={live} t={t} />
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-chalk-500">
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
          <div className="mt-6">
            <TestNotice t={t} />
          </div>
        </header>

        <div className="mt-10 space-y-14">
          {(v.summary || v.designerNotes.length > 0) && (
            <section aria-labelledby="advance-summary" className="space-y-6">
              {v.summary && (
                <div>
                  <h2 id="advance-summary" className={title2}>
                    {t("pages.advanceServer.summary")}
                  </h2>
                  <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                  <p className="mt-4 leading-relaxed text-chalk-300">{v.summary}</p>
                </div>
              )}
              {v.designerNotes.length > 0 && (
                <div>
                  <h2 id={v.summary ? undefined : "advance-summary"} className={title2}>
                    {t("pages.advanceServer.designers")}
                  </h2>
                  <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                  <blockquote className="mt-4 space-y-3 border-l-2 border-gold-500/50 pl-4 leading-relaxed text-chalk-300">
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
              <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
              <ul className="mt-4 space-y-2">
                {v.newHeroes.map((h) => (
                  <li key={h.title} className="flex flex-wrap items-baseline gap-x-2 text-chalk-300">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gold-400">
                      {t(`pages.advanceServer.kind.${h.kind}`)}
                    </span>
                    {h.slug && herosParSlug.has(h.slug) ? (
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
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
            {v.heroes.length === 0 ? (
              <p className="mt-4 text-sm text-chalk-300">{t("pages.advanceServer.noHeroChanges")}</p>
            ) : (
              <>
                <p className="mt-4 text-sm text-chalk-300">
                  {t(`pages.advanceServer.heroChangesSummary.${plural}`, { n, v: v.version })}
                </p>
                <div className="mt-4">
                  <BalanceSummary balance={v.balance} t={t} />
                </div>
                <div className="mt-6">
                  <HeroChips heroes={v.heroes} t={t} />
                </div>

                <h3 className="mt-10 font-heading text-xl font-bold text-chalk-100">{t("pages.advanceServer.details")}</h3>
                <div className="mt-4 space-y-3">
                  {v.heroes.map((h, i) => {
                    const page = herosParSlug.get(h.slug);
                    return (
                      <EntryCard
                        key={`${h.slug}-${i}`}
                        id={i === v.heroes.findIndex((x) => x.slug === h.slug) ? `hero-${h.slug}` : undefined}
                        entry={{ ...h, name: page?.nom ?? h.name }}
                        t={t}
                        portrait={page?.visuels.icone ?? page?.visuels.portrait ?? null}
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
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                <div className="mt-6 space-y-8">
                  {sections.map((s, i) => (
                    <div key={i}>
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{s.title}</h3>
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
            <CreditWiki
              t={t}
              href={v.url}
              cle={translated ? "pages.advanceServer.creditTranslated" : "pages.advanceServer.credit"}
              className="text-xs leading-relaxed text-chalk-500"
            />
          </div>
        </div>
      </div>
    </>
  );
}
