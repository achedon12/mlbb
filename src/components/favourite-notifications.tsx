"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import Link from "@/components/link";
import { useLocale, useT } from "@/i18n/provider";
import { enable, disable, stateCurrent, sync, type NotificationState } from "@/lib/push-client";
import { cn } from "@/lib/utils";

/**
 * Notifications de patch pour les favoris : l'interrupteur de la liste des
 * favoris et la cloche des fiches. La fonction reste invisible tant que le
 * serveur n'a pas ses cles, et la permission n'est demandee qu'au clic.
 */

type State = NotificationState | "loading";

const MESSAGES: Partial<Record<State, string>> = {
  active: "favourites.push.active",
  inactive: "favourites.push.inactive",
  refused: "favourites.push.denied",
  "unsupported": "favourites.push.unsupported",
  "ios-install": "favourites.push.iosInstall",
};

/**
 * Repercute chaque changement de favoris au serveur quand ce navigateur est
 * abonne. A monter la ou les favoris changent, meme sans interrupteur : sans
 * abonnement, ce n'est qu'une lecture du stockage local.
 */
export function useNotificationSync(favourites: readonly string[]) {
  const locale = useLocale();
  useEffect(() => sync(locale, favourites), [locale, favourites]);
}

function useNotifications(favourites: readonly string[]) {
  const locale = useLocale();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let rise = true;
    stateCurrent()
      .then((e) => rise && setState(e))
      .catch(() => rise && setState("unavailable"));
    return () => {
      rise = false;
    };
  }, []);

  const toggle = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      setState(state === "active" ? await disable() : await enable(locale, favourites));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [state, locale, favourites]);

  return { state, busy, error, toggle };
}

/** Interrupteur complet, sous la liste des favoris. */
export function NotificationToggle({ favourites }: { favourites: readonly string[] }) {
  const t = useT();
  const id = useId();
  const { state, busy, error, toggle } = useNotifications(favourites);
  if (state === "loading" || state === "unavailable") return null;

  const active = state === "active";
  const blocked = state === "unsupported" || state === "ios-install";
  const key = busy ? "favourites.push.pending" : error ? "favourites.push.error" : MESSAGES[state];
  const Icon = active ? BellRing : Bell;

  return (
    <div className="bevel mt-5 border border-night-700/70 bg-night-900/60 p-4">
      <div className="flex items-start gap-3">
        <Icon size={16} aria-hidden className={cn("mt-0.5 shrink-0", active ? "text-gold-400" : "text-chalk-500")} />
        <div className="min-w-0 flex-1">
          <p id={`${id}-titre`} className="text-sm font-semibold text-chalk-100">
            {t("favourites.push.title")}
          </p>
          <p id={`${id}-desc`} className="mt-1 text-xs leading-relaxed text-chalk-500">
            {t("favourites.push.description")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-labelledby={`${id}-titre`}
          aria-describedby={`${id}-desc ${id}-etat`}
          aria-busy={busy}
          disabled={blocked || busy}
          onClick={toggle}
          className="-my-2.5 -mr-1.5 grid h-11 w-14 shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden
            className={cn(
              "relative block h-6 w-11 border transition-colors",
              active ? "border-gold-500 bg-gold-500/25" : "border-night-600 bg-night-800",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0 block size-4.5 transition-transform motion-reduce:transition-none",
                active ? "translate-x-5.5 bg-gold-400" : "translate-x-0.5 bg-chalk-500",
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
          error || state === "refused" ? "text-blood-500" : active ? "text-emerald-400" : "text-chalk-400",
        )}
      >
        {key ? t(key) : ""}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-chalk-500">
        {t("favourites.push.life")}{" "}
        <Link href="/privacy" className="text-gold-400 underline underline-offset-4 hover:text-gold-500">
          {t("favourites.push.privacyLink")}
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
export function NotificationBell({ favourites }: { favourites: readonly string[] }) {
  const t = useT();
  const { state, busy, error, toggle } = useNotifications(favourites);
  const [click, setClick] = useState(false);
  if (state === "loading" || state === "unavailable" || state === "unsupported") return null;

  const active = state === "active";
  const key = !click ? undefined : busy ? "favourites.push.pending" : error ? "favourites.push.error" : MESSAGES[state];
  const Icon = active ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        aria-pressed={active}
        aria-label={t("favourites.push.title")}
        title={t("favourites.push.title")}
        aria-busy={busy}
        disabled={busy}
        onClick={() => {
          setClick(true);
          if (state !== "ios-install") void toggle();
        }}
        className={cn(
          "bevel-sm grid size-9.5 shrink-0 place-items-center border transition-colors disabled:opacity-60",
          active
            ? "border-gold-500 bg-gold-500/10 text-gold-400"
            : "border-night-700 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400",
        )}
      >
        <Icon size={15} aria-hidden />
      </button>
      {/* Toujours presente pour etre annoncee ; masquee (hors flux) tant qu'elle est vide. */}
      <p
        role="status"
        className={cn(
          "order-last basis-full text-xs leading-relaxed",
          error || state === "refused" ? "text-blood-500" : "text-chalk-400",
          !key && "sr-only",
        )}
      >
        {key ? t(key) : ""}
      </p>
    </>
  );
}
