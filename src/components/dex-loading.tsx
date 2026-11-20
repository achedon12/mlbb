"use client";

import Image from "next/image";
import { Skeleton } from "@/components/dex-states";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The brand's wait: Dex hopping on his shadow, a short line in his voice and
 * a blade sweeping a bevelled track, then, if asked, bevelled skeletons
 * where the content will land (so the page does not jump when it arrives).
 * Pure CSS, a single small image; still under `prefers-reduced-motion`.
 *
 * Announced politely (`role="status"`). `label` replaces Dex's default line,
 * `say` picks another of his lines (`dexStates.*`, for a `loading.tsx`,
 * which has no translation function of its own).
 */
export function DexLoading({ label, say = "loading", lines = 0, height = 64, dex = true, className }: {
  label?: string;
  say?: "loading" | "loadingProfile" | "loadingForum" | "loadingTeammates";
  /** Skeleton rows under the line, standing for a list. */
  lines?: number;
  height?: number;
  /** False under a header that already shows Dex: the line and the blade alone. */
  dex?: boolean;
  className?: string;
}) {
  const t = useT();
  const width = Math.round((264 / 302) * height);
  return (
    <div className={cn("space-y-5", className)}>
      <div role="status" className="dex-loading">
        {dex && (
          <span className="dex-loading-dex" style={{ width, height }} aria-hidden>
            <Image src="/mascot/dex-salut.webp" alt="" width={width} height={height} sizes={`${width}px`} />
          </span>
        )}
        <span className="min-w-0 pb-1">
          <span className="block font-heading text-lg font-bold uppercase leading-tight text-chalk-100">{label ?? t(`dexStates.${say}`)}</span>
          <span aria-hidden className="dex-loading-track w-40 sm:w-56" />
        </span>
      </div>
      {lines > 0 && (
        <div aria-hidden className="space-y-2.5">
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className={cn("h-14", i % 3 === 1 ? "w-11/12" : i % 3 === 2 ? "w-4/5" : "w-full")} />
          ))}
        </div>
      )}
    </div>
  );
}
