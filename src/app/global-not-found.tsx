import type { Metadata } from "next";
import { LANGUES, LOCALE_HTML } from "@/i18n/config";
import "./globals.css";

/**
 * 404 des adresses hors langue (/quelque-chose.txt, /foo). La racine ne rend
 * pas <html> — c'est la mise en page de [locale] qui le fait —, si bien que
 * sans cette page une adresse inconnue finissait en erreur 500 en production.
 * Elle rend donc son propre document, avec ses textes en dur, comme la
 * frontiere d'erreur globale : aucune langue n'est connue a ce stade.
 */
export const metadata: Metadata = {
  title: "404 — MLBBDex",
  robots: { index: false },
};

const TEXTES = {
  fr: "Page introuvable",
  en: "Page not found",
  it: "Pagina non trovata",
  es: "Página no encontrada",
} as const;

export default function PageIntrouvableGlobale() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-nuit-950 px-4 text-center text-craie-100">
        <p className="font-titre text-7xl font-bold text-or-400">404</p>
        <h1 className="mt-4 font-titre text-2xl font-bold">{TEXTES.en}</h1>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {LANGUES.map((l) => (
            <li key={l}>
              <a
                href={`/${l}`}
                hrefLang={LOCALE_HTML[l]}
                className="biseau-sm inline-block border border-nuit-600 px-4 py-2 text-sm font-semibold text-craie-100 transition-colors hover:border-or-500/60 hover:text-or-400"
              >
                {TEXTES[l]} · {l.toUpperCase()}
              </a>
            </li>
          ))}
        </ul>
      </body>
    </html>
  );
}
