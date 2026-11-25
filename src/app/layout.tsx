import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";
import { THEME_COLORS } from "@/lib/theme";
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
  // Installed on iOS, the status bar takes the night ground too (theme-color covers the other browsers).
  appleWebApp: { title: site.name, statusBarStyle: "black" },
};

/*
 * Both themes (src/lib/theme.ts): the browser bar takes the ground of the
 * scheme the system prefers; a theme forced in the footer rewrites both tags
 * to its own ground.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
