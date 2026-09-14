import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, Rajdhani } from "next/font/google";
import { Header } from "@/components/header";
import { Offline } from "@/components/offline";
import { Analytics } from "@/components/analytics";
import { Footer } from "@/components/footer";
import { ErrorReporter } from "@/components/error-reporter";
import { LocaleProvider } from "@/i18n/provider";
import { LOCALES, DEFAULT_LOCALE, LOCALE_HTML, isLocale } from "@/i18n/config";
import { createT, messagesClient } from "@/i18n/translations";
import { metaLocales, OG_LOCALE } from "@/i18n/seo";
import { site } from "@/lib/site";

/**
 * Self-hosted fonts: `next/font` downloads them at build time and serves them
 * from the site — no third-party request on load.
 */
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--heading-font",
  display: "swap",
});

// Body text is not repainted when the font arrives: without it in
// time, the page keeps its fallback font, with metrics adjusted by
// next/font. Headings keep Rajdhani no matter what.
const inter = Inter({
  subsets: ["latin"],
  variable: "--body-font",
  display: "optional",
});

type Params = { params: Promise<{ locale: string }> };

/** One version of the site per language, generated at build time. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createT(locale);
  const title = `${site.name} — ${t("common.subtitle")}`;

  return {
    title: { default: title, template: `%s — ${site.name}` },
    description: t("common.homeDescription"),
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
      description: t("common.homeDescription"),
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t("common.homeDescription"),
      images: ["/opengraph-image"],
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
    <html lang={LOCALE_HTML[locale] ?? LOCALE_HTML[DEFAULT_LOCALE]} className={`${rajdhani.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <LocaleProvider locale={locale} messages={messagesClient(locale)}>
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-gold-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-night-950"
          >
            {t("common.skipToContent")}
          </a>
          <Header locale={locale} />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <Footer locale={locale} />
          <Analytics />
          <ErrorReporter />
          <Offline />
        </LocaleProvider>
      </body>
    </html>
  );
}
