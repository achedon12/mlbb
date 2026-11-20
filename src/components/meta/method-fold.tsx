import type { ReactNode } from "react";
import { Foldable } from "@/components/foldable";
import { Dex, type DexPose } from "@/components/mascot";
import { cn } from "@/lib/utils";

/**
 * A "how it is calculated" note, folded, with Dex beside it thinking it
 * over: the method stays one tap away, and the page says by a face, not by
 * another label, that this is where it is explained.
 */
export function MethodFold({
  label,
  pose = "reflexion",
  className,
  children,
}: {
  label: string;
  pose?: DexPose;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-end gap-3 sm:gap-4", className)}>
      <Dex pose={pose} height={84} still className="mb-0.5 hidden shrink-0 min-[380px]:inline-block" />
      <Foldable label={label} className="min-w-0 max-w-3xl flex-1">
        {children}
      </Foldable>
    </div>
  );
}
