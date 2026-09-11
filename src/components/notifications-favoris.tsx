"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import Link from "@/components/lien";
import { useLangue, useT } from "@/i18n/fournisseur";
import { activer, desactiver, etatCourant, synchroniser, type EtatNotifications } from "@/lib/push-client";
import { cn } from "@/lib/utils";

/**
 * Notifications de patch pour les favoris : l'interrupteur de la liste des
 * favoris et la cloche des fiches. La fonction reste invisible tant que le
 * serveur n'a pas ses cles, et la permission n'est demandee qu'au clic.
 */

type Etat = EtatNotifications | "chargement";

const MESSAGES: Partial<Record<Etat, string>> = {
  actif: "favoris.push.actif",
  inactif: "favoris.push.inactif",
  refuse: "favoris.push.refuse",
  "non-supporte": "favoris.push.nonSupporte",
  "ios-installer": "favoris.push.iosInstaller",
};

/**
 * Repercute chaque changement de favoris au serveur quand ce navigateur est
 * abonne. A monter la ou les favoris changent, meme sans interrupteur : sans
 * abonnement, ce n'est qu'une lecture du stockage local.
 */
export function useSynchroNotifications(favoris: readonly string[]) {
  const langue = useLangue();
  useEffect(() => synchroniser(langue, favoris), [langue, favoris]);
}

function useNotifications(favoris: readonly string[]) {
  const langue = useLangue();
  const [etat, setEtat] = useState<Etat>("chargement");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let monte = true;
    etatCourant()
      .then((e) => monte && setEtat(e))
      .catch(() => monte && setEtat("indisponible"));
    return () => {
      monte = false;
    };
  }, []);

  const basculer = useCallback(async () => {
    setOccupe(true);
    setErreur(false);
    try {
      setEtat(etat === "actif" ? await desactiver() : await activer(langue, favoris));
    } catch {
      setErreur(true);
    } finally {
      setOccupe(false);
    }
  }, [etat, langue, favoris]);

  return { etat, occupe, erreur, basculer };
}

/** Interrupteur complet, sous la liste des favoris. */
export function BasculeNotifications({ favoris }: { favoris: readonly string[] }) {
  const t = useT();
  const id = useId();
  const { etat, occupe, erreur, basculer } = useNotifications(favoris);
  if (etat === "chargement" || etat === "indisponible") return null;

  const actif = etat === "actif";
  const bloque = etat === "non-supporte" || etat === "ios-installer";
  const cle = occupe ? "favoris.push.enCours" : erreur ? "favoris.push.erreur" : MESSAGES[etat];
  const Icone = actif ? BellRing : Bell;

  return (
    <div className="biseau mt-5 border border-nuit-700/70 bg-nuit-900/60 p-4">
      <div className="flex items-start gap-3">
        <Icone size={16} aria-hidden className={cn("mt-0.5 shrink-0", actif ? "text-or-400" : "text-craie-500")} />
        <div className="min-w-0 flex-1">
          <p id={`${id}-titre`} className="text-sm font-semibold text-craie-100">
            {t("favoris.push.titre")}
          </p>
          <p id={`${id}-desc`} className="mt-1 text-xs leading-relaxed text-craie-500">
            {t("favoris.push.description")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={actif}
          aria-labelledby={`${id}-titre`}
          aria-describedby={`${id}-desc ${id}-etat`}
          aria-busy={occupe}
          disabled={bloque || occupe}
          onClick={basculer}
          className="-my-2.5 -mr-1.5 grid h-11 w-14 shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden
            className={cn(
              "relative block h-6 w-11 border transition-colors",
              actif ? "border-or-500 bg-or-500/25" : "border-nuit-600 bg-nuit-800",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0 block size-4.5 transition-transform motion-reduce:transition-none",
                actif ? "translate-x-5.5 bg-or-400" : "translate-x-0.5 bg-craie-500",
              )}
            />
          </span>
        </button>
      </div>
      <p
        id={`${id}-etat`}
        role="status"
        className={cn(
          "mt-2 text-xs leading-relaxed",
          erreur || etat === "refuse" ? "text-sang-500" : actif ? "text-emerald-400" : "text-craie-400",
        )}
      >
        {cle ? t(cle) : ""}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-craie-500">
        {t("favoris.push.vie")}{" "}
        <Link href="/privacy" className="text-or-400 underline underline-offset-4 hover:text-or-500">
          {t("favoris.push.lienConfidentialite")}
        </Link>
      </p>
    </div>
  );
}

/**
 * Cloche compacte, a cote du bouton de favori d'une fiche. Elle agit sur les
 * notifications de tous les favoris, pas du seul heros. Le message d'etat
 * n'apparait qu'apres un clic, sur sa propre ligne en fin de rangee.
 */
export function ClocheNotifications({ favoris }: { favoris: readonly string[] }) {
  const t = useT();
  const { etat, occupe, erreur, basculer } = useNotifications(favoris);
  const [clic, setClic] = useState(false);
  if (etat === "chargement" || etat === "indisponible" || etat === "non-supporte") return null;

  const actif = etat === "actif";
  const cle = !clic ? undefined : occupe ? "favoris.push.enCours" : erreur ? "favoris.push.erreur" : MESSAGES[etat];
  const Icone = actif ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        aria-pressed={actif}
        aria-label={t("favoris.push.titre")}
        title={t("favoris.push.titre")}
        aria-busy={occupe}
        disabled={occupe}
        onClick={() => {
          setClic(true);
          if (etat !== "ios-installer") void basculer();
        }}
        className={cn(
          "biseau-sm grid size-9.5 shrink-0 place-items-center border transition-colors disabled:opacity-60",
          actif
            ? "border-or-500 bg-or-500/10 text-or-400"
            : "border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
        )}
      >
        <Icone size={15} aria-hidden />
      </button>
      {/* Toujours presente pour etre annoncee ; masquee (hors flux) tant qu'elle est vide. */}
      <p
        role="status"
        className={cn(
          "order-last basis-full text-xs leading-relaxed",
          erreur || etat === "refuse" ? "text-sang-500" : "text-craie-400",
          !cle && "sr-only",
        )}
      >
        {cle ? t(cle) : ""}
      </p>
    </>
  );
}
