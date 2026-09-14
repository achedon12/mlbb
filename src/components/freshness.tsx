import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { longDate, dateMeasure, patchCurrent } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/**
 * « Mis a jour le 11 septembre 2026 · Patch 2.1.88 » : date du releve des taux
 * et patch en cours, affiches en tete des pages de donnees. Le lecteur sait de
 * quand datent les chiffres ; les moteurs y lisent une date visible, reprise
 * par le `dateModified` des donnees structurees.
 */
export function FreshnessLine({
  locale,
  before,
  className,
}: {
  locale: Locale;
  /** Texte place avant la date (« 132 heros classes »). */
  before?: string;
  className?: string;
}) {
  const t = createT(locale);
  return (
    <p className={cn("text-sm text-chalk-500", className)}>
      {before && <>{before} · </>}
      <time dateTime={dateMeasure}>{t("pages.freshness.updatedOn", { date: longDate(locale) })}</time>
      {patchCurrent && <> · {t("pages.freshness.patch", { v: patchCurrent.version })}</>}
    </p>
  );
}
