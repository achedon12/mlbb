import { serializeJsonLd } from "@/lib/html";
import { RoleAccess } from "@/components/role-access";
import { Foldable } from "@/components/foldable";
import { HomeCommunity } from "@/components/home/home-community";
import { HomeHero } from "@/components/home/home-hero";
import { HomeLive } from "@/components/home/home-live";
import { HomeMeta } from "@/components/home/home-meta";
import { HomePatch } from "@/components/home/home-patch";
import { HomeTools } from "@/components/home/home-tools";
import { Card, SectionTitle } from "@/components/ui";
import { allHeroes, sync } from "@/lib/data";
import { site } from "@/lib/site";
import type { Role } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { LOCALE_HTML, isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { createT } from "@/i18n/translations";

/** Frame of a home block: one surface per tile, the blocks' own cards inside it. */
const TILE = "bevel min-w-0 border border-night-700/60 bg-night-900/35 p-4 sm:p-6";

/** Home page structured data, in the page's language. */
const dataHome = (locale: Locale) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#site`,
      url: site.url,
      name: site.name,
      description: site.description,
      inLanguage: LOCALE_HTML[locale],
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${site.url}/${locale}/heroes?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${site.url}/#editeur`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon.svg`,
      sameAs: [site.repository],
    },
  ],
});

/**
 * Home page, in the order a player's questions come: what is this and where
 * is my hero (hero, search, the day's state of the game), who is strong
 * right now (meta), what the patch changed, what is happening in the game
 * (skins of the month, esports), which tool to open, which role to browse,
 * then the articles and the community. Every block is a server component
 * computed from the synced data; the only browser code is the server clock
 * and the button opening the global search.
 */
export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  // /nonexistent.txt arrives here with "nonexistent.txt" as its language: the page
  // renders together with the layout, and its numbers formatted in
  // that invalid language made it fail with a 500 before the 404.
  if (!isLocale(locale)) notFound();
  const t = createT(locale);

  const byRole = Object.fromEntries(
    (["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"] as Role[]).map((r) => [
      r,
      allHeroes.filter((h) => h.roles.includes(r)).length,
    ]),
  ) as Record<Role, number>;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(dataHome(locale)) }}
      />

      <HomeHero locale={locale} />

      {/*
        The blocks as tiles: one under the other on a phone and a tablet. On a
        wide screen, two stacks side by side whose heights match — the meta
        and the patch (its three lists side by side) on two thirds of the
        width, the tools and the roles on the last third — the last tile of
        each stack growing to end level with the other; then the month's
        events and the articles, each across the width. The stacks are
        `contents` below `2xl`: the tiles keep one reading order everywhere.
      */}
      <div className="page-wrap grid gap-4 py-6 sm:gap-5 sm:py-10 2xl:grid-cols-12">
        <div className="contents 2xl:col-span-8 2xl:flex 2xl:flex-col 2xl:gap-5">
          <HomeMeta locale={locale} className={TILE} />
          <HomePatch locale={locale} className={cn(TILE, "2xl:flex-1")} />
        </div>
        <div className="contents 2xl:col-span-4 2xl:flex 2xl:flex-col 2xl:gap-5">
          <HomeTools locale={locale} className={TILE} />
          <section aria-labelledby="home-roles" className={cn(TILE, "2xl:flex-1")}>
            <SectionTitle id="home-roles" lead={t("home.startLead")}>
              {t("home.startTitle")}
            </SectionTitle>
            <RoleAccess count={byRole} locale={locale} />
          </section>
        </div>
        <HomeLive locale={locale} className={cn(TILE, "2xl:col-span-12")} />
        <HomeCommunity locale={locale} className={cn(TILE, "2xl:col-span-12")} />
      </div>

      {/*
        The last block explains the site rather than showing it: it closes
        the page instead of lengthening it, its three cards folded under a
        summary line. The text stays in the document.
      */}
      <section className="page-wrap pb-10 sm:pb-16">
        <Foldable label={t("home.howItWorks")}>
          <p className="text-sm text-chalk-500">
            {t("home.syncLead", { date: formatShortDate(sync.date, LOCALE_HTML[locale]) })}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { title: t("home.cards.dataTitle"), text: t("home.cards.dataText") },
              { title: t("home.cards.rankingTitle"), text: t("home.cards.rankingText") },
              { title: t("home.cards.writtenTitle"), text: t("home.cards.writtenText") },
            ].map((c) => (
              <Card key={c.title}>
                <h3 className="font-heading text-lg font-bold text-chalk-100">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-chalk-500">{c.text}</p>
              </Card>
            ))}
          </div>
        </Foldable>
      </section>
    </>
  );
}
