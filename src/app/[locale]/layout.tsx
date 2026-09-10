import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, Rajdhani } from "next/font/google";
import { EnTete } from "@/components/en-tete";
import { HorsLigne } from "@/components/hors-ligne";
import { MesureAudience } from "@/components/mesure-audience";
import { PiedDePage } from "@/components/pied-de-page";
import { FournisseurLangue } from "@/i18n/fournisseur";
import { LANGUES, LANGUE_DEFAUT, LOCALE_HTML, estLangue, type Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { site } from "@/lib/site";

/**
 * Polices auto-hebergees : `next/font` les telecharge au build et les sert
 * depuis le site — aucune requete tierce au chargement.
 */
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--police-titre",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--police-corps",
  display: "swap",
});

type Params = { params: Promise<{ locale: string }> };

/** Une version du site par langue, generee au build. */
export function generateStaticParams() {
  return LANGUES.map((locale) => ({ locale }));
}

const OG_LOCALE: Record<Langue, string> = {
  en: "en_US",
  fr: "fr_FR",
  it: "it_IT",
  es: "es_ES",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!estLangue(locale)) return {};
  const t = creerT(locale);
  const titre = `${site.nom} — ${t("commun.sousTitre")}`;

  return {
    title: { default: titre, template: `%s — ${site.nom}` },
    description: t("commun.sousTitre"),
    alternates: {
      // Racine de la langue : canonique et hreflang de l'accueil. Les pages
      // filles declarent leurs propres alternates via `metaLangues`.
      ...metaLangues(locale, ""),
      types: { "application/rss+xml": [{ url: "/feed.xml", title: `${site.nom}` }] },
    },
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
      alternateLocale: LANGUES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      url: `${site.url}/${locale}`,
      siteName: site.nom,
      title: titre,
      description: t("commun.sousTitre"),
    },
    twitter: { card: "summary_large_image", title: titre, description: t("commun.sousTitre") },
  };
}

export default async function LangueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!estLangue(locale)) notFound();
  const t = creerT(locale);

  return (
    <html lang={LOCALE_HTML[locale] ?? LOCALE_HTML[LANGUE_DEFAUT]} className={`${rajdhani.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <FournisseurLangue langue={locale}>
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-or-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-nuit-950"
          >
            {t("commun.allerAuContenu")}
          </a>
          <EnTete langue={locale} />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <PiedDePage langue={locale} />
          <MesureAudience />
          <HorsLigne />
        </FournisseurLangue>
      </body>
    </html>
  );
}
