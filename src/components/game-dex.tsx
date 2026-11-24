"use client";

import { Dex, type DexPose } from "@/components/mascot";
import { cn } from "@/lib/utils";

/**
 * Dex as the games' companion: he reacts to each answer. He greets at the
 * start, is surprised by a miss, thinks it over when the answer gets close,
 * is glad of a good answer, applauds a win and is let down by a loss. A
 * screen can force another pose (`pose`): the jump for a perfect score. The pose is swapped, no new asset; the short movement
 * replays on each answer (`beat`) and stays still under
 * `prefers-reduced-motion` (tools.css).
 */
export type GameMood = "start" | "miss" | "close" | "good" | "won" | "over";

const POSE: Record<GameMood, DexPose> = {
  start: "salut",
  miss: "surpris",
  close: "reflexion",
  good: "joie",
  won: "bravo",
  over: "triste",
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
const REACTIONS: DexPose[] = ["surpris", "reflexion", "joie", "bravo", "triste"];

export function GameDex({ mood, pose, beat, height = 104, className }: {
  mood: GameMood;
  /** Overrides the mood's pose (the motion still follows the mood). */
  pose?: DexPose;
  /** Changes on every answer, to replay the reaction. */
  beat: number;
  height?: number;
  className?: string;
}) {
  const shown = pose ?? POSE[mood];
  return (
    <span aria-hidden className={cn("game-dex relative inline-block shrink-0", className)}>
      <span key={`${mood}-${beat}`} className={cn("block origin-bottom", MOTION[mood])}>
        <Dex pose={shown} height={height} still={mood !== "start"} />
      </span>
      <span className="pointer-events-none absolute left-0 top-0 size-px overflow-hidden opacity-0">
        {REACTIONS.filter((p) => p !== shown).map((p) => (
          <Dex key={p} pose={p} height={height} still />
        ))}
      </span>
    </span>
  );
}
