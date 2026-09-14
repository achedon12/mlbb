"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";
import Link from "@/components/link";
import { BellRing, Minus, MonitorSmartphone, Star, TrendingDown, TrendingUp, X, type LucideIcon } from "lucide-react";
import { NotificationToggle, useNotificationSync } from "@/components/favourite-notifications";
import { subscribeToFavourites, toggleFavourite, serverFavourites, snapshotFavourites } from "@/lib/favourites";
import { heroesBySlug } from "@/lib/data-client";
import type { SummaryPatch } from "@/lib/patch-tracking";
import type { AdjustmentType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Note de portee : les favoris ne sont pas lies au compte de jeu — ils vivent
 * dans ce navigateur. Le dire clairement evite de croire qu'ils suivraient
 * d'un appareil a l'autre, ou qu'ils dependraient de la connexion.
 */
function NoteRange() {
  const t = useT();
  return (
    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-chalk-500">
      <MonitorSmartphone size={14} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        {t("favourites.intro")}
      </span>
    </p>
  );
}

const TREND: Record<AdjustmentType, { icon: LucideIcon; color: string }> = {
  buff: { icon: TrendingUp, color: "text-emerald-400" },
  nerf: { icon: TrendingDown, color: "text-blood-500" },
  adjust: { icon: Minus, color: "text-azure-400" },
};

/**
 * Favoris touches par le dernier patch : on sait d'un coup d'oeil lesquels
 * ont ete ameliores, affaiblis ou retouches, sans lire toutes les notes.
 */
function AlertPatch({ favourites, patch }: { favourites: readonly string[]; patch: SummaryPatch }) {
  const t = useT();
  const keys = favourites.filter((slug) => slug in patch.types);

  return (
    <div className="bevel mt-5 border border-gold-500/30 bg-night-900/60 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-chalk-100">
        <BellRing size={15} aria-hidden className="shrink-0 text-gold-400" />
        {t("favourites.alert.title", { version: patch.version })}
      </h3>
      {keys.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-chalk-500">
          {t("favourites.alert.none", { version: patch.version })}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {keys.map((slug) => {
            const type = patch.types[slug];
            const trend = type ? TREND[type] : null;
            const Icon = trend?.icon;
            return (
              <li key={slug} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                <Link
                  href={`/heroes/${slug}#stats`}
                  className="font-medium text-chalk-100 underline underline-offset-4 transition-colors hover:text-gold-400"
                >
                  {heroesBySlug[slug] ?? slug}
                </Link>
                <span className={cn("flex items-center gap-1 text-xs font-semibold", trend?.color ?? "text-chalk-400")}>
                  {Icon && <Icon size={13} aria-hidden />}
                  {type ? t(`patchHeroes.${type}`) : t("favourites.alert.changed")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
        <Link href={`/patch-notes/${patch.version}`} className="font-semibold text-gold-400 hover:text-gold-500">
          {t("patchHeroes.seePatch", { version: patch.version })} →
        </Link>
        <span>{t("favourites.alert.rss")}</span>
      </p>
    </div>
  );
}

/**
 * Liste des heros mis en favori, lue depuis le navigateur. `dernierPatch`, un
 * resume de quelques centaines d'octets, signale ceux que le patch a touches.
 * L'interrupteur des notifications de patch reste visible sans favori : on
 * peut s'abonner d'avance, ou se desabonner apres avoir tout retire.
 */
export function AccountFavourites({ lastPatch = null }: { lastPatch?: SummaryPatch | null }) {
  const t = useT();
  const favourites = useSyncExternalStore(subscribeToFavourites, snapshotFavourites, serverFavourites);
  useNotificationSync(favourites);

  if (favourites.length === 0) {
    return (
      <div>
        <p className="mt-6 text-sm leading-relaxed text-chalk-500">
          {t("favourites.nonePre")}
          <Link href="/heroes" className="text-gold-400 underline underline-offset-4">
            {t("favourites.noLink")}
          </Link>
          {t("favourites.nonePost")}
        </p>
        <NotificationToggle favourites={favourites} />
        <NoteRange />
      </div>
    );
  }

  return (
    <div>
      <p className="mt-6 text-sm text-chalk-400">
        {t("favourites.account", { n: favourites.length })}{" "}
        {favourites.length > 1 ? t("favourites.kept") : t("favourites.kept1")}.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {favourites.map((slug) => (
          <li key={slug} className="bevel-sm flex items-center border border-night-700 bg-night-900/60">
            <Link
              href={`/heroes/${slug}`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-chalk-100 transition-colors hover:text-gold-400"
            >
              <Star size={13} aria-hidden fill="currentColor" className="text-gold-500" />
              {heroesBySlug[slug] ?? slug}
            </Link>
            <button
              type="button"
              onClick={() => toggleFavourite(slug)}
              aria-label={t("favourites.remove", { nom: heroesBySlug[slug] ?? slug })}
              className="grid size-9 place-items-center text-chalk-500 transition-colors hover:text-blood-500"
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {lastPatch && <AlertPatch favourites={favourites} patch={lastPatch} />}
      <NotificationToggle favourites={favourites} />
      <NoteRange />
    </div>
  );
}
