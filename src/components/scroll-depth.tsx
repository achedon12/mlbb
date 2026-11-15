"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { newDepths, SCROLL_THRESHOLDS, type ScrollThreshold } from "@/lib/scroll-depth";

/**
 * Scroll depth of a page: an event "Scroll 25%", "50%", "75%", "100%" in
 * `category`, named `name` (the hero), each once per page view. Nothing is
 * sent until the visitor scrolls, so a page that fits the screen does not
 * claim to have been read to the bottom. A passive listener, read once per
 * frame: it costs the scrolling nothing.
 */
export function ScrollDepth({ category, name }: { category: string; name: string }) {
  useEffect(() => {
    const reported = new Set<ScrollThreshold>();
    let frame = 0;
    const measure = () => {
      frame = 0;
      const depths = newDepths(
        { scrollTop: window.scrollY, viewport: window.innerHeight, height: document.documentElement.scrollHeight },
        reported,
      );
      for (const depth of depths) {
        reported.add(depth);
        trackEvent(category, `Scroll ${depth}%`, name);
      }
      if (reported.size === SCROLL_THRESHOLDS.length) window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [category, name]);

  return null;
}
