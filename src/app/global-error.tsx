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
    "text": "Le site a rencontré un problème inattendu. Réessayez dans un instant.",
    "retry": "Réessayer"
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
  },
  "fil": {
    "title": "Nagkaroon ng error",
    "text": "Nagkaproblema ang site nang hindi inaasahan. Subukan ulit maya-maya.",
    "retry": "Subukan ulit"
  },
  "th": {
    "title": "เกิดข้อผิดพลาด",
    "text": "เว็บไซต์พบปัญหาที่ไม่คาดคิด ลองใหม่อีกครั้งในอีกสักครู่",
    "retry": "ลองอีกครั้ง"
  },
  "pt": {
    "title": "Ocorreu um erro",
    "text": "O site encontrou um problema inesperado. Tente de novo em instantes.",
    "retry": "Tentar de novo"
  },
  "ru": {
    "title": "Произошла ошибка",
    "text": "На сайте возникла непредвиденная проблема. Попробуйте ещё раз через минуту.",
    "retry": "Попробовать снова"
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
        {/* Dex, surprised: a plain image, the stylesheet and the image optimiser may both be down. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img src="/mascot/dex-surpris.webp" alt="" width={176} height={232} style={{ display: "block" }} />
        <h1 style={{ margin: 0, fontSize: "2.25rem", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
          {text.title}
        </h1>
        <div aria-hidden style={{ width: "6rem", height: 3, background: "linear-gradient(90deg, #c8901e, #ffd87a 45%, #f5c451 75%, transparent)" }} />
        <p style={{ color: "#9aa6c2", maxWidth: "32rem", lineHeight: 1.6, margin: 0 }}>
          {text.text}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "none",
            background: "#f5c451",
            color: "#06080f",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            padding: "0.8rem 1.6rem",
            cursor: "pointer",
            clipPath: "polygon(0 0, calc(100% - 0.45rem) 0, 100% 0.45rem, 100% 100%, 0.45rem 100%, 0 calc(100% - 0.45rem))",
          }}
        >
          {text.retry}
        </button>
      </body>
    </html>
  );
}
