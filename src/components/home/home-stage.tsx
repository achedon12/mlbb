"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The home poster's stage: its layers (glow, artwork, embers) shift a few
 * pixels against the pointer, each by its own depth, so the artwork seems to
 * stand in front of the night. The work is two CSS variables, `--stage-x` and
 * `--stage-y` (−1 to 1), written once per frame at most; the layers read
 * them in globals.css ("Brand stage") and move by transform only.
 *
 * Only on a fine pointer that can hover, and never under
 * `prefers-reduced-motion`: on a phone, or without JavaScript, the stage
 * stands still and looks the same.
 */
export function HomeStage({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const write = () => {
      frame = 0;
      el.style.setProperty("--stage-x", x.toFixed(3));
      el.style.setProperty("--stage-y", y.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      if (!frame) frame = requestAnimationFrame(write);
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(write);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className={cn("brand-stage", className)}>
      {children}
    </div>
  );
}
