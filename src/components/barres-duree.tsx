import type { Tranche } from "@/lib/composition";
import { cn } from "@/lib/utils";

/**
 * Taux de victoire par tranche de duree de partie, en barres, la meilleure en
 * or. Partagees par la fiche heros et l'analyse d'equipe. Le libelle des
 * tranches vient de l'appelant, tire de son propre catalogue : chaque page
 * n'envoie au navigateur que ses rubriques (`messagesPage`).
 */
export function BarresDuree({
  tranches,
  nombre,
  libelle,
  className,
}: {
  tranches: (Tranche & { winRate: number })[];
  nombre: (v: number) => string;
  /** « 10–12 min », « 20 min et + ». */
  libelle: (x: Tranche) => string;
  className?: string;
}) {
  const taux = tranches.map((x) => x.winRate);
  const bas = Math.min(...taux) - 1;
  const haut = Math.max(...taux);
  const meilleure = taux.indexOf(haut);

  return (
    <div
      className={cn(
        "bevel flex h-48 items-stretch gap-1.5 border border-night-700/70 bg-night-900/60 p-3 sm:gap-3 sm:p-4",
        className,
      )}
    >
      {tranches.map((x, i) => (
        <div key={x.from} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className={cn("text-xs tabular-nums", i === meilleure ? "font-semibold text-gold-400" : "text-chalk-300")}>
            {nombre(x.winRate)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-sm", i === meilleure ? "bg-gold-500" : "bg-chalk-500/40")}
              style={{ height: `${Math.max(6, ((x.winRate - bas) / (haut - bas)) * 100)}%` }}
            />
          </div>
          <span className="text-center text-[0.65rem] leading-tight text-chalk-500 sm:text-xs">{libelle(x)}</span>
        </div>
      ))}
    </div>
  );
}
