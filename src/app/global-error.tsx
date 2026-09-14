"use client";

import { useEffect } from "react";
import { LOCALES, DEFAULT_LOCALE, LOCALE_HTML, type Locale } from "@/i18n/config";

/**
 * Ses trois phrases, en dur : importer le catalogue ici le remettrait dans le
 * JavaScript de chaque page, cette frontiere etant chargee d'avance.
 */
const TEXTS: Record<Locale, { title: string; text: string; retry: string }> = {
  "fr": {
    "title": "Une erreur est survenue",
    "text": "Le site a rencontre un probleme inattendu. Reessayez dans un instant.",
    "retry": "Reessayer"
  },
  "en": {
    "title": "An error has occurred",
    "text": "The site encountered an unexpected problem. Try again in a moment.",
    "retry": "Try again"
  },
  "it": {
    "title": "Si è verificato un errore",
    "text": "Il sito ha riscontrato un problema imprevisto. Riprova tra un attimo.",
    "retry": "Riprova"
  },
  "es": {
    "title": "Ha ocurrido un error",
    "text": "El sitio encontró un problema inesperado. Inténtalo de nuevo en un momento.",
    "retry": "Intentar otra vez"
  }
};

/**
 * Frontiere d'erreur de dernier recours.
 *
 * Elle ne se declenche que si la mise en page racine elle-meme echoue : Next a
 * alors remplace tout le document, d'ou le `<html>`/`<body>` complets et des
 * styles en ligne, la feuille de style pouvant ne pas etre chargee.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // La page d'erreur remplace tout le document : la langue se lit dans l'adresse.
  const locale =
    (typeof window !== "undefined"
      ? LOCALES.find((l) => window.location.pathname.split("/")[1] === l)
      : undefined) ?? DEFAULT_LOCALE;
  const text = TEXTS[locale];
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={LOCALE_HTML[locale]}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#06080f",
          color: "#eef2fb",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{text.title}</h1>
        <p style={{ color: "#7b88a6", maxWidth: "32rem", lineHeight: 1.6 }}>
          {text.text}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "none",
            background: "#e0a92e",
            color: "#06080f",
            fontWeight: 600,
            padding: "0.75rem 1.5rem",
            cursor: "pointer",
          }}
        >
          {text.retry}
        </button>
      </body>
    </html>
  );
}
