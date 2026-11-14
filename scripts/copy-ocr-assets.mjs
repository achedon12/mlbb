/**
 * Copies the screenshot reader of the account value estimator into
 * `public/ocr/`: the Tesseract worker, its WebAssembly core (LSTM builds
 * only, one per CPU feature level; the browser downloads one) and the
 * compact English model. Served from the site itself, so the page needs no
 * third-party host and the image never leaves the browser.
 *
 * Runs before `dev` and `build`; the folder is not versioned, the versions
 * come from the lock file.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = (name) => dirname(require.resolve(`${name}/package.json`));
const out = "public/ocr";

const files = [
  [join(root("tesseract.js"), "dist/worker.min.js"), "worker.min.js"],
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((v) => [
    join(root("tesseract.js-core"), `tesseract-core-${v}.wasm.js`),
    `core/tesseract-core-${v}.wasm.js`,
  ]),
  [join(root("@tesseract.js-data/eng"), "4.0.0_best_int/eng.traineddata.gz"), "lang/eng.traineddata.gz"],
];

for (const [from, to] of files) {
  await mkdir(dirname(join(out, to)), { recursive: true });
  await copyFile(from, join(out, to));
}
console.log(`OCR assets copied to ${out}/ (${files.length} files)`);
