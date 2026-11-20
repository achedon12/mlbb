"use client";

import { Dex, type DexPose } from "@/components/mascot";
import { cn } from "@/lib/utils";

/**
 * Dex as the games' companion: he reacts to each answer. He greets at the
 * start, is surprised by a miss, thinks it over when the answer gets close
 * and cheers a win. The pose is swapped, no new asset; the short movement
 * replays on each answer (`beat`) and stays still under
 * `prefers-reduced-motion` (tools.css).
 */
export type GameMood = "start" | "miss" | "close" | "good" | "won" | "over";

const POSE: Record<GameMood, DexPose> = {
  start: "salut",
  miss: "surpris",
  close: "reflexion",
  good: "idee",
  won: "victoire",
  over: "surpris",
};

const MOTION: Record<GameMood, string> = {
  start: "dex-pop",
  miss: "dex-shake",
  close: "dex-pop",
  good: "dex-pop",
  won: "dex-cheer",
  over: "dex-pop",
};

/** Poses a game can switch to: loaded with the first one, so a swap never flashes empty. */
const REACTIONS: DexPose[] = ["surpris", "reflexion", "idee", "victoire"];

export function GameDex({ mood, beat, height = 104, className }: {
  mood: GameMood;
  /** Changes on every answer, to replay the reaction. */
  beat: number;
  height?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("game-dex relative inline-block shrink-0", className)}>
      <span key={`${mood}-${beat}`} className={cn("block origin-bottom", MOTION[mood])}>
        <Dex pose={POSE[mood]} height={height} still={mood !== "start"} />
      </span>
      <span className="pointer-events-none absolute left-0 top-0 size-px overflow-hidden opacity-0">
        {REACTIONS.filter((p) => p !== POSE[mood]).map((p) => (
          <Dex key={p} pose={p} height={height} still />
        ))}
      </span>
    </span>
  );
}
