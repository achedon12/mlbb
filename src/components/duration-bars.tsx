import type { Bucket } from "@/lib/composition";
import { cn } from "@/lib/utils";

/**
 * Taux de victoire par tranche de duree de partie, en barres, la meilleure en
 * or. Partagees par la fiche heros et l'analyse d'equipe. Le libelle des
 * tranches vient de l'appelant, tire de son propre catalogue : chaque page
 * n'envoie au navigateur que ses rubriques (`messagesPage`).
 */
export function DurationBars({
  buckets,
  count,
  label,
  className,
}: {
  buckets: (Bucket & { winRate: number })[];
  count: (v: number) => string;
  /** « 10–12 min », « 20 min et + ». */
  label: (x: Bucket) => string;
  className?: string;
}) {
  const rate = buckets.map((x) => x.winRate);
  const bottom = Math.min(...rate) - 1;
  const top = Math.max(...rate);
  const best = rate.indexOf(top);

  return (
    <div
      className={cn(
        "bevel flex h-48 items-stretch gap-1.5 border border-night-700/70 bg-night-900/60 p-3 sm:gap-3 sm:p-4",
        className,
      )}
    >
      {buckets.map((x, i) => (
        <div key={x.from} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className={cn("text-xs tabular-nums", i === best ? "font-semibold text-gold-400" : "text-chalk-300")}>
            {count(x.winRate)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-sm", i === best ? "bg-gold-500" : "bg-chalk-500/40")}
              style={{ height: `${Math.max(6, ((x.winRate - bottom) / (top - bottom)) * 100)}%` }}
            />
          </div>
          <span className="text-center text-[0.65rem] leading-tight text-chalk-500 sm:text-xs">{label(x)}</span>
        </div>
      ))}
    </div>
  );
}
