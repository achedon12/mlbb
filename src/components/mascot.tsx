import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dex, the site's mascot: a small owl-fox spirit of the Land of Dawn, midnight
 * blue with gold blade-shaped ear tufts and the base crystal (blue and red) as
 * a pendant. Six poses, each for a moment of the visit:
 *
 * - `salut`: welcome, first screens, onboarding;
 * - `reflexion`: tips, explanations, "how it works";
 * - `idee`: a suggestion, a recommended action, a tool;
 * - `surpris`: empty states, not found, errors;
 * - `victoire`: success, a solved game, a saved action;
 * - `carte`: guides, the map, strategy.
 *
 * Decorative by default (`alt=""`): the text beside it carries the meaning.
 * It breathes gently and bounces on hover; nothing moves under
 * `prefers-reduced-motion`.
 */
export type DexPose = "salut" | "reflexion" | "idee" | "surpris" | "victoire" | "carte";

const SIZE: Record<DexPose, [number, number]> = {
  salut: [264, 302],
  reflexion: [205, 308],
  idee: [261, 307],
  surpris: [234, 308],
  victoire: [276, 308],
  carte: [286, 292],
};

export function Dex({ pose = "salut", height = 160, className, alt = "", priority = false, still = false }: {
  pose?: DexPose;
  /** Rendered height in CSS pixels; the width follows the pose. */
  height?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
  /** No idle animation (when several Dex share a screen). */
  still?: boolean;
}) {
  const [w, h] = SIZE[pose];
  const width = Math.round((w / h) * height);
  return (
    <span className={cn("dex", !still && "dex-idle", className)} style={{ width, height }}>
      <Image src={`/mascot/dex-${pose}.webp`} alt={alt} width={width} height={height} priority={priority} sizes={`${width}px`} />
    </span>
  );
}

/** Dex with a speech bubble: tips, empty states, small explanations. */
export function DexSays({ pose = "reflexion", height = 120, children, side = "left", className }: {
  pose?: DexPose;
  height?: number;
  children: ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  return (
    <div className={cn("dex-says", side === "right" && "dex-says-right", className)}>
      <Dex pose={pose} height={height} />
      <div className="dex-bubble">{children}</div>
    </div>
  );
}
