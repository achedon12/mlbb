"use client";

import type { Tier } from "./account-value";
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
} from "./showcase-ocr";

/**
 * Reading a Showcase screenshot in the browser. The image is decoded on a
 * canvas, enlarged, turned black on white, and read by Tesseract compiled to
 * WebAssembly, in a worker: nothing leaves the device. The OCR library, its
 * core and the English model are self-hosted under `/ocr/` (copied from
 * `node_modules` by `scripts/copy-ocr-assets.mjs`) and loaded only when a
 * player picks an image.
 */

export type ScanStep = "loading" | "reading";

async function pixels(image: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(image);
  const width = Math.min(MAX_WIDTH, Math.max(WIDTH, bitmap.width));
  const height = Math.round((bitmap.height * width) / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

/**
 * Reads the screenshot; null when no Showcase panel was recognised. Throws
 * when the reader itself cannot start (blocked worker, no WebAssembly).
 */
export async function scanShowcase(
  image: Blob,
  catalog: Partial<Record<Tier, number>>,
  onStep: (step: ScanStep) => void = () => {},
): Promise<ShowcaseReading | null> {
  onStep("loading");
  const [source, { createWorker, OEM, PSM }] = await Promise.all([pixels(image), import("tesseract.js")]);
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    workerBlobURL: false,
    gzip: true,
  });
  try {
    await worker.setParameters({ ...OCR_PARAMETERS, tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    onStep("reading");
    const original = source.getContext("2d")!.getImageData(0, 0, source.width, source.height);
    const work = document.createElement("canvas");
    work.width = source.width;
    work.height = source.height;
    const context = work.getContext("2d")!;
    let best: ShowcaseReading | null = null;
    for (const threshold of THRESHOLDS) {
      const frame = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
      binarize(frame.data, threshold);
      context.putImageData(frame, 0, 0);
      const { data } = await worker.recognize(work, {}, { blocks: true });
      best = better(best, readShowcase(wordsOf(data), catalog));
      if (complete(best)) break;
    }
    return best;
  } finally {
    await worker.terminate();
  }
}
