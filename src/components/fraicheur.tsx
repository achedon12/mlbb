import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { dateLongue, dateMesure, patchActuel } from "@/lib/fraicheur";
import { cn } from "@/lib/utils";

/**
 * « Mis a jour le 11 septembre 2026 · Patch 2.1.88 » : date du releve des taux
 * et patch en cours, affiches en tete des pages de donnees. Le lecteur sait de
 * quand datent les chiffres ; les moteurs y lisent une date visible, reprise
 * par le `dateModified` des donnees structurees.
 */
export function LigneFraicheur({
  langue,
  avant,
  className,
}: {
  langue: Langue;
  /** Texte place avant la date (« 132 heros classes »). */
  avant?: string;
  className?: string;
}) {
  const t = creerT(langue);
  return (
    <p className={cn("text-sm text-chalk-500", className)}>
      {avant && <>{avant} · </>}
      <time dateTime={dateMesure}>{t("pages.freshness.updatedOn", { date: dateLongue(langue) })}</time>
      {patchActuel && <> · {t("pages.freshness.patch", { v: patchActuel.version })}</>}
    </p>
  );
}
