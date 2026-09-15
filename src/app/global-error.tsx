"use client";

import { useEffect } from "react";
import { LOCALES, DEFAULT_LOCALE, LOCALE_HTML, type Locale } from "@/i18n/config";

/**
 * Its three sentences, hard-coded: importing the catalog here would put it back
 * into every page's JavaScript, since this boundary is loaded ahead of time.
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
  },
  "id": {
    "title": "Terjadi kesalahan",
    "text": "Situs mengalami masalah yang tidak terduga. Coba lagi sebentar lagi.",
    "retry": "Coba lagi"
  }
};

/**
 * Last-resort error boundary.
 *
 * It only fires if the root layout itself fails: Next has then
 * replaced the whole document, hence the full `<html>`/`<body>` and the
 * inline styles, since the stylesheet may not be loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The error page replaces the whole document: the language is read from the address.
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
