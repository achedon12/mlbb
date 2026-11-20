import type { Metadata } from "next";
import { LOCALES, LOCALE_HTML, type Locale } from "@/i18n/config";
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

/** One entry per language: a language added to LOCALES without its text fails the type check. */
const TEXTS: Record<Locale, string> = {
  fr: "Page introuvable",
  en: "Page not found",
  it: "Pagina non trovata",
  es: "Página no encontrada",
  id: "Halaman tidak ditemukan",
  fil: "Hindi nahanap ang page",
  th: "ไม่พบหน้านี้",
  pt: "Página não encontrada",
  ru: "Страница не найдена",
};

export default function GlobalNotFoundPage() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-night-950 px-4 py-12 text-center text-chalk-100">
        {/* A plain image: this document has none of the site's layout around it. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img src="/mascot/dex-surpris.webp" alt="" width={190} height={250} className="dex-idle" />
        <p aria-hidden className="score score-outline mt-2 text-[7rem]">404</p>
        <h1 className="display-caps mt-3 text-5xl">{TEXTS.en}</h1>
        <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {LOCALES.map((l) => (
            <li key={l}>
              <a
                href={`/${l}`}
                hrefLang={LOCALE_HTML[l]}
                className="btn btn-secondary btn-sm"
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
