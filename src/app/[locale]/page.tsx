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
import { formatShortDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { LOCALE_HTML, isLocale, LOCALE_INTL } from "@/i18n/config";
import { notFound } from "next/navigation";
import { createT } from "@/i18n/translations";

/** The éclat between two blocks of the page: no frame around them, one blade between. */
function Divider() {
  return <div aria-hidden className="eclat-rule my-14 sm:my-20" />;
}

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
        The blocks one under the other, each the width of the page and each
        led by one thing (the S+ portraits, the patch's buffs, the month's
        skin), the éclat between them — no frame around each. Only the tools
        and the roles share a row on a wide screen, at two weights.
      */}
      <div className="page-wrap py-12 sm:py-16">
        <HomeMeta locale={locale} />
        <Divider />
        <HomePatch locale={locale} />
        <Divider />
        <div className="grid gap-x-14 gap-y-14 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <HomeTools locale={locale} className="min-w-0" />
          <section aria-labelledby="home-roles" className="min-w-0">
            <SectionTitle id="home-roles" lead={t("home.startLead")}>
              {t("home.startTitle")}
            </SectionTitle>
            <RoleAccess count={byRole} locale={locale} />
          </section>
        </div>
        <Divider />
        <HomeLive locale={locale} />
        <Divider />
        <HomeCommunity locale={locale} />
      </div>

      {/*
        The last block explains the site rather than showing it: it closes
        the page instead of lengthening it, its three cards folded under a
        summary line. The text stays in the document.
      */}
      <section className="page-wrap pb-12 sm:pb-16">
        <Foldable label={t("home.howItWorks")}>
          <p className="text-sm text-chalk-500">
            {t("home.syncLead", { date: formatShortDate(sync.date, LOCALE_INTL[locale]) })}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { title: t("home.cards.dataTitle"), text: t("home.cards.dataText") },
              { title: t("home.cards.rankingTitle"), text: t("home.cards.rankingText") },
              { title: t("home.cards.writtenTitle"), text: t("home.cards.writtenText") },
            ].map((c) => (
              <Card key={c.title}>
                <h3 className="type-subtitle text-chalk-100">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-chalk-500">{c.text}</p>
              </Card>
            ))}
          </div>
        </Foldable>
      </section>
    </>
  );
}
