"use client";

import { useEffect } from "react";
import Link from "@/components/lien";
import { useT } from "@/i18n/fournisseur";

/**
 * Frontiere d'erreur des pages.
 *
 * Une erreur imprevue dans un segment (donnee absente, appel qui echoue) est
 * rattrapee ici plutot que d'afficher l'ecran brut de Next. Le detail part vers
 * la console du serveur ; le lecteur, lui, garde une sortie propre et le moyen
 * de reessayer.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
    // On reporte l'incident au journal du serveur, sans bloquer l'affichage.
    const corps = JSON.stringify({
      message: error.message,
      chemin: window.location.pathname,
      digest: error.digest,
    });
    const envoye = navigator.sendBeacon?.("/api/journal", corps);
    if (!envoye) {
      fetch("/api/journal", { method: "POST", body: corps, keepalive: true }).catch(() => {});
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center">
      <p className="font-titre text-6xl font-bold text-sang-500">{t("erreur.oups")}</p>
      <h1 className="mt-4 font-titre text-2xl font-bold text-craie-100">{t("erreur.titre")}</h1>
      <p className="mt-4 leading-relaxed text-craie-500">{t("erreur.textePage")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="biseau-sm bg-or-500 px-6 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
        >
          {t("erreur.reessayer")}
        </button>
        <Link
          href="/"
          className="biseau-sm border border-nuit-600 px-6 py-3 font-semibold text-craie-100 transition-colors hover:border-or-500/60 hover:text-or-400"
        >
          {t("erreur.accueil")}
        </Link>
      </div>
    </div>
  );
}
