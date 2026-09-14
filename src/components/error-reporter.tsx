"use client";

import { useEffect } from "react";

/**
 * Reports to the server log the errors no React boundary catches: an
 * exception in an event handler, a rejected promise, a third-party script.
 * Without it, an error like the `startTime` one only left a trace in the
 * visitor's console.
 *
 * Safeguards: errors from browser extensions are ignored (not our code), a
 * given error is sent only once, and a page never sends more than five — an
 * error loop must not flood the log.
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
      send(e.message || "error without message", e.error instanceof Error ? e.error.stack : undefined, e.filename);
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
