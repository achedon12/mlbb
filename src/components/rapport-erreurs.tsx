"use client";

import { useEffect } from "react";

/**
 * Remonte au journal du serveur les erreurs qu'aucune frontiere React
 * n'attrape : exception dans un gestionnaire d'evenement, promesse rejetee,
 * script tiers. Sans lui, une erreur comme celle de `startTime` ne laissait de
 * trace que dans la console du visiteur.
 *
 * Garde-fous : les erreurs des extensions du navigateur sont ignorees (ce
 * n'est pas notre code), une meme erreur n'est envoyee qu'une fois, et une page
 * n'en envoie jamais plus de cinq — une boucle d'erreurs ne doit pas inonder
 * le journal.
 */
const MAX_PAR_PAGE = 5;
const EXTENSION = /(chrome|moz|safari|safari-web)-extension:\/\//;

export function RapportErreurs() {
  useEffect(() => {
    const vues = new Set<string>();

    const envoyer = (message: string, pile?: string, fichier?: string) => {
      if (EXTENSION.test(`${pile ?? ""} ${fichier ?? ""}`)) return;
      const cle = `${message}|${pile?.split("\n")[1] ?? fichier ?? ""}`;
      if (vues.has(cle) || vues.size >= MAX_PAR_PAGE) return;
      vues.add(cle);
      const corps = JSON.stringify({
        message,
        pile: pile?.slice(0, 2000),
        chemin: window.location.pathname,
        version: process.env.VERSION_SITE,
        type: "globale",
      });
      if (!navigator.sendBeacon?.("/api/journal", corps)) {
        fetch("/api/journal", { method: "POST", body: corps, keepalive: true }).catch(() => {});
      }
    };

    const surErreur = (e: ErrorEvent) =>
      envoyer(e.message || "erreur sans message", e.error instanceof Error ? e.error.stack : undefined, e.filename);
    const surRejet = (e: PromiseRejectionEvent) => {
      const raison = e.reason;
      envoyer(raison instanceof Error ? raison.message : String(raison), raison instanceof Error ? raison.stack : undefined);
    };

    window.addEventListener("error", surErreur);
    window.addEventListener("unhandledrejection", surRejet);
    return () => {
      window.removeEventListener("error", surErreur);
      window.removeEventListener("unhandledrejection", surRejet);
    };
  }, []);

  return null;
}
