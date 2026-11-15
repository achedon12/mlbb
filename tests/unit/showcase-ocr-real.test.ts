import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MAX_WIDTH,
  OCR_PARAMETERS,
  THRESHOLDS,
  WIDTH,
  better,
  binarize,
  complete,
  readPanel,
  wordsOf,
  type PanelReading,
} from "@/lib/showcase-ocr";

/**
 * The real OCR, on real screenshots, with the browser's settings: slow (a few
 * seconds each) and dependent on the Tesseract build, so opt-in.
 *
 *   OCR=1 npx vitest run tests/unit/showcase-ocr-real.test.ts
 *
 * With OCR_WRITE=1 it also rewrites the `words-*.json` files, the OCR output
 * the fast parser test runs on.
 */
const DIR = "tests/fixtures/showcase";
const CATALOG = { legend: 15, grand: 101, exquisite: 108, deluxe: 157, exceptional: 270, common: 277 };

let worker: Worker;

async function read(image: string, words: string): Promise<PanelReading | null> {
  const meta = await sharp(image).metadata();
  const width = Math.min(MAX_WIDTH, Math.max(WIDTH, meta.width!));
  const { data: raw, info } = await sharp(image).resize(width).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let best: PanelReading | null = null;
  for (const threshold of THRESHOLDS) {
    const px = new Uint8ClampedArray(raw);
    binarize(px, threshold);
    const png = await sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    const { data } = await worker.recognize(png, {}, { blocks: true });
    const found = wordsOf(data);
    if (process.env.OCR_WRITE && threshold === THRESHOLDS[0]) writeFileSync(join(DIR, words), `${JSON.stringify(found, null, 0)}\n`);
    best = better(best, readPanel(found, CATALOG));
    if (complete(best)) break;
  }
  return best;
}

describe.skipIf(!process.env.OCR)("Showcase screenshots, real OCR", () => {
  beforeAll(async () => {
    const require = createRequire(import.meta.url);
    worker = await createWorker("eng", OEM.LSTM_ONLY, {
      langPath: join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int"),
      gzip: true,
      cachePath: join(process.env.TMPDIR ?? "/tmp", "mlbbdex-ocr"),
    });
    await worker.setParameters({ ...OCR_PARAMETERS, tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  }, 60_000);
  afterAll(() => worker?.terminate());

  it("reads the seven rows and the header of the skin panel", { timeout: 120_000 }, async () => {
    const r = await read(join(DIR, "showcase-fr.jpg"), "words-fr.json");
    expect(r?.kind).toBe("skins");
    if (r?.kind !== "skins") return;
    expect(r.reading.rows.map((x) => x.owned)).toEqual([1, 12, 19, 69, 130, 240, 39]);
    expect(r.reading.header).toEqual({ value: 157_160, matches: true });
  });

  it("reads the skin panel with shining points", { timeout: 120_000 }, async () => {
    const r = await read(join(DIR, "showcase-fr-skins-shining.jpg"), "words-fr-skins-shining.json");
    expect(r?.kind).toBe("skins");
    if (r?.kind !== "skins") return;
    expect(r.reading.rows.map((x) => x.owned)).toEqual([2, 12, 8, 63, 126, 237, 53]);
    expect(r.reading.shining).toBe(700);
    expect(r.reading.header).toEqual({ value: 136_920, matches: true });
  });

  it("reads the in-match items panel", { timeout: 120_000 }, async () => {
    const r = await read(join(DIR, "showcase-fr-inmatch.jpg"), "words-fr-inmatch.json");
    expect(r?.kind).toBe("items");
    if (r?.kind !== "items") return;
    expect(r.reading.group).toBe("inMatch");
    expect(r.reading.points).toBe(18_855);
    expect(r.reading.header?.matches).toBe(true);
  });

  it("reads the out-of-match items panel", { timeout: 120_000 }, async () => {
    const r = await read(join(DIR, "showcase-fr-outmatch.jpg"), "words-fr-outmatch.json");
    expect(r?.kind).toBe("items");
    if (r?.kind !== "items") return;
    expect(r.reading.group).toBe("outMatch");
    expect(r.reading.points).toBe(4120);
    expect(r.reading.header?.matches).toBe(true);
  });
});
