"use client";

import { useEffect } from "react";
import { creerT } from "@/i18n/traductions";
import { LANGUE_DEFAUT, LOCALE_HTML } from "@/i18n/config";

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
  const t = creerT(LANGUE_DEFAUT);
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={LOCALE_HTML[LANGUE_DEFAUT]}>
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
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{t("erreur.titre")}</h1>
        <p style={{ color: "#7b88a6", maxWidth: "32rem", lineHeight: 1.6 }}>
          {t("erreur.texte")}
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
          {t("erreur.reessayer")}
        </button>
      </body>
    </html>
  );
}
