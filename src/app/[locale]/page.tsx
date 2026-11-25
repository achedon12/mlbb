import { serializeJsonLd } from "@/lib/html";
import { RoleAccess } from "@/components/role-access";
import { HomeArticles, HomeDiscord } from "@/components/home/home-community";
import { HomeDaily } from "@/components/home/home-daily";
import { HomeHero } from "@/components/home/home-hero";
import { HomeLive } from "@/components/home/home-live";
import { HomeMeta } from "@/components/home/home-meta";
import { HomePatch } from "@/components/home/home-patch";
import { HomeTools } from "@/components/home/home-tools";
import { HomeWhy } from "@/components/home/home-why";
import { SinceLastVisit } from "@/components/home/since-last-visit";
import { sinceDigest } from "@/lib/since-visit-server";
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
 * page container, with a quarter of a screen of air around it. `raised` is
 * the lighter night, so the long page reads as a sequence of grounds — the
 * base, a lighter band, a full-bleed artwork — rather than one black wall.
 */
function Band({ raised = false, children }: { raised?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(raised && "bg-night-900")}>
      <div className="page-wrap py-20 sm:py-28 lg:py-36">{children}</div>
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
 * Home page, one idea per screen, in the order a player's questions come:
 * what is this and where is my hero (the poster, the search, the day's
 * facts), who rules the patch (meta), what the patch changed, today's
 * games, what is happening in the game (the month's skin, esports), which
 * tool and which role to open, why this site (one sentence), then the
 * articles and the Discord server.
 *
 * Every block is a server component computed from the synced data; the
 * browser code is the server clock, the button opening the global search,
 * the daily games' state and the "since your last visit" strip. Nothing
 * comes in on scroll: every block is there from the first paint.
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

      <Band>
        <HomeMeta locale={locale} />
      </Band>
      <div className="border-t border-night-800">
        <Band>
          <HomePatch locale={locale} />
        </Band>
      </div>
      <Band raised>
        <HomeDaily locale={locale} />
      </Band>
      <HomeLive locale={locale} />
      <div className="border-t border-night-800">
      <Band>
        <HomeTools
          locale={locale}
          roles={
            <section aria-labelledby="home-roles" className="mt-20 border-t border-night-800 pt-10">
              <h3 id="home-roles" className="font-heading text-xl font-bold uppercase text-chalk-300">
                {t("home.startTitle")}
              </h3>
              <div className="mt-8">
                <RoleAccess count={byRole} locale={locale} />
              </div>
            </section>
          }
        />
      </Band>
      </div>
      <Band raised>
        <HomeWhy locale={locale} />
      </Band>
      <Band>
        <HomeArticles locale={locale} />
      </Band>
      <HomeDiscord locale={locale} />
    </>
  );
}
