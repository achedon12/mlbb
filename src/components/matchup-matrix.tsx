"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Link2, Plus, RotateCcw, X } from "lucide-react";
import { HeroSelector, HeroThumb, type HeroPickable } from "@/components/hero-picker";
import Link from "@/components/link";
import { ChoiceRank } from "@/components/rank-picker";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { trackShare } from "@/lib/analytics";
import {
  gapOf,
  matchupsUrl,
  measuredDuels,
  readMatrix,
  SIZE_SIDE,
  writeMatrix,
  type MatchupsRank,
} from "@/lib/matchups";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { pathPair } from "@/lib/pairs";
import { formatGap } from "@/lib/trends";
import { cn } from "@/lib/utils";

/**
 * Matchup matrix: your heroes in rows, the opponents in columns, each cell
 * the measured win-rate gap of the row hero against the column hero. The
 * roster ships with the page, the chosen rank's duels separately
 * (`/matchups/<rank>.json`), once per visit. Lineups and rank go through the
 * URL (`?a=…&b=…&rang=…`), read after mount: the page stays static, and a
 * matrix is shared by its link.
 */

/** Requests already started, per rank: coming back to a rank reloads nothing. */
const requests = new Map<MeasuredRank, Promise<MatchupsRank>>();

function loadMatchups(rank: MeasuredRank): Promise<MatchupsRank> {
  let request = requests.get(rank);
  if (!request) {
    request = fetch(matchupsUrl(rank)).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<MatchupsRank>;
    });
    // A failure is not cached: coming back to the rank retries.
    request.catch(() => requests.delete(rank));
    requests.set(rank, request);
  }
  return request;
}

type Side = "rows" | "columns";

/** Cell shade by size of the gap: the sign stays written, colour is never the only cue. */
function shade(gap: number): string {
  const size = Math.abs(gap);
  if (gap > 0) return size >= 3 ? "bg-emerald-500/35" : size >= 1.5 ? "bg-emerald-500/20" : "bg-emerald-500/10";
  return size >= 3 ? "bg-blood-500/40" : size >= 1.5 ? "bg-blood-500/25" : "bg-blood-500/10";
}

const button =
  "bevel-sm inline-flex items-center gap-2 border border-night-700 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400";

export function MatchupMatrix({
  heroes,
  ranks,
  example,
}: {
  heroes: HeroPickable[];
  ranks: MeasuredRank[];
  /** Two lineups with measured duels, to show the tool before anything is picked. */
  example: { rows: string[]; columns: string[] };
}) {
  const t = useT();
  const siteLocale = useLocale();
  const [rows, setRows] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [rank, setRank] = useState<MeasuredRank>("all");
  const [open, setOpen] = useState<Side | null>(null);
  const [charges, setCharges] = useState<Partial<Record<MeasuredRank, MatchupsRank | "error">>>({});
  const [copy, setCopy] = useState<"ok" | "error" | null>(null);

  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const nameOf = (slug: string) => bySlug.get(slug)?.name ?? slug;

  // Server and first hydration start empty (identical, so no mismatch); only
  // after mount are ?a=, ?b= and ?rang= adopted, then every change is written
  // back to the URL.
  const rise = useRef(false);
  useEffect(() => {
    if (!rise.current) {
      rise.current = true;
      const read = readMatrix(window.location.search, new Set(bySlug.keys()), ranks);
      if (read.rows.length || read.columns.length || read.rank) {
        /* eslint-disable react-hooks/set-state-in-effect -- reading the URL after mount */
        setRows(read.rows);
        setColumns(read.columns);
        if (read.rank) setRank(read.rank);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    const suffix = writeMatrix(window.location.search, { rows, columns, rank });
    window.history.replaceState(null, "", suffix ? `?${suffix}` : window.location.pathname);
  }, [rows, columns, rank, bySlug, ranks]);

  useEffect(() => {
    loadMatchups(rank).then(
      (m) => setCharges((c) => ({ ...c, [rank]: m })),
      () => setCharges((c) => ({ ...c, [rank]: "error" })),
    );
  }, [rank]);

  const state = charges[rank];
  const gaps = state && state !== "error" ? state.gaps : null;
  const duels = useMemo(() => (gaps ? measuredDuels(gaps, rows, columns) : []), [gaps, rows, columns]);
  const gap = (v: number) => `${formatGap(v, LOCALE_INTL[siteLocale])} ${t("counters.pts")}`;

  const picked = new Set([...rows, ...columns]);
  const setters: Record<Side, typeof setRows> = { rows: setRows, columns: setColumns };

  function add(slug: string) {
    if (!open) return;
    setters[open]((l) => (l.includes(slug) || l.length >= SIZE_SIDE ? l : [...l, slug]));
    setOpen(null);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopy("ok");
      trackShare("Matchups", "clipboard");
    } catch {
      setCopy("error");
    }
    setTimeout(() => setCopy(null), 3000);
  }

  const rankName = t(`measuredRanks.${rank}`);
  const empty = rows.length === 0 && columns.length === 0;

  return (
    <div className="space-y-10">
      <div className="grid gap-6 sm:grid-cols-2">
        {(["rows", "columns"] as const).map((side) => {
          const list = side === "rows" ? rows : columns;
          return (
            <section key={side} aria-labelledby={`side-${side}`}>
              <h2 id={`side-${side}`} className="font-heading text-xl font-bold text-chalk-100">
                {t(`pages.matchupsUI.${side}`)}
              </h2>
              <p className="mt-1 text-sm text-chalk-500">
                {t(`pages.matchupsUI.${side}Desc`, { n: list.length, max: SIZE_SIDE })}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {list.map((slug) => {
                  const h = bySlug.get(slug);
                  if (!h) return null;
                  return (
                    <li
                      key={slug}
                      className={cn(
                        "bevel-sm flex items-center gap-2 border bg-night-900/60 py-1 pl-1 pr-1",
                        side === "rows" ? "border-azure-500/40" : "border-blood-500/40",
                      )}
                    >
                      <HeroThumb hero={h} small />
                      <span className="max-w-28 truncate text-sm text-chalk-100">{h.name}</span>
                      <button
                        type="button"
                        onClick={() => setters[side]((l) => l.filter((s) => s !== slug))}
                        aria-label={t("draftUI.remove", { name: h.name })}
                        className="grid size-8 place-items-center text-chalk-500 transition-colors hover:text-blood-500"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </li>
                  );
                })}
                {list.length < SIZE_SIDE && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setOpen(side)}
                      className="bevel-sm inline-flex min-h-10 items-center gap-2 border border-dashed border-night-600 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                    >
                      <Plus size={16} aria-hidden />
                      {t("pages.matchupsUI.add")}
                    </button>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ChoiceRank ranks={ranks} rank={rank} onChange={setRank} />
        <div className="flex flex-wrap items-center gap-2">
          {empty ? (
            <button
              type="button"
              onClick={() => {
                setRows(example.rows);
                setColumns(example.columns);
              }}
              className={button}
            >
              {t("pages.matchupsUI.example")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setRows(columns);
                  setColumns(rows);
                }}
                className={button}
              >
                <ArrowLeftRight size={14} aria-hidden />
                {t("pages.matchupsUI.swap")}
              </button>
              <button type="button" onClick={copyLink} className={button}>
                <Link2 size={14} aria-hidden />
                {t("pages.matchupsUI.copy")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRows([]);
                  setColumns([]);
                }}
                className={button}
              >
                <RotateCcw size={14} aria-hidden />
                {t("draftUI.clearAll")}
              </button>
            </>
          )}
          <span role="status" className="text-xs text-chalk-300">
            {copy === "ok" && t("pages.matchupsUI.linkCopied")}
            {copy === "error" && t("pages.matchupsUI.copyFailed")}
          </span>
        </div>
      </div>

      {rows.length === 0 || columns.length === 0 ? (
        <p className="max-w-2xl leading-relaxed text-chalk-500">{t("pages.matchupsUI.intro")}</p>
      ) : state === "error" ? (
        <p role="alert" className="text-sm text-blood-500">
          {t("pages.matchupsUI.error")}
        </p>
      ) : !gaps ? (
        <p aria-live="polite" className="text-sm text-chalk-500">
          {t("pages.matchupsUI.loading")}
        </p>
      ) : (
        <section aria-labelledby="matrix-title" className="space-y-6">
          <div>
            <h2 id="matrix-title" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.matchupsUI.matrixTitle", { rank: rankName })}
            </h2>
            <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
            <p aria-live="polite" className="mt-3 text-sm text-chalk-500">
              {t("pages.matchupsUI.measured", { n: duels.length, total: rows.length * columns.length })}
            </p>
          </div>

          {/* Five columns of 3 rem and a row header fit a 360 px screen; beyond that, the table scrolls on its own. */}
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm tabular-nums">
              <caption className="sr-only">{t("pages.matchupsUI.caption", { rank: rankName })}</caption>
              <thead>
                <tr>
                  <td className="p-1" />
                  {columns.map((slug) => (
                    <th key={slug} scope="col" className="p-1 align-bottom font-normal">
                      <span className="flex w-12 flex-col items-center gap-1 sm:w-16">
                        <HeroThumb hero={bySlug.get(slug)!} small />
                        <span className="sr-only sm:not-sr-only sm:w-full sm:truncate sm:text-center sm:text-xs sm:text-chalk-300">
                          {nameOf(slug)}
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((hero) => (
                  <tr key={hero}>
                    <th scope="row" className="p-1 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <HeroThumb hero={bySlug.get(hero)!} small />
                        <span className="sr-only sm:not-sr-only sm:w-24 sm:truncate sm:text-chalk-100">{nameOf(hero)}</span>
                      </span>
                    </th>
                    {columns.map((opponent) => {
                      const value = gapOf(gaps, hero, opponent);
                      return (
                        <td key={opponent} className="p-1">
                          {value === null ? (
                            <span className="grid h-12 w-12 place-items-center border border-dashed border-night-700 text-chalk-500 sm:w-16">
                              <span aria-hidden>·</span>
                              <span className="sr-only">
                                {t("pages.matchupsUI.cellEmpty", { hero: nameOf(hero), opponent: nameOf(opponent) })}
                              </span>
                            </span>
                          ) : (
                            <Link
                              href={pathPair(hero, opponent)}
                              aria-label={t("pages.matchupsUI.cell", {
                                hero: nameOf(hero),
                                opponent: nameOf(opponent),
                                gap: gap(value),
                              })}
                              className={cn(
                                "grid h-12 w-12 place-items-center font-semibold text-chalk-100 outline-offset-2 transition-[filter] hover:brightness-125 sm:w-16",
                                shade(value),
                              )}
                            >
                              {formatGap(value, LOCALE_INTL[siteLocale])}
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul aria-label={t("pages.matchupsUI.legend")} className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-chalk-500">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 bg-emerald-500/35" />
              {t("pages.matchupsUI.legendUp")}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 bg-blood-500/40" />
              {t("pages.matchupsUI.legendDown")}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 border border-dashed border-night-600" />
              {t("pages.matchupsUI.legendEmpty")}
            </li>
          </ul>

          {duels.length > 0 && (
            <div>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.matchupsUI.listTitle")}</h3>
              <ol className="mt-3 divide-y divide-night-800 border-y border-night-800">
                {duels.map((d) => (
                  <li key={`${d.hero}-${d.opponent}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link
                      href={pathPair(d.hero, d.opponent)}
                      className="min-w-0 truncate text-chalk-100 transition-colors hover:text-gold-400"
                    >
                      {t("pages.matchupsUI.duel", { hero: nameOf(d.hero), opponent: nameOf(d.opponent) })}
                    </Link>
                    <span className={cn("shrink-0 font-semibold tabular-nums", d.gap > 0 ? "text-emerald-400" : "text-blood-500")}>
                      {gap(d.gap)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {open && (
        <HeroSelector
          heroes={heroes}
          excluded={picked}
          lane={null}
          title={t(open === "rows" ? "pages.matchupsUI.chooseRow" : "pages.matchupsUI.chooseColumn")}
          onChoose={add}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
