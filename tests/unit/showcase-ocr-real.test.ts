import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { createWorker, OEM, PSM } from "tesseract.js";
import { describe, expect, it } from "vitest";
import {
  MAX_WIDTH,
  OCR_PARAMETERS,
  THRESHOLDS,
  WIDTH,
  better,
  binarize,
  complete,
  readShowcase,
  wordsOf,
  type ShowcaseReading,
} from "@/lib/showcase-ocr";

/**
 * The real OCR, on the real screenshot, with the browser's settings: slow
 * (a few seconds) and dependent on the Tesseract build, so opt-in.
 *
 *   OCR=1 npx vitest run tests/unit/showcase-ocr-real.test.ts
 *
 * With OCR_WRITE=1 it also rewrites `words-fr.json`, the OCR output the fast
 * parser test runs on.
 */
const IMAGE = "tests/fixtures/showcase/showcase-fr.jpg";
const CATALOG = { legend: 15, grand: 101, exquisite: 108, deluxe: 157, exceptional: 270, common: 277 };

describe.skipIf(!process.env.OCR)("Showcase screenshot, real OCR", () => {
  it("reads the seven rows and the header of the French client", { timeout: 120_000 }, async () => {
    const meta = await sharp(IMAGE).metadata();
    const width = Math.min(MAX_WIDTH, Math.max(WIDTH, meta.width!));
    const { data: raw, info } = await sharp(IMAGE).resize(width).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const require = createRequire(import.meta.url);
    const worker = await createWorker("eng", OEM.LSTM_ONLY, {
      langPath: join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int"),
      gzip: true,
      cachePath: join(process.env.TMPDIR ?? "/tmp", "mlbbdex-ocr"),
    });
    await worker.setParameters({ ...OCR_PARAMETERS, tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    let best: ShowcaseReading | null = null;
    try {
      for (const threshold of THRESHOLDS) {
        const px = new Uint8ClampedArray(raw);
        binarize(px, threshold);
        const png = await sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
        const { data } = await worker.recognize(png, {}, { blocks: true });
        const words = wordsOf(data);
        const reading = readShowcase(words, CATALOG);
        if (process.env.OCR_WRITE && threshold === THRESHOLDS[0]) {
          writeFileSync("tests/fixtures/showcase/words-fr.json", `${JSON.stringify(words, null, 0)}\n`);
        }
        best = better(best, reading);
        if (complete(best)) break;
      }
    } finally {
      await worker.terminate();
    }
    expect(best?.rows.map((r) => r.owned)).toEqual([1, 12, 19, 69, 130, 240, 39]);
    expect(best?.header).toEqual({ value: 157_160, matches: true });
  });
});
