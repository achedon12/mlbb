"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "@/components/link";
import { LightImage } from "@/components/light-image";
import { useLocale, useT } from "@/i18n/provider";
import { heroIcon } from "@/lib/statistics-table";
import { cn } from "@/lib/utils";

export interface PlayerStatRow {
  slug: string;
  name: string;
  /** Whether the player has a page. */
  linked: boolean;
  team: string;
  teamSlug: string;
  teamLinked: boolean;
  role: string;
  /** Lane order, for sorting by role. */
  roleIndex: number;
  games: number;
  wins: number;
  losses: number;
  /** In %, one decimal. */
  winRate: number;
  mvps: number;
  heroCount: number;
  top: { slug: string; name: string; games: number; wins: number }[];
}

type Column = "player" | "team" | "role" | "games" | "wins" | "losses" | "winRate" | "mvps" | "heroCount";
const NUMERIC: Column[] = ["games", "wins", "losses", "winRate", "mvps", "heroCount"];
const LABEL: Record<Column, string> = {
  player: "player",
  team: "team",
  role: "role",
  games: "games",
  wins: "wins",
  losses: "losses",
  winRate: "winRate",
  mvps: "mvps",
  heroCount: "heroes",
};
/** Short headers whose full word is given to assistive technologies. */
const LONG: Partial<Record<Column, string>> = { wins: "winsLong", losses: "lossesLong" };

/**
 * Player statistics of a tournament, sortable by any column. Like the hero
 * table, the server renders every row (by games played): sorting in the
 * browser only reorders them.
 */
export function PlayersTable({ rows, name }: { rows: PlayerStatRow[]; name: string }) {
  const t = useT();
  const locale = useLocale();
  const [sort, setSort] = useState<{ column: Column; descending: boolean }>({ column: "games", descending: true });
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale],
  );

  const sorted = useMemo(() => {
    const byName = (a: PlayerStatRow, b: PlayerStatRow) => a.name.localeCompare(b.name, locale);
    return [...rows].sort((a, b) => {
      let c: number;
      if (sort.column === "player") c = byName(a, b);
      else if (sort.column === "team") c = a.team.localeCompare(b.team, locale);
      else if (sort.column === "role") c = a.roleIndex - b.roleIndex;
      else c = a[sort.column] - b[sort.column];
      return (sort.descending ? -c : c) || b.games - a.games || byName(a, b);
    });
  }, [rows, sort, locale]);

  const onSort = (column: Column) =>
    setSort((s) =>
      s.column === column ? { column, descending: !s.descending } : { column, descending: NUMERIC.includes(column) },
    );

  const cell = "px-3 py-1.5 text-right group-hover:bg-night-900";
  return (
    <div className="relative overflow-x-auto border border-night-700/70">
      <table className="w-full min-w-[46rem] border-collapse text-sm tabular-nums">
        <caption className="sr-only">{t("pages.esportsPlayersUI.caption", { name })}</caption>
        <thead className="bg-night-900 text-xs text-chalk-500">
          <tr>
            <SortHeader column="player" sort={sort} onSort={onSort} className="sticky left-0 z-10 bg-night-900 text-left">
              {t("pages.esportsPlayersUI.player")}
            </SortHeader>
            {(["team", "role"] as const).map((c) => (
              <SortHeader key={c} column={c} sort={sort} onSort={onSort} className="text-left">
                {t(`pages.esportsPlayersUI.${LABEL[c]}`)}
              </SortHeader>
            ))}
            {NUMERIC.map((c) => (
              <SortHeader key={c} column={c} sort={sort} onSort={onSort} className="text-right" long={LONG[c] && t(`pages.esportsPlayersUI.${LONG[c]}`)}>
                {t(`pages.esportsPlayersUI.${LABEL[c]}`)}
              </SortHeader>
            ))}
            <th scope="col" className="px-3 py-2 text-left font-medium uppercase tracking-wide">
              {t("pages.esportsPlayersUI.top")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.slug} className="group border-t border-night-800">
              <th
                scope="row"
                className="sticky left-0 z-10 max-w-40 bg-night-950 px-3 py-1.5 text-left font-heading font-bold text-chalk-100 group-hover:bg-night-900"
              >
                {r.linked ? (
                  <Link href={`/esports/players/${r.slug}`} prefetch={false} className="block truncate transition-colors hover:text-gold-400">
                    {r.name}
                  </Link>
                ) : (
                  <span className="block truncate">{r.name}</span>
                )}
              </th>
              <td className="max-w-44 px-3 py-1.5 text-left text-chalk-300 group-hover:bg-night-900">
                {r.teamLinked ? (
                  <Link href={`/esports/teams/${r.teamSlug}`} prefetch={false} className="block truncate transition-colors hover:text-gold-400">
                    {r.team}
                  </Link>
                ) : (
                  <span className="block truncate">{r.team}</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-left text-chalk-300 group-hover:bg-night-900">{r.role}</td>
              <td className={cn(cell, "text-chalk-100")}>{r.games}</td>
              <td className={cn(cell, "text-chalk-300")}>{r.wins}</td>
              <td className={cn(cell, "text-chalk-300")}>{r.losses}</td>
              <td className={cn(cell, "font-semibold text-gold-400")}>{percent.format(r.winRate / 100)}</td>
              <td className={cn(cell, "text-chalk-100")}>{r.mvps}</td>
              <td className={cn(cell, "text-chalk-300")}>{r.heroCount}</td>
              <td className="px-3 py-1.5 group-hover:bg-night-900">
                <ul className="flex gap-1">
                  {r.top.map((h) => (
                    <li key={h.slug} className="flex" title={t("pages.esportsPlayersUI.heroLine", { hero: h.name, games: h.games, wins: h.wins })}>
                      <LightImage
                        src={heroIcon(h.slug)}
                        alt={t("pages.esportsPlayersUI.heroLine", { hero: h.name, games: h.games, wins: h.wins })}
                        width={24}
                        height={24}
                        className="bevel-sm size-6 shrink-0 bg-night-800 object-cover"
                      />
                    </li>
                  ))}
                </ul>
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
  long,
  children,
}: {
  column: Column;
  sort: { column: Column; descending: boolean };
  onSort: (c: Column) => void;
  className?: string;
  /** Full word behind a short header ("W"). */
  long?: string;
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
        {long ? (
          <>
            <span aria-hidden>{children}</span>
            <span className="sr-only">{long}</span>
          </>
        ) : (
          children
        )}
        <Icon size={12} aria-hidden className={active ? undefined : "opacity-40"} />
      </button>
    </th>
  );
}
