import { serializeJsonLd } from "@/lib/html";
import { RoleAccess } from "@/components/role-access";
import { RevealGroup } from "@/components/reveal";
import { HomeCommunity } from "@/components/home/home-community";
import { HomeDaily } from "@/components/home/home-daily";
import { HomeHero } from "@/components/home/home-hero";
import { HomeLive } from "@/components/home/home-live";
import { HomeMeta } from "@/components/home/home-meta";
import { HomePatch } from "@/components/home/home-patch";
import { HomeTools } from "@/components/home/home-tools";
import { HomeWhy } from "@/components/home/home-why";
import { SinceLastVisit } from "@/components/home/since-last-visit";
import { sinceDigest } from "@/lib/since-visit-server";
import { SectionTitle } from "@/components/ui";
import { allHeroes } from "@/lib/data";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { LOCALE_HTML, isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { createT } from "@/i18n/translations";

/**
 * One band of the page: the full width of the screen, its block inside the
 * page container. `tone` alternates the night: the base, a lighter band, or
 * the base brightening towards its foot, so the long page reads as a
 * sequence of distinct blocks rather than one black wall. The éclat's
 * hairline opens every band but the first.
 */
function Band({
  tone = "base",
  rule = true,
  children,
}: {
  tone?: "base" | "raised" | "fade";
  rule?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative",
        tone === "raised" && "bg-night-900",
        tone === "fade" && "bg-linear-to-b from-night-950 to-night-900",
      )}
    >
      {rule && <div aria-hidden className="eclat-rule" />}
      <div data-reveal className="page-wrap py-14 sm:py-20">
        {children}
      </div>
    </div>
  );
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
 * right now (meta), today's games, what the patch changed, what is
 * happening in the game (skins of the month, esports), which tool to open,
 * which role to browse, why this site (four proofs), then the articles and
 * the community. Every block is a server component
 * computed from the synced data; the browser code is the poster's stage
 * (parallax, counting figures, Dex), the server clock, the button opening
 * the global search, the daily games' state and the scroll reveal
 * (`RevealGroup`: each block comes in once, the first time it nears the
 * screen).
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

      {/* For a returning visitor: what changed since. */}
      <SinceLastVisit digest={sinceDigest()} />

      {/*
        One idea per band, the bands alternating between the base night and
        a lighter one. Only the tools and the roles share a band, side by
        side on a wide screen, at two weights.
      */}
      <RevealGroup>
        <Band rule={false}>
          <HomeMeta locale={locale} />
        </Band>
        <Band tone="raised">
          <HomeDaily locale={locale} />
        </Band>
        <Band>
          <HomePatch locale={locale} />
        </Band>
        <Band tone="fade">
          <HomeLive locale={locale} />
        </Band>
        <Band>
          <div className="grid gap-x-14 gap-y-14 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <HomeTools locale={locale} className="min-w-0" />
            <section aria-labelledby="home-roles" className="min-w-0">
              <SectionTitle id="home-roles" lead={t("home.startLead")}>
                {t("home.startTitle")}
              </SectionTitle>
              <RoleAccess count={byRole} locale={locale} />
            </section>
          </div>
        </Band>
        <Band tone="raised">
          <HomeWhy locale={locale} />
        </Band>
        <Band>
          <HomeCommunity locale={locale} />
        </Band>
      </RevealGroup>
    </>
  );
}
