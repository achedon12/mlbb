"use client";

import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { TrendingDown, TrendingUp, Users } from "lucide-react";
import { useRank } from "@/components/rank-picker";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Opponent resolved by the server: the browser does not have the catalogue. */
export interface CounterShown {
  slug: string;
  name: string;
  portrait: string | null;
  /** Win rate gap, in points (positive = advantage). */
  advantage: number;
}

export interface CountersShown {
  strong: CounterShown[];
  weak: CounterShown[];
  winRate: number | null;
}

/**
 * Counters based on the game's win rates, rank by rank.
 *
 * Each row carries the gap in points, its real information: "strong against
 * Wanwan" says nothing, "+3.3 points against Wanwan" sizes the advantage. The
 * portraits make it instant to read: a hero is recognised by their face
 * before their name.
 *
 * A matchup does not weigh the same in Epic and in Mythical Glory: the page's
 * rank switches from one measurement to another. They all arrive with the page, which stays
 * static: changing rank triggers no request.
 */
export function MeasuredCounters({
  name,
  byRank,
}: {
  name: string;
  byRank: Partial<Record<MeasuredRank, CountersShown>>;
}) {
  const t = useT();
  const rank = useRank();
  // The page's rank may be missing here: fall back to all ranks.
  const current = byRank[rank] ?? byRank.all;
  if (!current) return null;

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-chalk-500">
        {t("pages.heroDetail.countersIntro", { name: name })}
        {current.winRate !== null && (
          <span className="text-chalk-300">
            {" "}{t("pages.heroDetail.countersRef", { rate: current.winRate })}
          </span>
        )}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Column
          title={t("counters.strong")}
          icon={<TrendingUp size={17} aria-hidden />}
          tone="good"
          entries={current.strong}
        />
        <Column
          title={t("counters.difficulty")}
          icon={<TrendingDown size={17} aria-hidden />}
          tone="bad"
          entries={current.weak}
        />
      </div>
    </div>
  );
}

/**
 * Teammates who make the hero win the most, at the page's rank: the gap
 * is that of its win rate when they play together.
 */
export function TeammatesByRank({
  name,
  byRank,
}: {
  name: string;
  byRank: Partial<Record<MeasuredRank, CounterShown[]>>;
}) {
  const t = useT();
  const rank = useRank();
  const list = byRank[rank] ?? byRank.all;
  if (!list?.length) return null;

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.heroDetail.teammatesIntro", { name: name })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Column title={t("pages.heroDetail.teammates")} icon={<Users size={17} aria-hidden />} tone="good" entries={list} />
      </div>
    </div>
  );
}

function Column({
  title,
  icon,
  tone,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "good" | "bad";
  entries: CounterShown[];
}) {
  const t = useT();
  const color = tone === "good" ? "text-emerald-400" : "text-blood-500";

  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <h3 className={cn("flex items-center gap-2 font-heading font-bold", color)}>
        {icon}
        {title}
      </h3>
      <ul className="mt-3 space-y-1.5">
        {entries.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/heroes/${e.slug}`}
              className="flex items-center gap-2.5 rounded-sm px-1 py-1 transition-colors hover:bg-night-850"
            >
              <HeroPortrait source={e.portrait} name={e.name} size="small" decorative />
              <span className="min-w-0 flex-1 truncate text-sm text-chalk-100">{e.name}</span>
              <span className={cn("shrink-0 text-xs font-semibold tabular-nums", color)}>
                {e.advantage > 0 ? "+" : ""}
                {e.advantage.toFixed(1)} {t("counters.pts")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
