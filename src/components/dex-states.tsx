import Image from "next/image";
import type { ReactNode } from "react";
import type { DexPose } from "@/components/mascot";
import { cn } from "@/lib/utils";

/**
 * The small states of the brand, server-safe (no hook): a wait inside a
 * button or a status line, a skeleton, a confirmation. The full wait with
 * Dex hopping is `DexLoading` (dex-loading.tsx). Styles in globals.css,
 * "Brand micro-states"; nothing moves under `prefers-reduced-motion`.
 */

/** Dex's head in a small bevelled medallion: the bust of a pose, for a flash or a status line. Decorative. */
export function DexHead({ pose = "victoire", size = 28, className }: { pose?: DexPose; size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("dex-head", className)} style={{ width: size, height: size }}>
      <Image src={`/mascot/dex-${pose}.webp`} alt="" width={size * 2} height={size * 2} sizes={`${size * 2}px`} loading="lazy" />
    </span>
  );
}

/** A small inline wait (a button, a status line): three slanted blades lighting up in turn, in the text's colour. */
export function BrandSpinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("brand-spin", className)}>
      <i />
      <i />
      <i />
    </span>
  );
}

/** A bevelled night shape the blade passes over, standing for content on its way. Size it with classes. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton", className)} />;
}

/**
 * A confirmation (link copied, saved, voted…) or a small failure, as a
 * bevelled flash: gold edge and Dex cheering for a success, red edge and
 * Dex surprised for a failure. It carries no live role: the element that
 * holds it does (`role="status"` or `aria-live`), so the announcement does
 * not change.
 */
export function Flash({ tone = "ok", children, className }: { tone?: "ok" | "error"; children: ReactNode; className?: string }) {
  return (
    <span className={cn("brand-flash", tone === "error" && "brand-flash-error", className)}>
      <DexHead pose={tone === "ok" ? "victoire" : "surpris"} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * A notice with Dex's head (an empty list, a failed load, a step to take),
 * for the screens that already show a full Dex, a tool under its header for
 * one: a second whole Dex would be one too many. `tone="error"` draws the red
 * edge. Elsewhere, `DexNote` (stage.tsx) puts the whole Dex beside a bubble.
 */
export function DexNotice({ pose = "surpris", tone = "info", title, children, role, className }: {
  pose?: DexPose;
  tone?: "info" | "error";
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  return (
    <div role={role} className={cn("dex-notice", tone === "error" && "dex-notice-error", className)}>
      <DexHead pose={pose} size={44} />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-chalk-300">
        {title && <p className="font-heading text-lg font-bold uppercase leading-tight text-chalk-100">{title}</p>}
        {children && <div className={cn(title && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}
