"use client";

import { createContext, useContext, useState } from "react";
import { useT } from "@/i18n/provider";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { FilterGroup, Chip } from "@/components/chip";

/**
 * Rang de reference d'une fiche heros.
 *
 * Taux de l'en-tete et contres changent d'un rang a l'autre : un seul etat les
 * pilote, pour qu'un joueur Mythique lise toute la fiche a son niveau. Le
 * selecteur, unique, se place sous les taux de l'en-tete : visible quel que
 * soit l'onglet ouvert.
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

/** Hors d'une fiche, pas de selecteur : tout se lit tous rangs confondus. */
export function useRank(): MeasuredRank {
  return useContext(RankContext)?.rank ?? "all";
}

export function RankPicker({ className }: { className?: string }) {
  const context = useContext(RankContext);
  if (!context || context.ranks.length < 2) return null;
  return <ChoiceRank ranks={context.ranks} rank={context.rank} onChange={context.setRank} className={className} />;
}

/** Puces des rangs, sans etat : la fiche les pilote par son contexte, un outil par le sien. */
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

/** Valeur qui suit le rang choisi, ou la mesure tous rangs a defaut. */
export function ValueByRank({ values }: { values: Partial<Record<MeasuredRank, string>> }) {
  const rank = useRank();
  return <>{values[rank] ?? values.all ?? null}</>;
}
