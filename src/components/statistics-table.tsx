"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "@/components/link";
import { SearchField } from "@/components/search-field";
import { LightImage } from "@/components/light-image";
import { ChoiceUnique, classesChip } from "@/components/chip";
import { COLOR_TIER } from "@/components/ui";
import { useLocale, useT } from "@/i18n/provider";
import type { MeasuredRank } from "@/lib/measured-ranks";
import {
  pathCurve,
  pathStatistics,
  decodeRow,
  writeState,
  STATE_DEFAULT,
  filterRows,
  formatterRate,
  HEIGHT_CURVE,
  heroIcon,
  LANES,
  readState,
  orderInitial,
  POINTS_CURVE,
  ROLES,
  sortRows,
  type ColumnSort,
  type StateTable,
  type CompactRow,
  type RowStat,
} from "@/lib/statistics-table";
import { describeGap, formatGap, THRESHOLD_NOTABLE } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Rows whose icon loads immediately: those on the first screen. */
const FIRST = 8;

const notable = (gap: number) => Math.abs(gap) >= THRESHOLD_NOTABLE - 1e-9;
/** Class of a trend: green when rising, red when falling, nothing below the noise threshold. */
const direction = (gap: number) => (!notable(gap) ? undefined : gap > 0 ? "rising" : "falling");

/**
 * Statistics table, sortable and filterable.
 *
 * The server renders it in full, in the default order: search engines and
 * readers without JavaScript get every row. In the browser, sorting, filters
 * and search reorder those same rows, with no request. The state goes into
 * the URL after mount, like the hero catalogue: a sort can be shared, and the
 * rank links keep it.
 *
 * Cells have no class: `.stats-table` (globals.css) styles them by position,
 * otherwise the same utilities would repeat over 132 rows.
 */
export function StatisticsTable({
  compactRows,
  rank,
  ranks,
}: {
  /** Rows as tuples (`encodeRow`), decoded once here. */
  compactRows: CompactRow[];
  rank: MeasuredRank;
  ranks: readonly MeasuredRank[];
}) {
  const t = useT();
  const locale = useLocale();
  const rows = useMemo(() => compactRows.map(decodeRow), [compactRows]);
  const [state, setState] = useState<StateTable>(STATE_DEFAULT);
  const rate = useMemo(() => formatterRate(locale), [locale]);

  const rise = useRef(false);
  useEffect(() => {
    if (!rise.current) {
      rise.current = true;
      const lu = readState(new URLSearchParams(window.location.search));
      if (writeState(lu).toString()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- URL read after mount
        setState(lu);
        return;
      }
    }
    const suffix = writeState(state, new URLSearchParams(window.location.search)).toString();
    window.history.replaceState(null, "", suffix ? `?${suffix}` : window.location.pathname);
  }, [state]);

  const shown = useMemo(() => sortRows(filterRows(rows, state), state.sort, state.order), [rows, state]);
  const request = writeState(state).toString();
  const maj = (partial: Partial<StateTable>) => setState((e) => ({ ...e, ...partial }));
  const sort = (c: ColumnSort) =>
    setState((e) => ({ ...e, sort: c, order: e.sort !== c ? orderInitial(c) : e.order === "asc" ? "desc" : "asc" }));
  const header = { state, onSort: sort };

  return (
    <div>
      <div className="flex flex-col gap-4">
        <nav aria-label={t("measuredRanks.label")} className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="mr-1 w-20 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
            {t("measuredRanks.label")}
          </span>
          {ranks.map((r) => (
            <Link
              key={r}
              href={`${pathStatistics(r)}${request ? `?${request}` : ""}`}
              aria-current={r === rank ? "page" : undefined}
              className={classesChip(r === rank)}
            >
              {t(`measuredRanks.${r}`)}
            </Link>
          ))}
        </nav>
        <SearchField
          value={state.search}
          onChange={(search) => maj({ search })}
          label={t("pages.heroesList.search")}
          className="max-w-md"
        />
        <ChoiceUnique
          legend={t("pages.heroesList.role")}
          values={ROLES}
          active={state.role}
          onChange={(role) => maj({ role })}
          label={(r) => t(`roles.${r}`)}
        />
        <ChoiceUnique
          legend={t("pages.heroesList.position")}
          values={LANES}
          active={state.lane}
          onChange={(lane) => maj({ lane })}
          label={(l) => t(`lanes.${l}`)}
        />
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {t("pages.heroesList.account", { n: shown.length })}
        {shown.length !== rows.length && ` ${t("pages.heroesList.countOf", { total: rows.length })}`}
      </p>

      {/* Horizontal scrolling on mobile, hero name pinned on the left. The
          container is positioned: the cells' absolutely positioned .sr-only
          texts attach to it instead of widening the whole page. */}
      <div className="relative mt-3 overflow-x-auto border border-night-700/70">
        <table className="stats-table">
          <caption className="sr-only">
            {t("pages.statisticsTable.legend", { rank: t(`measuredRanks.${rank}`) })}
          </caption>
          <thead>
            <tr>
              <Header column="name" {...header}>
                {t("pages.statisticsTable.heroes")}
              </Header>
              <Header column="tier" {...header}>
                {t("pages.statisticsTable.tier")}
              </Header>
              <Header column="win" {...header}>
                {t("pages.statisticsTable.win")}
              </Header>
              <Header column="trend" {...header}>
                {t("pages.statisticsTable.gap")}
              </Header>
              <Header column="ban" {...header}>
                {t("pages.statisticsTable.ban")}
              </Header>
              <Header column="pick" {...header}>
                {t("pages.statisticsTable.pick")}
              </Header>
              <th scope="col">{t("pages.statisticsTable.curve")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <Row key={l.slug} row={l} first={i < FIRST} rate={rate} />
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  {t("pages.heroesList.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Sortable header: the button carries the action, `aria-sort` announces the current order. */
function Header({
  column,
  state,
  onSort,
  children,
}: {
  column: ColumnSort;
  state: StateTable;
  onSort: (c: ColumnSort) => void;
  children: React.ReactNode;
}) {
  const active = state.sort === column;
  const Icon = !active ? ArrowUpDown : state.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (state.order === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wide transition-colors hover:text-gold-400",
          active && "text-gold-400",
        )}
      >
        {children}
        <Icon size={12} aria-hidden className={active ? undefined : "opacity-40"} />
      </button>
    </th>
  );
}

function Row({ row: l, first, rate }: { row: RowStat; first: boolean; rate: (v: number) => string }) {
  const t = useT();
  const locale = useLocale();
  const evolution = l.start !== undefined && l.end !== undefined ? l.end - l.start : 0;

  return (
    <tr>
      <th scope="row">
        <Link href={`/heroes/${l.slug}`} prefetch={false}>
          <LightImage src={heroIcon(l.slug)} alt="" width={28} height={28} immediate={first} />
          <span className="min-w-0">
            <b>
              {l.name}
              {l.weak && (
                <span className="text-gold-400" title={t("pages.statisticsTable.weak")}>
                  {" *"}
                  <span className="sr-only">{t("pages.statisticsTable.weak")}</span>
                </span>
              )}
            </b>
            <small>
              {[l.roles.map((r) => t(`roles.${r}`)).join("/"), l.lanes.map((x) => t(`lanes.${x}`)).join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
        </Link>
      </th>
      <td>
        <span className={cn("stats-tier", COLOR_TIER[l.tier])}>{l.tier}</span>
      </td>
      <td>{rate(l.win)}</td>
      <td className={l.gap === undefined ? undefined : direction(l.gap)}>
        {l.gap === undefined ? (
          <span title={t("pages.statisticsTable.noMeasure")}>
            <span aria-hidden>—</span>
            <span className="sr-only">{t("pages.statisticsTable.noMeasure")}</span>
          </span>
        ) : notable(l.gap) ? (
          <>
            <span aria-hidden>{formatGap(l.gap, locale)}</span>
            <span className="sr-only">{describeGap(t, locale, l.gap, l.days ?? 7)}</span>
          </>
        ) : (
          formatGap(l.gap, locale)
        )}
      </td>
      <td>{rate(l.ban)}</td>
      <td>{rate(l.pick)}</td>
      <td>
        {l.curve && l.start !== undefined && l.end !== undefined ? (
          <svg
            viewBox={`0 0 ${POINTS_CURVE - 1} ${HEIGHT_CURVE}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={t("pages.statisticsTable.curveAria", { start: rate(l.start), end: rate(l.end) })}
            className={direction(evolution)}
          >
            <path d={pathCurve(l.curve)} />
          </svg>
        ) : (
          <span aria-hidden>—</span>
        )}
      </td>
    </tr>
  );
}
