import type { Metadata } from "next";
import { LOCALES, LOCALE_HTML } from "@/i18n/config";
import "./globals.css";

/**
 * 404 for addresses outside a language (/something.txt, /foo). The root does
 * not render <html> — the [locale] layout does —, so without this page
 * an unknown address ended up as a 500 error in production.
 * It therefore renders its own document, with hard-coded texts, like the
 * global error boundary: no language is known at this point.
 */
export const metadata: Metadata = {
  title: "404 — MLBBDex",
  robots: { index: false },
};

const TEXTS = {
  fr: "Page introuvable",
  en: "Page not found",
  it: "Pagina non trovata",
  es: "Página no encontrada",
} as const;

export default function GlobalNotFoundPage() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-night-950 px-4 text-center text-chalk-100">
        <p className="font-heading text-7xl font-bold text-gold-400">404</p>
        <h1 className="mt-4 font-heading text-2xl font-bold">{TEXTS.en}</h1>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {LOCALES.map((l) => (
            <li key={l}>
              <a
                href={`/${l}`}
                hrefLang={LOCALE_HTML[l]}
                className="bevel-sm inline-block border border-night-600 px-4 py-2 text-sm font-semibold text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                {TEXTS[l]} · {l.toUpperCase()}
              </a>
            </li>
          ))}
        </ul>
      </body>
    </html>
  );
}
