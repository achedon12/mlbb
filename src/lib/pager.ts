/**
 * Paging of the long lists, as pure computations.
 *
 * The catalogue runs 134 cards, the statistics 133 rows, the skin gallery a
 * thousand thumbnails: read on a phone that is twenty screens of scrolling
 * before the page ends. Pages are cut into slices, each at an address of its
 * own: `/heroes` then `/heroes/page/2`.
 *
 * A path and not a `?page=` parameter: a page that reads its query string is
 * rendered on every request, where a path segment is one more route Next
 * prerenders and serves from the full-route cache — which is what these
 * pages, the most visited of the site, are served from today.
 *
 * Nothing here touches React or the DOM — the component (`Pager`) and the
 * pages that use it share these functions, and the whole of the logic is
 * testable on its own.
 */

/** Path segment introducing a page number: `/heroes/page/2`. */
export const SEGMENT_PAGE = "page";

/**
 * Cards per page. Twenty-four fills four rows of six on a wide screen, twelve
 * rows of two on a phone, and leaves the page around three screens tall.
 */
export const SIZE_CARDS = 24;

/**
 * Rows per page. A row is a third of the height of a card, so fifty of them
 * cost about the same as twenty-four cards while cutting a 133-hero table
 * into three pages rather than six.
 */
export const SIZE_ROWS = 50;

/**
 * Rows per page for a wide table, the kind `CardsTable` turns into cards on a
 * phone. A card — hero, tier, three rates and a change — measures about
 * 105 px, so eight fit on a screen: twenty keep the table itself under two
 * and a half screens, and the page it sits on under six.
 */
export const SIZE_ROWS_CARDS = 20;

/** Page count of a list; always at least one, so "page 1 of 1" stays true. */
export function pageCount(total: number, size: number): number {
  if (size <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/**
 * Page number read from a `/page/n` segment, or `null` when the segment names
 * no page of this list: a word, a decimal, a leading zero, a number past the
 * last page, or `1` — the first page is the bare path and nothing else. The
 * route turns that `null` into a 404 rather than serving the same slice under
 * two addresses.
 */
export function readPage(value: string | string[] | null | undefined, pages: number): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 2 && n <= pages ? n : null;
}

/** Every page of a list but the first: what a route prerenders. */
export function pagesAfterFirst(total: number, size: number): { page: string }[] {
  return Array.from({ length: pageCount(total, size) - 1 }, (_, i) => ({ page: String(i + 2) }));
}

/** Where a page starts and stops, everything a pager has to show. */
export interface Paging {
  /** Current page, from 1. */
  page: number;
  /** Total number of pages, at least 1. */
  pages: number;
  size: number;
  total: number;
  /** Position of the first and last item of the page, from 1 (0 when empty). */
  first: number;
  last: number;
}

export function paging(total: number, page: number, size: number): Paging {
  const pages = pageCount(total, size);
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const first = total === 0 ? 0 : (current - 1) * size + 1;
  return { page: current, pages, size, total, first, last: Math.min(current * size, total) };
}

/** The `page`th slice of `items`, as `paging` describes it. */
export function slicePage<T>(items: readonly T[], page: number, size: number): T[] {
  const { first, last } = paging(items.length, page, size);
  return first === 0 ? [] : items.slice(first - 1, last);
}

/**
 * Address of a page.
 *
 * Page one keeps the bare path — the one the canonical points at, the one
 * that is prerendered — and the others hang a `/page/n` segment off it, so
 * two addresses never hold the same slice. Whatever query the caller passes
 * travels along: on the catalogue the filters live in the address and paging
 * must not drop the view being read.
 */
export function pageHref(
  path: string,
  params: URLSearchParams | Record<string, string | undefined> | string | null | undefined,
  page: number,
): string {
  const search = new URLSearchParams(
    params instanceof URLSearchParams
      ? params
      : typeof params === "string"
        ? params
        : Object.entries(params ?? {}).flatMap(([k, v]) => (v ? [[k, v] as [string, string]] : [])),
  );
  const base = pathWithoutPage(path);
  const suffix = search.toString();
  return `${page <= 1 ? base : `${base}/${SEGMENT_PAGE}/${page}`}${suffix ? `?${suffix}` : ""}`;
}

/**
 * A path stripped of its `/page/n` suffix, to get back to the first page —
 * what the browser holds while paging in place, and what the pager builds
 * every other address from.
 */
export function pathWithoutPage(path: string): string {
  const cut = new RegExp(`/${SEGMENT_PAGE}/\\d+/?$`);
  return path.replace(cut, "") || "/";
}

/**
 * Page numbers a pager shows: the first, the last, the current one and its
 * neighbours, with `null` standing for the numbers left out. At most
 * `2 * span + 5` entries, so the row never wraps on a phone.
 */
export function pageSteps(page: number, pages: number, span = 1): (number | null)[] {
  if (pages <= 1) return pages === 1 ? [1] : [];
  const wanted = new Set<number>([1, pages]);
  for (let n = page - span; n <= page + span; n++) if (n >= 1 && n <= pages) wanted.add(n);
  const list = [...wanted].sort((a, b) => a - b);
  const steps: (number | null)[] = [];
  let previous = 0;
  for (const n of list) {
    if (previous && n - previous > 1) steps.push(null);
    steps.push(n);
    previous = n;
  }
  return steps;
}
