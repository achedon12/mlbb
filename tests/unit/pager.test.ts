import { describe, expect, it } from "vitest";
import {
  SIZE_CARDS,
  SIZE_ROWS,
  SIZE_ROWS_CARDS,
  pageCount,
  pageHref,
  pageSteps,
  pagesAfterFirst,
  paging,
  pathWithoutPage,
  readPage,
  slicePage,
} from "@/lib/pager";

describe("pageCount", () => {
  it("rounds up and never goes below one", () => {
    expect(pageCount(134, SIZE_CARDS)).toBe(6);
    expect(pageCount(48, 24)).toBe(2);
    expect(pageCount(49, 24)).toBe(3);
    expect(pageCount(0, 24)).toBe(1);
    expect(pageCount(-5, 24)).toBe(1);
  });

  it("survives a size of zero rather than dividing by it", () => {
    expect(pageCount(30, 0)).toBe(1);
  });
});

describe("readPage", () => {
  it("accepts a page of the list other than the first", () => {
    expect(readPage("3", 6)).toBe(3);
    expect(readPage("6", 6)).toBe(6);
  });

  it("names no page for anything else, which the route turns into a 404", () => {
    // "1" included: the first page is the bare path, and only that.
    for (const value of ["1", "0", "01", "-2", "1.5", " 3 ", "two", "", null, undefined, "7"]) {
      expect(readPage(value, 6)).toBeNull();
    }
  });

  it("keeps the first value when the segment is repeated", () => {
    expect(readPage(["2", "5"], 6)).toBe(2);
  });
});

describe("pagesAfterFirst", () => {
  it("lists the pages a route has to prerender, the first one excluded", () => {
    expect(pagesAfterFirst(134, SIZE_CARDS)).toEqual([2, 3, 4, 5, 6].map((page) => ({ page: String(page) })));
    expect(pagesAfterFirst(24, 24)).toEqual([]);
    expect(pagesAfterFirst(0, 24)).toEqual([]);
  });

  it("agrees with readPage on what exists", () => {
    const pages = pageCount(134, SIZE_CARDS);
    for (const { page } of pagesAfterFirst(134, SIZE_CARDS)) expect(readPage(page, pages)).toBe(Number(page));
    expect(readPage(String(pages + 1), pages)).toBeNull();
  });
});

describe("pathWithoutPage", () => {
  it("gets back to the first page", () => {
    expect(pathWithoutPage("/fr/heroes/page/4")).toBe("/fr/heroes");
    expect(pathWithoutPage("/fr/heroes/page/4/")).toBe("/fr/heroes");
    expect(pathWithoutPage("/fr/heroes")).toBe("/fr/heroes");
  });

  it("leaves alone a path that only looks like one", () => {
    expect(pathWithoutPage("/fr/heroes/page/next")).toBe("/fr/heroes/page/next");
    expect(pathWithoutPage("/fr/statistics/page/2/detail")).toBe("/fr/statistics/page/2/detail");
    expect(pathWithoutPage("/page/2")).toBe("/");
  });
});

describe("paging", () => {
  it("describes the slice being read", () => {
    expect(paging(134, 1, 24)).toEqual({ page: 1, pages: 6, size: 24, total: 134, first: 1, last: 24 });
    expect(paging(134, 6, 24)).toEqual({ page: 6, pages: 6, size: 24, total: 134, first: 121, last: 134 });
  });

  it("clamps a page past the end and an empty list", () => {
    expect(paging(134, 99, 24).page).toBe(6);
    expect(paging(0, 1, 24)).toEqual({ page: 1, pages: 1, size: 24, total: 0, first: 0, last: 0 });
  });
});

describe("slicePage", () => {
  const items = Array.from({ length: 10 }, (_, i) => i + 1);

  it("cuts the list without losing or repeating an item", () => {
    const pages = [1, 2, 3].map((n) => slicePage(items, n, 4));
    expect(pages).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10],
    ]);
    expect(pages.flat()).toEqual(items);
  });

  it("gives the last page for a number past the end, and nothing for an empty list", () => {
    expect(slicePage(items, 12, 4)).toEqual([9, 10]);
    expect(slicePage([], 1, 4)).toEqual([]);
  });
});

describe("pageHref", () => {
  it("leaves the first page on the bare path", () => {
    expect(pageHref("/heroes", null, 1)).toBe("/heroes");
    expect(pageHref("/heroes/page/4", null, 1)).toBe("/heroes");
  });

  it("hangs a page segment off the path, never a query parameter", () => {
    expect(pageHref("/heroes", null, 3)).toBe("/heroes/page/3");
    expect(pageHref("/statistics/mythic", null, 2)).toBe("/statistics/mythic/page/2");
    // From one page to another, never "/page/2/page/5".
    expect(pageHref("/heroes/page/2", null, 5)).toBe("/heroes/page/5");
  });

  it("keeps the filters of the current address", () => {
    expect(pageHref("/heroes", "role=Mage&q=lu", 3)).toBe("/heroes/page/3?role=Mage&q=lu");
    expect(pageHref("/heroes", new URLSearchParams({ role: "Mage" }), 1)).toBe("/heroes?role=Mage");
  });

  it("accepts the plain object a page receives as search parameters", () => {
    expect(pageHref("/skins", { role: "Tank", q: undefined }, 2)).toBe("/skins/page/2?role=Tank");
  });
});

describe("pageSteps", () => {
  it("shows every page while they fit", () => {
    expect(pageSteps(1, 1)).toEqual([1]);
    expect(pageSteps(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps the ends, the current page and its neighbours", () => {
    expect(pageSteps(1, 6)).toEqual([1, 2, null, 6]);
    expect(pageSteps(4, 9)).toEqual([1, null, 3, 4, 5, null, 9]);
    expect(pageSteps(9, 9)).toEqual([1, null, 8, 9]);
  });

  it("never repeats a number nor puts a gap of one page", () => {
    for (let pages = 1; pages <= 12; pages++) {
      for (let page = 1; page <= pages; page++) {
        const steps = pageSteps(page, pages);
        const numbers = steps.filter((n): n is number => n !== null);
        expect(new Set(numbers).size).toBe(numbers.length);
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
        steps.forEach((n, i) => {
          if (n !== null) return;
          expect((steps[i + 1] as number) - (steps[i - 1] as number)).toBeGreaterThan(1);
        });
      }
    }
  });

  it("has nothing to show for an empty list", () => {
    expect(pageSteps(1, 0)).toEqual([]);
  });
});

describe("page sizes", () => {
  it("cuts the catalogue and the statistics into a handful of pages", () => {
    expect(pageCount(134, SIZE_CARDS)).toBeLessThanOrEqual(6);
    expect(pageCount(133, SIZE_ROWS)).toBeLessThanOrEqual(3);
    expect(pageCount(133, SIZE_ROWS_CARDS)).toBeLessThanOrEqual(7);
  });
});
