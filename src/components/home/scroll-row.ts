/**
 * A long row of the home page on a small screen: one line that scrolls
 * sideways, snapping on each card, running to the edges of the screen (the
 * page gutter, `page-wrap`, is undone and given back as padding) so the cut
 * card at the right says there is more. From `lg` the row is the page width
 * again; the caller sets its grid (`lg:grid lg:grid-cols-…`).
 *
 * A pixel of padding above and below: the overflow would otherwise clip the
 * cards' hover lift and their focus ring.
 */
export const SCROLL_ROW =
  "flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] -mx-[clamp(1rem,0.4rem+2.4vw,3rem)] px-[clamp(1rem,0.4rem+2.4vw,3rem)] scroll-px-[clamp(1rem,0.4rem+2.4vw,3rem)] lg:mx-0 lg:overflow-visible lg:px-0";
