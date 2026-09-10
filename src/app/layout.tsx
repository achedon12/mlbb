import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";
import "./globals.css";

/**
 * Racine de l'arbre. La langue etant portee par le segment `[locale]`, c'est
 * la mise en page de ce segment qui rend `<html>` et `<body>` ; celle-ci ne
 * fait que traverser. Les metadonnees communes (base des URL, robots) vivent
 * ici, une seule fois pour tout le site.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: site.nom,
  authors: [{ name: site.auteur, url: `https://github.com/${site.auteur}` }],
  creator: site.auteur,
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
  return children;
}
