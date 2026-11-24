"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 1100;
/** Ease-out: fast at first, settling on the value like a score after a fight. */
const ease = (t: number) => 1 - (1 - t) ** 4;

/**
 * A figure that counts up to its value the first time it comes into view.
 *
 * The server writes the final value, so the figure is right without
 * JavaScript, for search engines and screen readers. With scripts on and
 * motion allowed, the CSS keeps it invisible until it counts (`.count-up`,
 * globals.css); if the script is late, the CSS shows the value on its own
 * after a short delay and the count is then skipped, so a figure never shows
 * once, drops to zero and climbs again. Once the script runs it holds the
 * figure (`data-armed`) until it comes into view and counts. Nothing moves under
 * `prefers-reduced-motion`. The digits are tabular: the width stays put while
 * it counts.
 */
export function CountUp({
  value,
  locale,
  decimals = 0,
  className,
}: {
  value: number;
  /** BCP 47 tag the figure is formatted in. */
  locale: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const format = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const done = () => {
      el.textContent = format.format(value);
      el.dataset.counted = "";
    };
    // Already shown by the CSS fallback, or no motion wanted: leave it as it is.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || getComputedStyle(el).opacity === "1") {
      done();
      return;
    }
    // From here the script holds it: the CSS fallback stands down.
    el.dataset.armed = "";
    let frame = 0;
    const run = () => {
      const start = performance.now();
      el.textContent = format.format(0);
      el.dataset.counted = "";
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        el.textContent = format.format(value * ease(t));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        run();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, locale, decimals]);

  return (
    <span ref={ref} className={cn("count-up", className)}>
      {new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)}
    </span>
  );
}
