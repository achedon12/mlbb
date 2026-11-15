/**
 * How far down a page the visitor has read, in quarters.
 *
 * Each threshold is reported once per page view. The bottom counts as
 * reached a few pixels early: the last pixel row is rarely scrolled to
 * exactly, depending on zoom and rounding.
 */
export const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;
export type ScrollThreshold = (typeof SCROLL_THRESHOLDS)[number];

const BOTTOM_SLACK_PX = 8;

/** Thresholds newly passed, given the scroll position and the ones already reported. */
export function newDepths(
  { scrollTop, viewport, height }: { scrollTop: number; viewport: number; height: number },
  reported: ReadonlySet<ScrollThreshold>,
): ScrollThreshold[] {
  if (height <= 0) return [];
  const seen = scrollTop + viewport;
  return SCROLL_THRESHOLDS.filter((t) => {
    if (reported.has(t)) return false;
    return t === 100 ? seen >= height - BOTTOM_SLACK_PX : seen >= (height * t) / 100;
  });
}
