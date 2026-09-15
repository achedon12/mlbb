import { Fragment } from "react";
import { ItemIcon } from "@/components/item-sheet";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { heroesBySlug } from "@/lib/data";
import { percentage } from "@/lib/freshness";
import type { SummaryRank, UsageHero } from "@/lib/usage-builds";

/**
 * Blocks shared by the item, emblem and spell pages, rendered on the server:
 * tables readable without JavaScript, and by search engines.
 */

const nameOf = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
const portraitOf = (slug: string) => {
  const h = heroesBySlug.get(slug);
  return h?.images.icon ?? h?.images.portrait ?? null;
};
/** The link opens the builds tab of the hero page directly. */
const linkBuilds = (slug: string) => `/heroes/${slug}#builds`;
const rate = (locale: Locale, v: number | null) => (v === null ? "—" : percentage(locale, v));

/** Cell spacing, set once on the table rather than on every cell. */
const TABLE =
  "w-full text-sm [&_td]:py-2 [&_td]:pr-3 [&_td:last-child]:pr-0 [&_th]:py-2 [&_th]:pr-3 [&_th:last-child]:pr-0 [&_th]:font-medium";
const HEADER = "border-b border-night-700 text-left text-xs uppercase tracking-wide text-chalk-500";

/**
 * Heroes who take the choice: position, share of matches and win rate.
 * Beyond `limit`, the rest become a plain list of links.
 */
export function TableUsage({
  rows,
  legend,
  t,
  locale,
  limit = 15,
}: {
  rows: UsageHero[];
  legend: string;
  t: T;
  locale: Locale;
  limit?: number;
}) {
  const rest = rows.slice(limit);
  return (
    <>
      <div className="relative overflow-x-auto">
        {/* Cell classes set once on the table: each row stays light. */}
        <table className={TABLE}>
          <caption className="sr-only">{legend}</caption>
          <thead>
            <tr className={HEADER}>
              <th scope="col">{t("pages.sheets.heroes")}</th>
              <th scope="col" className="hidden sm:table-cell">{t("builds.position")}</th>
              <th scope="col" className="text-right">{t("pages.sheets.share")}</th>
              <th scope="col" className="text-right">{t("pages.heroDetail.stat.winRate")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-night-800 tabular-nums text-chalk-100">
            {rows.slice(0, limit).map((l) => (
              <tr key={l.slug}>
                <td>
                  <Link href={linkBuilds(l.slug)} className="group flex items-center gap-2.5">
                    <HeroPortrait source={portraitOf(l.slug)} name={nameOf(l.slug)} size="small" decorative />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-chalk-100 group-hover:text-gold-400">
                        {nameOf(l.slug)}
                      </span>
                      {/* On mobile, the position goes under the name rather than in its own column. */}
                      <span className="block text-xs text-chalk-500 sm:hidden">{t(`lanes.${l.lane}`)}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden text-chalk-300 sm:table-cell">{t(`lanes.${l.lane}`)}</td>
                <td className="text-right">{rate(locale, l.selection)}</td>
                <td className="text-right">{rate(locale, l.win)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rest.length > 0 && (
        <p className="mt-4 text-sm leading-relaxed text-chalk-500">
          {t("pages.sheets.also")}{" "}
          {rest.map((l, i) => (
            <Fragment key={l.slug}>
              {i > 0 && ", "}
              <Link href={linkBuilds(l.slug)} className="text-chalk-300 underline-offset-4 hover:text-gold-400 hover:underline">
                {nameOf(l.slug)}
              </Link>
            </Fragment>
          ))}
        </p>
      )}
    </>
  );
}

/** One row per rank: how many heroes take the choice, which one leads, and the average rate. */
export function TableRanks({
  summary,
  legend,
  t,
  locale,
}: {
  summary: SummaryRank[];
  legend: string;
  t: T;
  locale: Locale;
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className={TABLE}>
        <caption className="sr-only">{legend}</caption>
        <thead>
          <tr className={HEADER}>
            <th scope="col">{t("measuredRanks.label")}</th>
            <th scope="col" className="text-right">{t("pages.sheets.heroCount")}</th>
            <th scope="col">{t("pages.sheets.leading")}</th>
            <th scope="col" className="text-right">{t("pages.sheets.avgWin")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night-800 tabular-nums text-chalk-100">
          {summary.map((r) => (
            <tr key={r.rank}>
              <th scope="row" className="text-left text-chalk-300">
                {t(`measuredRanks.${r.rank}`)}
              </th>
              <td className="text-right">{r.heroes}</td>
              <td>
                {r.first ? (
                  <Link href={linkBuilds(r.first.slug)} className="text-chalk-100 hover:text-gold-400">
                    {nameOf(r.first.slug)}
                  </Link>
                ) : (
                  <span className="text-chalk-500">—</span>
                )}
              </td>
              <td className="text-right">{rate(locale, r.win)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface EntryPart {
  key: string;
  name: string;
  image: string | null;
  /** Share in %. */
  part: number;
  href?: string;
}

/** Associated choices (talents, spells, emblems), each with its share as a bar. */
export function PartsChoice({ entries, locale }: { entries: EntryPart[]; locale: Locale }) {
  return (
    <ul className="space-y-3">
      {entries.map((e) => (
        <li key={e.key} className="flex items-center gap-2.5">
          <ItemIcon image={e.image} size={28} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              {e.href ? (
                <Link href={e.href} className="truncate text-chalk-100 underline-offset-4 hover:text-gold-400 hover:underline">
                  {e.name}
                </Link>
              ) : (
                <span className="truncate text-chalk-100">{e.name}</span>
              )}
              <span className="shrink-0 tabular-nums text-chalk-300">{percentage(locale, e.part)}</span>
            </div>
            <span aria-hidden className="mt-1 block h-1 bg-night-700">
              <span className="block h-full bg-gold-400" style={{ width: `${Math.min(100, e.part)}%` }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Grid of links to neighbouring pages (items of the same category, other emblems, other spells),
 * or, `ordered`, to a ranking (heroes who build an item the most).
 */
export function ListLinks({
  links,
  ordered = false,
}: {
  links: { href: string; name: string; image: string | null; detail?: string }[];
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="bevel-sm group flex h-full items-center gap-2 border border-night-700/70 bg-night-900/60 p-2 transition-colors hover:border-gold-500/60"
          >
            <ItemIcon image={l.image} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-sm text-chalk-100 group-hover:text-gold-400">{l.name}</span>
              {l.detail && <span className="block text-xs tabular-nums text-gold-400">{l.detail}</span>}
            </span>
          </Link>
        </li>
      ))}
    </List>
  );
}
