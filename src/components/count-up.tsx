"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 900;
/**
 * Ease-out, cubic: it settles on the value like a score after a fight,
 * without the quartic's rush, which put half the value on screen in the
 * first sixth of the count (a 50 % read "25 %" on its first frames).
 */
const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * A figure that counts up from zero to its value the first time it comes
 * into view.
 *
 * The server writes the final value, so the figure is right without
 * JavaScript, for search engines and screen readers. With scripts on and
 * motion allowed, the CSS keeps it invisible until it counts (`.count-up`,
 * globals.css); if the script is late, the CSS shows the value on its own
 * after a short delay and the count is then skipped, so a figure never shows
 * once, drops to zero and climbs again. Once the script runs it holds the
 * figure (`data-armed`), already set to zero, until it comes into view and
 * counts. A tab in the background shows the value at once: its frames are
 * paused, and a count frozen halfway would read as a wrong figure. Under
 * `prefers-reduced-motion` the value is written directly. The digits are
 * tabular: the width stays put while it counts.
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
    // Already shown by the CSS fallback, no motion wanted or a tab in the background: the value, as it is.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.visibilityState === "hidden" ||
      getComputedStyle(el).opacity !== "0"
    ) {
      done();
      return;
    }
    // From here the script holds it, at zero: the CSS fallback stands down.
    el.textContent = format.format(0);
    el.dataset.armed = "";
    let frame = 0;
    const run = () => {
      if (document.visibilityState === "hidden") {
        done();
        return;
      }
      const start = performance.now();
      // Shown from zero: the first frame painted is never a value halfway up.
      el.dataset.counted = "";
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        el.textContent = format.format(t < 1 ? value * ease(t) : value);
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
