"use client";

import { createContext, useContext, useState } from "react";
import { useT } from "@/i18n/provider";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { FilterGroup, Chip } from "@/components/chip";

/**
 * Reference rank of a hero page.
 *
 * Header rates and counters change from one rank to another: a single state
 * drives them, so that a Mythic player reads the whole page at their level. The
 * picker, a single one, sits under the header rates: visible whichever
 * tab is open.
 */
interface Context {
  rank: MeasuredRank;
  setRank: (rank: MeasuredRank) => void;
  ranks: MeasuredRank[];
}

const RankContext = createContext<Context | null>(null);

export function RankProvider({
  ranks,
  children,
}: {
  ranks: MeasuredRank[];
  children: React.ReactNode;
}) {
  const [rank, setRank] = useState<MeasuredRank>(ranks[0] ?? "all");
  return (
    <RankContext.Provider value={{ rank, setRank, ranks }}>{children}</RankContext.Provider>
  );
}

/** Outside a hero page, no picker: everything reads across all ranks. */
export function useRank(): MeasuredRank {
  return useContext(RankContext)?.rank ?? "all";
}

export function RankPicker({ className }: { className?: string }) {
  const context = useContext(RankContext);
  if (!context || context.ranks.length < 2) return null;
  return <ChoiceRank ranks={context.ranks} rank={context.rank} onChange={context.setRank} className={className} />;
}

/** Rank chips, stateless: the hero page drives them through its context, a tool through its own. */
export function ChoiceRank({
  ranks,
  rank,
  onChange,
  className,
}: {
  ranks: readonly MeasuredRank[];
  rank: MeasuredRank;
  onChange: (rank: MeasuredRank) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <FilterGroup legend={t("measuredRanks.label")} widthLegend="" className={className}>
      {ranks.map((r) => (
        <Chip key={r} active={r === rank} onClick={() => onChange(r)}>
          {t(`measuredRanks.${r}`)}
        </Chip>
      ))}
    </FilterGroup>
  );
}

/** Value that follows the chosen rank, or the all-ranks measurement as a fallback. */
export function ValueByRank({ values }: { values: Partial<Record<MeasuredRank, string>> }) {
  const rank = useRank();
  return <>{values[rank] ?? values.all ?? null}</>;
}
