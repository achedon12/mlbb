import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { longDate, dateMeasure, patchCurrent } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/**
 * « Updated on 11 September 2026 · Patch 2.1.88 »: date of the rate snapshot
 * and current patch, shown at the top of data pages. Readers know how old the
 * figures are; search engines read a visible date, echoed by the
 * `dateModified` of the structured data.
 */
/**
 * The same facts as `FreshnessLine`, split into the small chips a page header
 * takes as `meta`: on a phone they wrap instead of stretching the header with
 * a third line of prose.
 */
export function freshnessFacts(locale: Locale, before?: string): React.ReactNode[] {
  const t = createT(locale);
  return [
    before,
    <time key="date" dateTime={dateMeasure}>
      {t("pages.freshness.updatedOn", { date: longDate(locale) })}
    </time>,
    patchCurrent ? t("pages.freshness.patch", { v: patchCurrent.version }) : null,
  ];
}

export function FreshnessLine({
  locale,
  before,
  className,
}: {
  locale: Locale;
  /** Text placed before the date (« 132 ranked heroes »). */
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
