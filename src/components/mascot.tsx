import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DexLive } from "@/components/dex-live";

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
 * - `carte`: guides, the map, strategy;
 * - `joie`, `bravo`, `saut`: happy moments, a good result, a celebration;
 * - `triste`: a loss, a hero at the bottom, nothing found;
 * - `pointe`: "look here", a link or an action to take;
 * - `dodo`: a quiet page, night, nothing new.
 *
 * `debout`, `parle`, `coucou`, `coucou2`, `cligne` and `leve` are the frames
 * he moves through when he is alive (`dex-live.tsx`): standing, talking,
 * waving, blinking, looking up.
 *
 * Decorative by default (`alt=""`): the text beside it carries the meaning.
 * He is alive (see `dex-live.tsx`); nothing moves under
 * `prefers-reduced-motion`.
 */
export type DexPose =
  | "salut" | "reflexion" | "idee" | "surpris" | "victoire" | "carte"
  | "joie" | "dodo" | "triste" | "bravo" | "pointe" | "saut"
  | "debout" | "parle" | "coucou" | "coucou2" | "cligne" | "leve";

const SIZE: Record<DexPose, [number, number]> = {
  salut: [264, 302],
  reflexion: [205, 308],
  idee: [261, 307],
  surpris: [234, 308],
  victoire: [276, 308],
  carte: [286, 292],
  joie: [211, 303],
  dodo: [293, 255],
  triste: [220, 283],
  bravo: [211, 309],
  pointe: [281, 309],
  saut: [316, 290],
  debout: [213, 306],
  parle: [201, 307],
  coucou: [235, 307],
  coucou2: [253, 307],
  cligne: [200, 304],
  leve: [196, 307],
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
    <span className={cn("dex", className)} style={{ width, height }}>
      <DexLive pose={pose} width={width} height={height} alt={alt} priority={priority} still={still} />
    </span>
  );
}

/**
 * Dex with a speech bubble: tips, empty states, small explanations. The
 * bubble pops in just after Dex and floats; three little bubbles rise
 * between them, like a thought (animations in globals.css).
 */
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
      <span className="dex-trail" aria-hidden="true"><i /><i /><i /></span>
      <div className="dex-bubble">{children}</div>
    </div>
  );
}
