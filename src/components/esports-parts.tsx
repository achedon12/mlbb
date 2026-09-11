import { Fragment, type ReactNode } from "react";
import type { Langue } from "@/i18n/config";
import type { T } from "@/i18n/traductions";
import { esportsSource, type SourceLabel, type SourcePage, type Status, type Tournament } from "@/lib/esports";
import { dateLongue, moisAnnee } from "@/lib/fraicheur";
import { cn } from "@/lib/utils";

/**
 * Pieces shared by the esports pages and the hero page block: date and prize
 * formatting, translated stage and round names, status badge and the
 * Liquipedia credit that every page showing its data must carry.
 */

/** Full date, month and year, or year alone: the precision the source gives. */
export function formatPartialDate(locale: Langue, value: string): string {
  if (value.length >= 10) return dateLongue(locale, value.slice(0, 10));
  if (value.length === 7) return moisAnnee(locale, `${value}-01`);
  return value;
}

export function tournamentDates(t: T, locale: Langue, tour: Tournament): string | null {
  const { startDate: start, endDate: end } = tour;
  if (start && end && start !== end) {
    return t("pages.esports.dates.range", { start: formatPartialDate(locale, start), end: formatPartialDate(locale, end) });
  }
  return start ? formatPartialDate(locale, start) : null;
}

/** "Sep 11, 2026": match dates, in UTC like the source's schedule. */
export function shortDate(locale: Langue, iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatPrize(locale: Langue, prize: { amount: number; currency: string }): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: prize.currency, maximumFractionDigits: 0 }).format(prize.amount);
}

/** Whole percentage for thresholds ("20%"), where a decimal would be noise. */
export function wholePercent(locale: Langue, value: number): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
}

/** Stage keys with a translation; any other stage keeps the source title. */
const TRANSLATED_STAGES = new Set([
  "wildcard",
  "playIn",
  "groupStage",
  "swissStage",
  "regularSeason",
  "knockoutStage",
  "playoffs",
  "mainEvent",
  "finals",
]);

export function stageName(t: T, key: string, title: string | null): string {
  return TRANSLATED_STAGES.has(key) ? t(`pages.esports.stages.${key}`) : (title ?? "");
}

/** Translated round or group name; the source text when the label is unknown. */
export function labelText(t: T, label: SourceLabel | null, fallback: string | null): string | null {
  if (!label) return fallback;
  const base = t(`pages.esports.rounds.${label.kind}`, { n: label.n ?? "", letter: label.letter ?? "" });
  return label.side ? t(`pages.esports.sides.${label.side}`, { round: base }) : base;
}

const STATUS_STYLE: Record<Status, string> = {
  live: "border-blood-500/60 text-blood-500",
  upcoming: "border-azure-500/60 text-azure-400",
  finished: "border-night-600 text-chalk-500",
};

export function StatusBadge({ status, t }: { status: Status; t: T }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        STATUS_STYLE[status],
      )}
    >
      {status === "live" && <span aria-hidden className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />}
      {t(`pages.esports.status.${status}`)}
    </span>
  );
}

/** Replaces `{name}` placeholders of a translated sentence with elements (links). */
export function interpolate(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/g).map((piece, i) => {
    const m = /^\{(\w+)\}$/.exec(piece);
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : piece}</Fragment>;
  });
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noreferrer nofollow" target="_blank" className="text-gold-400 hover:underline">
      {children}
    </a>
  );
}

function sourceAndLicense() {
  return {
    source: <ExternalLink href={esportsSource.url}>{esportsSource.name}</ExternalLink>,
    license: <ExternalLink href={esportsSource.licenseUrl}>{esportsSource.license}</ExternalLink>,
  };
}

/**
 * Full credit required by CC BY-SA: the source, the license and every source
 * page, with the date of the revision read.
 */
export function SourceCredit({
  t,
  locale,
  sources,
  className,
}: {
  t: T;
  locale: Langue;
  sources: SourcePage[];
  className?: string;
}) {
  const unique = sources.filter((s, i) => sources.findIndex((x) => x.url === s.url) === i);
  return (
    <div className={cn("border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500", className)}>
      <p>{interpolate(t("pages.esports.credit.text"), sourceAndLicense())}</p>
      <ul className="mt-2 space-y-1">
        {unique.map((s) => (
          <li key={s.url}>
            <ExternalLink href={s.url}>{s.title}</ExternalLink> ·{" "}
            {t("pages.esports.credit.revised", { date: dateLongue(locale, s.revision.slice(0, 10)) })}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One-line credit, for a block embedded in another page. */
export function ShortCredit({ t, tournaments, className }: { t: T; tournaments: Tournament[]; className?: string }) {
  const pages = tournaments.map((x, i) => (
    <Fragment key={x.slug}>
      {i > 0 && ", "}
      <ExternalLink href={x.sources[0]?.url ?? esportsSource.url}>{x.shortName}</ExternalLink>
    </Fragment>
  ));
  return (
    <p className={cn("text-xs leading-relaxed text-chalk-500", className)}>
      {interpolate(t("pages.esports.credit.short"), { ...sourceAndLicense(), pages })}
    </p>
  );
}
