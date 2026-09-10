"use client";

import { createContext, useContext, useState } from "react";
import { useT } from "@/i18n/fournisseur";
import type { RangMesure } from "@/lib/rangs-mesure";
import { cn } from "@/lib/utils";

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
  const t = useT();
  const contexte = useContext(RangContexte);
  if (!contexte || contexte.rangs.length < 2) return null;
  const { rang, setRang, rangs } = contexte;

  return (
    <div
      role="group"
      aria-label={t("rangsMesure.label")}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="mr-1 text-xs uppercase tracking-wide text-craie-500">
        {t("rangsMesure.label")}
      </span>
      {rangs.map((r) => {
        const actif = r === rang;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={actif}
            onClick={() => setRang(r)}
            className={cn(
              "biseau-sm px-3 py-1.5 text-sm font-medium transition-colors",
              actif
                ? "bg-or-500 text-nuit-950"
                : "border border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
            )}
          >
            {t(`rangsMesure.${r}`)}
          </button>
        );
      })}
    </div>
  );
}

/** Valeur qui suit le rang choisi, ou la mesure tous rangs a defaut. */
export function ValeurParRang({ valeurs }: { valeurs: Partial<Record<RangMesure, string>> }) {
  const rang = useRang();
  return <>{valeurs[rang] ?? valeurs.all ?? null}</>;
}
