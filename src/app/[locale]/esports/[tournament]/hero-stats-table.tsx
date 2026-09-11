"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "@/components/lien";
import { ImageLegere } from "@/components/image-legere";
import { useLangue, useT } from "@/i18n/fournisseur";
import { iconeHeros } from "@/lib/tableau-statistiques";
import { cn } from "@/lib/utils";

export interface HeroStatRow {
  slug: string;
  name: string;
  picks: number;
  bans: number;
  /** In %, one decimal. */
  presence: number;
  wins: number;
  losses: number;
  /** In %, one decimal; `null` without a pick. */
  winRate: number | null;
}

type Column = "hero" | "picks" | "bans" | "presence" | "wins" | "losses" | "winRate";
const NUMERIC: Exclude<Column, "hero">[] = ["picks", "bans", "presence", "wins", "losses", "winRate"];

/** Rows whose icon loads right away: the first screen. */
const FIRST_ROWS = 8;

/**
 * Hero statistics of a tournament, sortable by any column.
 *
 * The server renders every row in the default order (presence): search
 * engines and readers without JavaScript get the full table. In the browser,
 * sorting reorders those same rows, with no request.
 */
export function HeroStatsTable({ rows, name }: { rows: HeroStatRow[]; name: string }) {
  const t = useT();
  const locale = useLangue();
  const [sort, setSort] = useState<{ column: Column; descending: boolean }>({ column: "presence", descending: true });
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale],
  );

  const sorted = useMemo(() => {
    const byName = (a: HeroStatRow, b: HeroStatRow) => a.name.localeCompare(b.name, locale);
    return [...rows].sort((a, b) => {
      // A hero never picked has no win rate: always last, whatever the order.
      const c =
        sort.column === "hero" ? byName(a, b) : (a[sort.column] ?? -1) - (b[sort.column] ?? -1);
      return (sort.descending ? -c : c) || byName(a, b);
    });
  }, [rows, sort, locale]);

  const onSort = (column: Column) =>
    setSort((s) => (s.column === column ? { column, descending: !s.descending } : { column, descending: column !== "hero" }));

  return (
    <div className="relative overflow-x-auto border border-night-700/70">
      <table className="w-full min-w-[36rem] border-collapse text-sm tabular-nums">
        <caption className="sr-only">{t("pages.esportsUI.caption", { name })}</caption>
        <thead className="bg-night-900 text-xs text-chalk-500">
          <tr>
            <SortHeader column="hero" sort={sort} onSort={onSort} className="sticky left-0 z-10 bg-night-900 text-left">
              {t("pages.esportsUI.hero")}
            </SortHeader>
            {NUMERIC.map((c) => (
              <SortHeader key={c} column={c} sort={sort} onSort={onSort} className="text-right">
                {t(`pages.esportsUI.${c}`)}
              </SortHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.slug} className="group border-t border-night-800">
              <th
                scope="row"
                className="sticky left-0 z-10 w-44 max-w-44 bg-night-950 px-3 py-1.5 text-left font-normal group-hover:bg-night-900"
              >
                <Link href={`/heroes/${r.slug}`} prefetch={false} className="flex items-center gap-2.5">
                  <ImageLegere
                    src={iconeHeros(r.slug)}
                    alt=""
                    largeur={28}
                    hauteur={28}
                    immediate={i < FIRST_ROWS}
                    className="bevel-sm size-7 shrink-0 bg-night-800 object-cover"
                  />
                  <b className="truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                    {r.name}
                  </b>
                </Link>
              </th>
              <td className="px-3 py-1.5 text-right text-chalk-100 group-hover:bg-night-900">{r.picks}</td>
              <td className="px-3 py-1.5 text-right text-chalk-100 group-hover:bg-night-900">{r.bans}</td>
              <td className="px-3 py-1.5 text-right font-semibold text-gold-400 group-hover:bg-night-900">
                {percent.format(r.presence / 100)}
              </td>
              <td className="px-3 py-1.5 text-right text-chalk-300 group-hover:bg-night-900">{r.wins}</td>
              <td className="px-3 py-1.5 text-right text-chalk-300 group-hover:bg-night-900">{r.losses}</td>
              <td className="px-3 py-1.5 text-right text-chalk-100 group-hover:bg-night-900">
                {r.winRate === null ? (
                  <>
                    <span aria-hidden>—</span>
                    <span className="sr-only">{t("pages.esportsUI.noPick")}</span>
                  </>
                ) : (
                  percent.format(r.winRate / 100)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sortable header: the button carries the action, `aria-sort` announces the order. */
function SortHeader({
  column,
  sort,
  onSort,
  className,
  children,
}: {
  column: Column;
  sort: { column: Column; descending: boolean };
  onSort: (c: Column) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = sort.column === column;
  const Icon = !active ? ArrowUpDown : sort.descending ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.descending ? "descending" : "ascending") : undefined}
      className={cn("px-3 py-2 font-medium", className)}
    >
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
