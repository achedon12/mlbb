"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";

/**
 * Consultation hors ligne.
 *
 * Enregistre le service worker (`public/sw.js`) et lui confie les rubriques
 * principales de la langue courante, pour qu'elles restent lisibles sans
 * connexion des la premiere visite. Les fiches ne sont gardees qu'une fois
 * consultees : les 133 d'avance peseraient des dizaines de megaoctets.
 *
 * Sans reseau, un bandeau le signale. En developpement, rien n'est
 * enregistre : un cache de pages generait le rechargement a chaud.
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
          type: "prechauffer",
          urls: SECTIONS.map((path) => `/${locale}${path}`),
        });
      })
      .catch(() => {
        /* sans service worker, le site fonctionne simplement en ligne */
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
