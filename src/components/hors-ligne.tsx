"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useLangue, useT } from "@/i18n/fournisseur";

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
const RUBRIQUES = ["", "/heroes", "/tier-list", "/items", "/emblems", "/draft", "/compare", "/game-modes", "/patch-notes", "/news"];

function abonner(rafraichir: () => void) {
  window.addEventListener("online", rafraichir);
  window.addEventListener("offline", rafraichir);
  return () => {
    window.removeEventListener("online", rafraichir);
    window.removeEventListener("offline", rafraichir);
  };
}

export function HorsLigne() {
  const t = useT();
  const langue = useLangue();
  const enLigne = useSyncExternalStore(abonner, () => navigator.onLine, () => true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((enregistrement) => {
        enregistrement.active?.postMessage({
          type: "prechauffer",
          urls: RUBRIQUES.map((chemin) => `/${langue}${chemin}`),
        });
      })
      .catch(() => {
        /* sans service worker, le site fonctionne simplement en ligne */
      });
  }, [langue]);

  if (enLigne) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3">
      <p
        role="status"
        className="biseau-sm pointer-events-auto flex items-center gap-2 border border-or-500/40 bg-nuit-900/95 px-4 py-2 text-sm text-craie-100 shadow-lg shadow-black/40 backdrop-blur-sm"
      >
        <WifiOff size={16} aria-hidden className="shrink-0 text-or-400" />
        {t("horsLigne.bandeau")}
      </p>
    </div>
  );
}
