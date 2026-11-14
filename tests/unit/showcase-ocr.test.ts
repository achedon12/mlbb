import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pointsOf } from "@/lib/account-value";
import { binarize, fractionReadings, pointsMatch, readShowcase, type OcrWord } from "@/lib/showcase-ocr";

/** Skins per tier in the catalogue at the time of the capture. */
const CATALOG = { legend: 15, grand: 101, exquisite: 108, deluxe: 157, exceptional: 270, common: 277 };

/**
 * Words the OCR gave for a real screenshot of the French client (the Showcase
 * panel over the skin cards, with the collector title, "Skin collection
 * 510/1164" and the in-match counts around it), at the first threshold the
 * browser tries. Rewritten by `showcase-ocr-real.test.ts` (OCR=1 OCR_WRITE=1).
 */
const WORDS: OcrWord[] = JSON.parse(readFileSync("tests/fixtures/showcase/words-fr.json", "utf8"));

const word = (text: string, x: number, y: number): OcrWord => ({ text, bbox: { x0: x, y0: y, x1: x + 20 * text.length, y1: y + 20 } });

describe("fractionReadings", () => {
  it("reads a clean count", () => {
    expect(fractionReadings("12/111")).toEqual([{ owned: 12, total: 111, exact: true }]);
  });

  it("offers every split when the slash was lost or read as a digit", () => {
    expect(fractionReadings("117")).toContainEqual({ owned: 1, total: 17, exact: false });
    expect(fractionReadings("197115")).toContainEqual({ owned: 19, total: 115, exact: false });
  });

  it("never offers more owned than total, nor an empty total", () => {
    expect(fractionReadings("50/0")).toEqual([]);
    expect(fractionReadings("240/233")).toEqual([{ owned: 240, total: 233, exact: true }]);
    expect(fractionReadings("91").every((r) => r.owned <= r.total)).toBe(true);
  });
});

describe("pointsMatch", () => {
  it("accepts the value, or the value after the coin read as a digit", () => {
    expect(pointsMatch("38000", 38000)).toBe(true);
    expect(pointsMatch("238000", 38000)).toBe(true);
    expect(pointsMatch("91560", 1560)).toBe(true);
    expect(pointsMatch("3600", 36000)).toBe(false);
    expect(pointsMatch("1238000", 38000)).toBe(false);
  });
});

describe("readShowcase", () => {
  it("reads the real screenshot, row by row, and checks it against the header", () => {
    const r = readShowcase(WORDS, CATALOG)!;
    expect(r.rows.map((x) => [x.tier, x.owned])).toEqual([
      ["legend", 1],
      ["grand", 12],
      ["exquisite", 19],
      ["deluxe", 69],
      ["exceptional", 130],
      ["common", 240],
      ["painted", 39],
    ]);
    expect(r.rows.every((x) => x.checked)).toBe(true);
    expect(r.header).toEqual({ value: 157_160, matches: true });
    expect(r.collection).toEqual({ owned: 510, total: 1164 });
    const counts = Object.fromEntries(r.rows.map((x) => [x.tier, x.owned]));
    expect(pointsOf(counts)).toBe(157_160);
  });

  it("does not depend on the tier names, only on the numbers and their order", () => {
    const words = [
      word("4000", 600, 0),
      word("1/17", 300, 100),
      word("4000", 600, 100),
      word("12/111", 300, 200),
      word("36000", 600, 200),
      word("19/115", 300, 300),
      word("38000", 600, 300),
      word("69/166", 300, 400),
      word("27600", 600, 400),
      word("0/290", 300, 500),
      word("0", 600, 500),
    ];
    const r = readShowcase(words, CATALOG)!;
    expect(r.rows.map((x) => x.owned)).toEqual([1, 12, 19, 69, 0]);
    expect(r.header).toEqual({ value: 4000, matches: false });
  });

  it("flags a row whose points do not confirm the count", () => {
    const words = [word("1/17", 300, 100), word("4000", 600, 100), word("12/111", 300, 200), word("3600", 600, 200)];
    words.push(word("19/115", 300, 300), word("38000", 600, 300), word("69/166", 300, 400), word("27600", 600, 400));
    const r = readShowcase(words, CATALOG)!;
    expect(r.rows.find((x) => x.tier === "grand")).toMatchObject({ owned: 12, checked: false });
    expect(r.rows.filter((x) => x.checked)).toHaveLength(3);
  });

  it("recovers a count whose slash was lost, thanks to its points", () => {
    const words = [word("117", 300, 100), word("4000", 600, 100), word("12/111", 300, 200), word("36000", 600, 200)];
    words.push(word("19/115", 300, 300), word("38000", 600, 300), word("69/166", 300, 400), word("27600", 600, 400));
    expect(readShowcase(words, CATALOG)!.rows[0]).toMatchObject({ tier: "legend", owned: 1, total: 17, checked: true });
  });

  it("gives up on an image that is not the panel", () => {
    expect(readShowcase([word("2026", 0, 0), word("12/30", 0, 100)], CATALOG)).toBeNull();
    expect(readShowcase([], CATALOG)).toBeNull();
  });
});

describe("binarize", () => {
  it("turns light text dark on white", () => {
    const px = new Uint8ClampedArray([250, 250, 250, 255, 20, 30, 40, 255]);
    binarize(px, 150);
    expect([...px]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});
