import { Fragment, type ReactNode } from "react";
import { interpolate } from "@/components/esports-parts";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { sync } from "@/lib/data";
import { dateMeasure, longDate } from "@/lib/freshness";
import { fromWikis, pageSources, SOURCE_HOMES, SOURCE_NAMES, type PageSources, type SourceRef } from "@/lib/page-sources";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * « Sources » block at the bottom of a data page: what feeds each part of it
 * (with a link to the precise page read when there is one), the licence of
 * the texts taken from the wikis, the rights on the images, and the dates of
 * the last full sync and of the rate measurement. Quiet on purpose: small
 * muted text, after the content.
 */

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noopener noreferrer nofollow" target="_blank" className="text-gold-400 hover:underline">
      {children}
    </a>
  );
}

export function PageSourcesBlock({
  locale,
  of,
  children,
  className,
}: {
  locale: Locale;
  of: PageSources;
  /** A credit of the page's own, shown first (the notes of one patch). */
  children?: ReactNode;
  className?: string;
}) {
  const t = createT(locale);
  const { rows, dates } = pageSources(of);

  const source = (s: SourceRef) => {
    if (s.key === "site") return site.name;
    const name = <ExternalLink href={SOURCE_HOMES[s.key]}>{SOURCE_NAMES[s.key]}</ExternalLink>;
    return s.page
      ? interpolate(t("pages.sources.withPage"), { source: name, page: <ExternalLink href={s.page.href}>{s.page.label}</ExternalLink> })
      : name;
  };
  // Rows name one source or two.
  const list = (refs: SourceRef[]) =>
    refs.length === 2 ? interpolate(t("pages.sources.pair"), { a: source(refs[0]), b: source(refs[1]) }) : source(refs[0]);

  const stamps = [
    dates.includes("synced") && (
      <time key="synced" dateTime={sync.date}>
        {t("pages.sources.synced", { date: longDate(locale, sync.date) })}
      </time>
    ),
    dates.includes("measured") && (
      <time key="measured" dateTime={dateMeasure}>
        {t("pages.sources.measured", { date: longDate(locale, dateMeasure) })}
      </time>
    ),
  ].filter(Boolean);

  return (
    <aside
      aria-label={t("pages.sources.title")}
      className={cn("mt-12 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500", className)}
    >
      {children}
      <p className={cn("font-semibold uppercase tracking-wide text-chalk-400", children ? "mt-4" : undefined)}>
        {t("pages.sources.title")}
      </p>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.topic}>
              {interpolate(t(`pages.sources.rows.${r.topic}`), { sources: list(r.sources), site: site.name })}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2">
        {fromWikis(rows) && <>{t("pages.sources.licence")} </>}
        {t("pages.sources.images")}
      </p>
      {stamps.length > 0 && (
        <p className="mt-1">
          {stamps.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && " · "}
              {s}
            </Fragment>
          ))}
        </p>
      )}
    </aside>
  );
}
