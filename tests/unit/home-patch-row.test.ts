import { describe, expect, it } from "vitest";
import { PER_DIRECTION, PER_ROW, splitRow } from "@/components/home/patch-row";

describe("the patch's row on the home page", () => {
  it("shows every buff and nerf when they fit on the row", () => {
    expect(splitRow(6, 3)).toEqual([6, 3]);
    expect(splitRow(0, 4)).toEqual([0, 4]);
  });

  it("caps each direction", () => {
    expect(splitRow(12, 0)).toEqual([PER_DIRECTION, 0]);
  });

  it("caps the row, the longer list giving way first", () => {
    const [b, n] = splitRow(9, 6);
    expect(b + n).toBe(PER_ROW);
    expect(n).toBe(5);
    expect(splitRow(3, 20)).toEqual([3, PER_ROW - 3]);
  });
});
