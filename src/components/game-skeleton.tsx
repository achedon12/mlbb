import { Skeleton } from "@/components/dex-states";
import { cn } from "@/lib/utils";

/**
 * The wait of a daily game, drawn as the game itself: the round tabs, the
 * stage with its title, Dex's line, the clues and the answer field, all in
 * bevelled skeletons the blade passes over. Same footprint as the drawn
 * game, so nothing jumps when it lands; the sweep stops under
 * `prefers-reduced-motion` (globals.css). Announced politely through
 * `label`, kept for screen readers only. Server-safe, no hook.
 */
export function GameSkeleton({
  label,
  steps = 0,
  clues = 3,
  className,
}: {
  label: string;
  /** Round tabs above the stage (the quiz: its rounds plus the summary). */
  steps?: number;
  /** Clue lines on the stage. */
  clues?: number;
  className?: string;
}) {
  return (
    <div role="status" className={cn("space-y-5", className)}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-5">
        {steps > 0 && (
          <>
            <Skeleton className="h-6 w-56 max-w-full" />
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))` }}>
              {Array.from({ length: steps }, (_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          </>
        )}
        <div className="relative p-4 sm:p-6">
          <div className="game-stage absolute inset-0" />
          <div className="relative">
            <div className="flex items-start gap-3 sm:gap-5">
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-9 w-4/5 sm:h-11" />
                <Skeleton className="h-8 w-60 max-w-full" />
              </div>
              <Skeleton className="h-[88px] w-[76px] shrink-0 sm:h-[132px] sm:w-[114px]" />
            </div>
            {clues > 0 && (
              <div className="mt-5 space-y-2">
                {Array.from({ length: clues }, (_, i) => (
                  <Skeleton key={i} className={cn("h-5", i % 3 === 1 ? "w-11/12" : i % 3 === 2 ? "w-3/4" : "w-full")} />
                ))}
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 sm:w-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
