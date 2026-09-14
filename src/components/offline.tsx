"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";

/**
 * Offline browsing.
 *
 * Registers the service worker (`public/sw.js`) and hands it the main
 * sections of the current locale, so they stay readable offline from the
 * first visit. Detail pages are only kept once viewed: all 133 up front
 * would weigh tens of megabytes.
 *
 * Without a network, a banner says so. In development nothing is
 * registered: a page cache got in the way of hot reload.
 */
const SECTIONS = ["", "/heroes", "/tier-list", "/items", "/emblems", "/draft", "/compare", "/game-modes", "/patch-notes", "/news"];

function subscribe(refresh: () => void) {
  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);
  return () => {
    window.removeEventListener("online", refresh);
    window.removeEventListener("offline", refresh);
  };
}

export function Offline() {
  const t = useT();
  const locale = useLocale();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((record) => {
        record.active?.postMessage({
          type: "prewarm",
          urls: SECTIONS.map((path) => `/${locale}${path}`),
        });
      })
      .catch(() => {
        /* without a service worker, the site simply works online */
      });
  }, [locale]);

  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3">
      <p
        role="status"
        className="bevel-sm pointer-events-auto flex items-center gap-2 border border-gold-500/40 bg-night-900/95 px-4 py-2 text-sm text-chalk-100 shadow-lg shadow-black/40 backdrop-blur-sm"
      >
        <WifiOff size={16} aria-hidden className="shrink-0 text-gold-400" />
        {t("offline.banner")}
      </p>
    </div>
  );
}
