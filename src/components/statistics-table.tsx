"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/link";
import { CardsTable, type CardsColumn } from "@/components/cards-table";
import { Pager } from "@/components/pager";
import { SearchField } from "@/components/search-field";
import { LightImage } from "@/components/light-image";
import { ChoiceUnique, LinkChip } from "@/components/chip";
import { ChipActive, FilterBar } from "@/components/filter-bar";
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
import { imageLane, imageRank, imageRole } from "@/lib/emblems";
import { pageHref, paging, pathWithoutPage, slicePage, SIZE_ROWS_CARDS } from "@/lib/pager";
import { describeGap, formatGap, THRESHOLD_NOTABLE } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** Rows whose icon loads immediately: those on the first screen. */
const FIRST = 8;

const notable = (gap: number) => Math.abs(gap) >= THRESHOLD_NOTABLE - 1e-9;
/** Class of a trend: green when rising, red when falling, nothing below the noise threshold. */
const direction = (gap: number) => (!notable(gap) ? undefined : gap > 0 ? "rising" : "falling");

/**
 * Statistics table, sortable, filterable and paged.
 *
 * The server renders the current page in the default order: search engines
 * and readers without JavaScript get real rows, and the other pages are one
 * `/statistics/page/n` link away, prerendered like the first. In the browser,
 * sorting, filters and search reorder those same rows with no request, and
 * the page goes back to the first one whenever the view changes — a page 4 of
 * a table that now holds nine rows would show nothing.
 *
 * The state goes into the URL after mount, like the hero catalogue: a sort
 * can be shared, and the rank links keep it.
 *
 * Cells have no class: `.cards-table` and `.stats-table` (globals.css) style
 * them by column, otherwise the same utilities would repeat over 133 rows.
 */
export function StatisticsTable({
  compactRows,
  rank,
  ranks,
  page: pageServer = 1,
}: {
  /** Rows as tuples (`encodeRow`), decoded once here. */
  compactRows: CompactRow[];
  rank: MeasuredRank;
  ranks: readonly MeasuredRank[];
  /** Page read from the address by the server, so both renders agree. */
  page?: number;
}) {
  const t = useT();
  const locale = useLocale();
  const rows = useMemo(() => compactRows.map(decodeRow), [compactRows]);
  const [state, setState] = useState<StateTable>(STATE_DEFAULT);
  const [page, setPage] = useState(pageServer);
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
    // Sort and filters stay in the query, the page is a path segment: the
    // address written here is the one the pager's link already held.
    const params = writeState(state, new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", pageHref(pathWithoutPage(window.location.pathname), params, page));
  }, [state, page]);

  const shown = useMemo(() => sortRows(filterRows(rows, state), state.sort, state.order), [rows, state]);
  const view = paging(shown.length, page, SIZE_ROWS_CARDS);
  const slice = slicePage(shown, view.page, SIZE_ROWS_CARDS);
  const request = writeState(state).toString();
  /* A change of view starts again at the first page: the fourth page of a
     three-page result would be empty. */
  const maj = (partial: Partial<StateTable>) => {
    setState((e) => ({ ...e, ...partial }));
    setPage(1);
  };
  const sort = (c: string) => {
    setState((e) => ({
      ...e,
      sort: c as ColumnSort,
      order: e.sort !== c ? orderInitial(c as ColumnSort) : e.order === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };

  const columns: CardsColumn<RowStat>[] = [
    {
      key: "name",
      label: t("pages.statisticsTable.heroes"),
      head: true,
      sortable: true,
      cell: (l, i) => <Identity row={l} first={i < FIRST} />,
    },
    {
      key: "tier",
      label: t("pages.statisticsTable.tier"),
      sortable: true,
      cell: (l) => <span className={cn("stats-tier", COLOR_TIER[l.tier])}>{l.tier}</span>,
    },
    { key: "win", label: t("pages.statisticsTable.win"), sortable: true, cell: (l) => rate(l.win) },
    {
      key: "trend",
      label: t("pages.statisticsTable.gap"),
      sortable: true,
      cell: (l) => <Trend row={l} />,
    },
    { key: "ban", label: t("pages.statisticsTable.ban"), sortable: true, cell: (l) => rate(l.ban) },
    { key: "pick", label: t("pages.statisticsTable.pick"), sortable: true, cell: (l) => rate(l.pick) },
    {
      key: "curve",
      label: t("pages.statisticsTable.curve"),
      // The card already shows the week's change and the current rate: a
      // thirty-day drawing two centimetres wide would add nothing there.
      wideOnly: true,
      cell: (l) => <Curve row={l} rate={rate} />,
    },
  ];

  return (
    <div>
      <FilterBar
        search={
          <SearchField
            value={state.search}
            onChange={(search) => maj({ search })}
            label={t("pages.heroesList.search")}
            dense
          />
        }
        active={
          <>
            {rank !== "all" && (
              <ChipActive
                key="rank"
                label={t(`measuredRanks.${rank}`)}
                emblem={imageRank(rank) ?? undefined}
                href={`${pathStatistics("all")}${request ? `?${request}` : ""}`}
              />
            )}
            {state.role && (
              <ChipActive
                key="role"
                label={t(`roles.${state.role}`)}
                emblem={imageRole(state.role)}
                onRemove={() => maj({ role: null })}
              />
            )}
            {state.lane && (
              <ChipActive key="lane" label={t(`lanes.${state.lane}`)} emblem={imageLane(state.lane)} onRemove={() => maj({ lane: null })} />
            )}
          </>
        }
        count={
          <span aria-live="polite">
            {t("pages.heroesList.account", { n: shown.length })}
            {shown.length !== rows.length && ` ${t("pages.heroesList.countOf", { total: rows.length })}`}
          </span>
        }
      >
        <nav aria-label={t("measuredRanks.label")} className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="mr-1 w-20 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
            {t("measuredRanks.label")}
          </span>
          {ranks.map((r) => (
            <LinkChip
              key={r}
              href={`${pathStatistics(r)}${request ? `?${request}` : ""}`}
              current={r === rank}
              emblem={imageRank(r) ?? undefined}
              label={t(`measuredRanks.${r}`)}
            />
          ))}
        </nav>
        <ChoiceUnique
          legend={t("pages.heroesList.role")}
          values={ROLES}
          active={state.role}
          onChange={(role) => maj({ role })}
          label={(r) => t(`roles.${r}`)}
          emblem={imageRole}
        />
        <ChoiceUnique
          legend={t("pages.heroesList.position")}
          values={LANES}
          active={state.lane}
          onChange={(lane) => maj({ lane })}
          label={(l) => t(`lanes.${l}`)}
          emblem={imageLane}
        />
      </FilterBar>

      {/* No horizontal scroller any more: below `sm` the rows are cards. */}
      <div className="mt-3 sm:border sm:border-night-700/70">
        <CardsTable
          className="stats-table"
          caption={t("pages.statisticsTable.legend", { rank: t(`measuredRanks.${rank}`) })}
          columns={columns}
          rows={slice}
          rowKey={(l) => l.slug}
          sort={state.sort}
          order={state.order}
          onSort={sort}
          empty={t("pages.heroesList.none")}
          t={t}
        />
      </div>
      <Pager
        paging={view}
        href={(n) => pageHref(pathStatistics(rank), request, n)}
        onNavigate={setPage}
        t={t}
      />
    </div>
  );
}

/** Hero cell: icon, name, then roles and lanes with the role's own emblem. */
function Identity({ row: l, first }: { row: RowStat; first: boolean }) {
  const t = useT();
  const emblem = l.roles[0] ? imageRole(l.roles[0]) : undefined;
  return (
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
          {/* Emblem of the main role: recognised before the word is read, and
              named by the text right after it. */}
          {emblem && <LightImage src={emblem} alt="" width={14} height={14} immediate={first} />}
          <span>
            {[l.roles.map((r) => t(`roles.${r}`)).join("/"), l.lanes.map((x) => t(`lanes.${x}`)).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </small>
      </span>
    </Link>
  );
}

/** Week's change, coloured when it passes the noise threshold. */
function Trend({ row: l }: { row: RowStat }) {
  const t = useT();
  const locale = useLocale();
  if (l.gap === undefined) {
    return (
      <span title={t("pages.statisticsTable.noMeasure")}>
        <span aria-hidden>—</span>
        <span className="sr-only">{t("pages.statisticsTable.noMeasure")}</span>
      </span>
    );
  }
  if (!notable(l.gap)) return <>{formatGap(l.gap, locale)}</>;
  return (
    <span className={direction(l.gap)}>
      <span aria-hidden>{formatGap(l.gap, locale)}</span>
      <span className="sr-only">{describeGap(t, locale, l.gap, l.days ?? 7)}</span>
    </span>
  );
}

/** Thirty-day sparkline, drawn from the compact scale sent with the row. */
function Curve({ row: l, rate }: { row: RowStat; rate: (v: number) => string }) {
  const t = useT();
  if (!l.curve || l.start === undefined || l.end === undefined) return <span aria-hidden>—</span>;
  return (
    <svg
      viewBox={`0 0 ${POINTS_CURVE - 1} ${HEIGHT_CURVE}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t("pages.statisticsTable.curveAria", { start: rate(l.start), end: rate(l.end) })}
      className={direction(l.end - l.start)}
    >
      <path d={pathCurve(l.curve)} />
    </svg>
  );
}
