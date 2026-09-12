"use client";

import { createContext, useContext, useState } from "react";
import { useT } from "@/i18n/fournisseur";
import type { RangMesure } from "@/lib/rangs-mesure";
import { GroupeFiltres, Puce } from "@/components/puce";

/**
 * Rang de reference d'une fiche heros.
 *
 * Taux de l'en-tete et contres changent d'un rang a l'autre : un seul etat les
 * pilote, pour qu'un joueur Mythique lise toute la fiche a son niveau. Le
 * selecteur, unique, se place sous les taux de l'en-tete : visible quel que
 * soit l'onglet ouvert.
 */
interface Contexte {
  rang: RangMesure;
  setRang: (rang: RangMesure) => void;
  rangs: RangMesure[];
}

const RangContexte = createContext<Contexte | null>(null);

export function RangProvider({
  rangs,
  children,
}: {
  rangs: RangMesure[];
  children: React.ReactNode;
}) {
  const [rang, setRang] = useState<RangMesure>(rangs[0] ?? "all");
  return (
    <RangContexte.Provider value={{ rang, setRang, rangs }}>{children}</RangContexte.Provider>
  );
}

/** Hors d'une fiche, pas de selecteur : tout se lit tous rangs confondus. */
export function useRang(): RangMesure {
  return useContext(RangContexte)?.rang ?? "all";
}

export function SelecteurRang({ className }: { className?: string }) {
  const contexte = useContext(RangContexte);
  if (!contexte || contexte.rangs.length < 2) return null;
  return <ChoixRang rangs={contexte.rangs} rang={contexte.rang} onChange={contexte.setRang} className={className} />;
}

/** Puces des rangs, sans etat : la fiche les pilote par son contexte, un outil par le sien. */
export function ChoixRang({
  rangs,
  rang,
  onChange,
  className,
}: {
  rangs: readonly RangMesure[];
  rang: RangMesure;
  onChange: (rang: RangMesure) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <GroupeFiltres legende={t("measuredRanks.label")} largeurLegende="" className={className}>
      {rangs.map((r) => (
        <Puce key={r} actif={r === rang} onClick={() => onChange(r)}>
          {t(`measuredRanks.${r}`)}
        </Puce>
      ))}
    </GroupeFiltres>
  );
}

/** Valeur qui suit le rang choisi, ou la mesure tous rangs a defaut. */
export function ValeurParRang({ valeurs }: { valeurs: Partial<Record<RangMesure, string>> }) {
  const rang = useRang();
  return <>{valeurs[rang] ?? valeurs.all ?? null}</>;
}
