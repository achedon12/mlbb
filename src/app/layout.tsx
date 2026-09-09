import type { Metadata, Viewport } from "next";
import { Inter, Rajdhani } from "next/font/google";
import { EnTete } from "@/components/en-tete";
import { PiedDePage } from "@/components/pied-de-page";
import { site } from "@/lib/site";
import "./globals.css";

/**
 * Polices auto-hebergees.
 *
 * `next/font` telecharge les fichiers au build et les sert depuis le site :
 * aucune requete vers un domaine tiers au chargement, et aucun decalage de
 * mise en page quand la police arrive.
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

/**
 * Metadonnees communes.
 *
 * `metadataBase` permet a Next de resoudre seul les URL absolues des images
 * sociales et des liens canoniques ; chaque page ne declare plus que ce qui
 * lui est propre.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.titre,
    template: `%s — ${site.nom}`,
  },
  description: site.description,
  applicationName: site.nom,
  authors: [{ name: site.auteur, url: `https://github.com/${site.auteur}` }],
  creator: site.auteur,
  keywords: [
    "Mobile Legends",
    "MLBB",
    "Mobile Legends Bang Bang",
    "heros MLBB",
    "build MLBB",
    "tier list MLBB",
    "patch notes MLBB",
    "guide Mobile Legends francais",
  ],
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: `${site.nom} — actualites` }] },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: site.url,
    siteName: site.nom,
    title: site.titre,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: site.titre,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "games",
};

export const viewport: Viewport = {
  themeColor: "#06080f",
  colorScheme: "dark",
};

export default function RacineLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${rajdhani.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-or-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-nuit-950"
        >
          Aller au contenu
        </a>
        <EnTete />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <PiedDePage />
      </body>
    </html>
  );
}
