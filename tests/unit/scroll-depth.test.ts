import { describe, expect, it } from "vitest";
import { newDepths, type ScrollThreshold } from "@/lib/scroll-depth";

/** Scroll depth on hero pages: each quarter once, the bottom a little early. */
const none = new Set<ScrollThreshold>();

describe("newDepths", () => {
  it("reports every quarter passed, in order", () => {
    expect(newDepths({ scrollTop: 0, viewport: 800, height: 4000 }, none)).toEqual([]);
    expect(newDepths({ scrollTop: 200, viewport: 800, height: 4000 }, none)).toEqual([25]);
    expect(newDepths({ scrollTop: 2300, viewport: 800, height: 4000 }, none)).toEqual([25, 50, 75]);
  });

  it("does not report a threshold twice", () => {
    expect(newDepths({ scrollTop: 2300, viewport: 800, height: 4000 }, new Set([25, 50]))).toEqual([75]);
  });

  it("counts the bottom as reached a few pixels early", () => {
    expect(newDepths({ scrollTop: 3195, viewport: 800, height: 4000 }, new Set([25, 50, 75]))).toEqual([100]);
    expect(newDepths({ scrollTop: 3150, viewport: 800, height: 4000 }, new Set([25, 50, 75]))).toEqual([]);
  });

  it("ignores an empty document", () => {
    expect(newDepths({ scrollTop: 0, viewport: 800, height: 0 }, none)).toEqual([]);
  });
});
