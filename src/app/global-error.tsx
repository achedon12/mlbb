"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
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
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Une erreur est survenue</h1>
        <p style={{ color: "#7b88a6", maxWidth: "32rem", lineHeight: 1.6 }}>
          Le site a rencontre un probleme inattendu. Reessayez dans un instant.
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
          Reessayer
        </button>
      </body>
    </html>
  );
}
