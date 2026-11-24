import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Barlow_Condensed, Chakra_Petch, Fira_Sans_Extra_Condensed, Inter, Noto_Sans_Thai, Saira, Saira_Extra_Condensed } from "next/font/google";
import { Header } from "@/components/header";
import { Offline } from "@/components/offline";
import { DiscordPopup } from "@/components/discord-popup";
import { DiscordBand } from "@/components/discord-band";
import { Analytics } from "@/components/analytics";
import { Footer } from "@/components/footer";
import { ErrorReporter } from "@/components/error-reporter";
import { ConsentBanner } from "@/components/consent-banner";
import { VisitClock } from "@/components/visit-clock";
import { LocaleProvider } from "@/i18n/provider";
import { LOCALES, DEFAULT_LOCALE, LOCALE_HTML, isLocale } from "@/i18n/config";
import { createT, messagesClient } from "@/i18n/translations";
import { metaLocales, OG_LOCALE, shareImage } from "@/i18n/seo";
import { site } from "@/lib/site";
import { allHeroes } from "@/lib/data";
import { PRERENDERED_LOCALES } from "@/lib/prerender";

/**
 * Self-hosted fonts: `next/font` downloads them at build time and serves them
 * from the site — no third-party request on load.
 */
const heading = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--heading-font",
  display: "swap",
});
// The display type (hero names, page and section titles, score figures):
// Saira Extra Condensed, the face of the wordmark. It has no italic of its
// own: the browser slants it for `display-caps` (globals.css), as the wordmark is slanted.
const display = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--display-font",
  display: "swap",
});

// The figures (win rates, scores, counters): Saira's variable cut, the
// wordmark's family, in its real italic and narrowed on its width axis to the
// extra-condensed width (`.score`, `.figure`, globals.css). Its digits have
// one width (tabular), so a counting figure never jitters, and they are the
// same in every language: Cyrillic and Thai pages show their numbers in it
// too. Not preloaded: until it arrives the figures use Saira Extra Condensed,
// slanted by the browser, almost the same width.
const figure = Saira({
  subsets: ["latin"],
  style: "italic",
  weight: "variable",
  axes: ["wdth"],
  variable: "--figure-font",
  display: "swap",
  preload: false,
});

// Body text is not repainted when the font arrives: without it in
// time, the page keeps its fallback font, with metrics adjusted by
// next/font. Headings keep Barlow Condensed no matter what.
const inter = Inter({
  subsets: ["latin"],
  variable: "--body-font",
  display: "optional",
});

/*
 * Barlow and Saira have neither Cyrillic nor Thai, and Inter no Thai: the
 * Russian and Thai pages take these fonts (`globals.css`, `:lang()`), a
 * condensed face for Cyrillic and Chakra Petch's squared one for Thai. Never
 * preloaded: the other languages do not load them, and their files are
 * fetched only for the characters they cover.
 */
const headingCyrillic = Fira_Sans_Extra_Condensed({
  subsets: ["cyrillic"],
  weight: ["600", "700"],
  variable: "--heading-font-cyrillic",
  display: "swap",
  preload: false,
});
const displayCyrillic = Fira_Sans_Extra_Condensed({
  subsets: ["cyrillic"],
  weight: ["800", "900"],
  style: "italic",
  variable: "--display-font-cyrillic",
  display: "swap",
  preload: false,
});
const headingThai = Chakra_Petch({
  subsets: ["thai"],
  weight: ["600", "700"],
  variable: "--heading-font-thai",
  display: "swap",
  preload: false,
});
const displayThai = Chakra_Petch({
  subsets: ["thai"],
  weight: "700",
  style: "italic",
  variable: "--display-font-thai",
  display: "swap",
  preload: false,
});
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--body-font-thai",
  display: "swap",
  preload: false,
});

const FONTS = [heading, display, figure, inter, headingCyrillic, displayCyrillic, headingThai, displayThai, notoSansThai]
  .map((f) => f.variable)
  .join(" ");

type Params = { params: Promise<{ locale: string }> };

/**
 * One version of the site per language. Only the most visited languages are
 * generated at build time, the others on their first request
 * (`PRERENDERED_LOCALES`, src/lib/prerender.ts).
 */
export function generateStaticParams() {
  return PRERENDERED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createT(locale);
  const title = `${site.name} — ${t("common.subtitle")}`;
  const description = t("common.homeDescription", { heroes: allHeroes.length });

  return {
    title: { default: title, template: `%s — ${site.name}` },
    description,
    alternates: {
      // Language root: canonical and hreflang of the home page. Child pages
      // declare their own alternates via `metaLocales`.
      ...metaLocales(locale, ""),
      types: { "application/rss+xml": [{ url: "/feed.xml", title: `${site.name}` }] },
    },
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      url: `${site.url}/${locale}`,
      siteName: site.name,
      title,
      description,
      images: [shareImage(locale)],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: shareImage(locale).url, alt: shareImage(locale).alt }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = createT(locale);

  return (
    <html lang={LOCALE_HTML[locale] ?? LOCALE_HTML[DEFAULT_LOCALE]} className={FONTS}>
      <body className="flex min-h-screen flex-col">
        <LocaleProvider locale={locale} messages={messagesClient(locale)}>
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-gold-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-night-950"
          >
            {t("common.skipToContent")}
          </a>
          <ConsentBanner />
          <Header locale={locale} />
          <main id="content" className="flex-1">
            {children}
          </main>
          <DiscordBand />
          <Footer locale={locale} year={new Date().getFullYear()} />
          <Analytics />
          <ErrorReporter />
          <Offline />
          <VisitClock />
          <DiscordPopup />
        </LocaleProvider>
      </body>
    </html>
  );
}
