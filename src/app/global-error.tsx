"use client";

import { useEffect } from "react";
import { LANGUES, LANGUE_DEFAUT, LOCALE_HTML, type Langue } from "@/i18n/config";

/**
 * Ses trois phrases, en dur : importer le catalogue ici le remettrait dans le
 * JavaScript de chaque page, cette frontiere etant chargee d'avance.
 */
const TEXTES: Record<Langue, { titre: string; texte: string; reessayer: string }> = {
  "fr": {
    "titre": "Une erreur est survenue",
    "texte": "Le site a rencontre un probleme inattendu. Reessayez dans un instant.",
    "reessayer": "Reessayer"
  },
  "en": {
    "titre": "An error has occurred",
    "texte": "The site encountered an unexpected problem. Try again in a moment.",
    "reessayer": "Try again"
  },
  "it": {
    "titre": "Si è verificato un errore",
    "texte": "Il sito ha riscontrato un problema imprevisto. Riprova tra un attimo.",
    "reessayer": "Riprova"
  },
  "es": {
    "titre": "Ha ocurrido un error",
    "texte": "El sitio encontró un problema inesperado. Inténtalo de nuevo en un momento.",
    "reessayer": "Intentar otra vez"
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
  const langue =
    (typeof window !== "undefined"
      ? LANGUES.find((l) => window.location.pathname.split("/")[1] === l)
      : undefined) ?? LANGUE_DEFAUT;
  const texte = TEXTES[langue];
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={LOCALE_HTML[langue]}>
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
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{texte.titre}</h1>
        <p style={{ color: "#7b88a6", maxWidth: "32rem", lineHeight: 1.6 }}>
          {texte.texte}
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
          {texte.reessayer}
        </button>
      </body>
    </html>
  );
}
