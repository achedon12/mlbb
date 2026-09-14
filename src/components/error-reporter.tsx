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
const MAX_BY_PAGE = 5;
const EXTENSION = /(chrome|moz|safari|safari-web)-extension:\/\//;

export function ErrorReporter() {
  useEffect(() => {
    const views = new Set<string>();

    const send = (message: string, stack?: string, file?: string) => {
      if (EXTENSION.test(`${stack ?? ""} ${file ?? ""}`)) return;
      const key = `${message}|${stack?.split("\n")[1] ?? file ?? ""}`;
      if (views.has(key) || views.size >= MAX_BY_PAGE) return;
      views.add(key);
      const body = JSON.stringify({
        message,
        pile: stack?.slice(0, 2000),
        chemin: window.location.pathname,
        version: process.env.VERSION_SITE,
        type: "globale",
      });
      if (!navigator.sendBeacon?.("/api/log", body)) {
        fetch("/api/log", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    };

    const onError = (e: ErrorEvent) =>
      send(e.message || "erreur sans message", e.error instanceof Error ? e.error.stack : undefined, e.filename);
    const onReject = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      send(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);

  return null;
}
