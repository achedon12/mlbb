"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll reveal for the blocks of a page: every `[data-reveal]` inside comes
 * in once, the first time it nears the screen (rise and fade, then its title
 * on the slant and its blade sweeping; choreography in globals.css,
 * "Brand stage").
 *
 * Progressive: the server sends every block visible. Only once this runs,
 * with motion allowed, does the group arm (`.reveal-armed`) and hide what is
 * still below the fold; what the visitor already sees is marked revealed
 * first, so nothing on screen blinks. Without JavaScript, in print and under
 * `prefers-reduced-motion`, the blocks simply stand where they are.
 */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const blocks = [...el.querySelectorAll<HTMLElement>("[data-reveal]")];
    const reveal = (b: HTMLElement) => b.setAttribute("data-revealed", "");
    // Hero tiles follow one another, in the order of their row (capped: a long row would drag).
    for (const b of blocks) {
      b.querySelectorAll<HTMLElement>(".hero-tile").forEach((tile, i) => tile.style.setProperty("--reveal-i", String(Math.min(i, 10))));
    }
    const fold = window.innerHeight;
    for (const b of blocks) if (b.getBoundingClientRect().top < fold) reveal(b);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          reveal(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    for (const b of blocks) if (!b.hasAttribute("data-revealed")) io.observe(b);
    // Arming depends on the visitor's settings, known only here.
    setArmed(true);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className={cn(className, armed && "reveal-armed")}>
      {children}
    </div>
  );
}
