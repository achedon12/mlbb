import { serializeJsonLd } from "@/lib/html";
import { HomeCommunity } from "@/components/home/home-community";
import { HomeDaily } from "@/components/home/home-daily";
import { HomeHero } from "@/components/home/home-hero";
import { HomeJump } from "@/components/home/home-jump";
import { HomeLive } from "@/components/home/home-live";
import { HomeMeta } from "@/components/home/home-meta";
import { HomePatch } from "@/components/home/home-patch";
import { SinceLastVisit } from "@/components/home/since-last-visit";
import { sinceDigest } from "@/lib/since-visit-server";
import { site } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import { LOCALE_HTML, isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

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

/** A band's inner block: the page container, with a quarter of a screen of air. */
const INNER = "page-wrap py-20 sm:py-28 lg:py-32";

/**
 * Home page, a game's season page: a poster, then six screens, each built
 * around one big image or one bold colour, one message and one call to
 * action, their grounds alternating so the page never reads as one black
 * wall — the meta (the lighter night, the top five as large art), the patch
 * (art at the left, always dark), the daily games (a gold band), the month's
 * skin (full-bleed art), where to go next (art tiles on the base night),
 * and why the site and its Discord server (an azure band). The details live
 * on the dedicated pages.
 *
 * Every block is a server component computed from the synced data; the
 * browser code is the server clock, the button opening the global search,
 * the daily games' countdown, the "since your last visit" strip and the
 * support card. Nothing comes in on scroll.
 */
export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  // /nonexistent.txt arrives here with "nonexistent.txt" as its language: the page
  // renders together with the layout, and its numbers formatted in
  // that invalid language made it fail with a 500 before the 404.
  if (!isLocale(locale)) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(dataHome(locale)) }}
      />

      <HomeHero locale={locale} />

      {/* For a returning visitor: what changed since. */}
      <SinceLastVisit digest={sinceDigest()} />

      <div className="bg-night-900">
        <div className={INNER}>
          <HomeMeta locale={locale} />
        </div>
      </div>
      <HomePatch locale={locale} />
      <div className="scheme-dark bg-gold-400">
        <div className="page-wrap py-16 sm:py-20 lg:py-24">
          <HomeDaily locale={locale} />
        </div>
      </div>
      <HomeLive locale={locale} />
      <div className={INNER}>
        <HomeJump locale={locale} />
      </div>
      <div className="scheme-dark bg-azure-500">
        <div className={INNER}>
          <HomeCommunity locale={locale} />
        </div>
      </div>
    </>
  );
}
