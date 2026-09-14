import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";
import "./globals.css";

/**
 * Root of the tree. Since the language is carried by the `[locale]` segment, it
 * is that segment's layout that renders `<html>` and `<body>`; this one only
 * passes through. Shared metadata (URL base, robots) lives
 * here, once for the whole site.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: site.name,
  authors: [{ name: site.author, url: `https://github.com/${site.author}` }],
  creator: site.author,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
