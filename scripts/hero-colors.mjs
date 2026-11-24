/**
 * Accent colour of each hero, taken from its official artwork and written to
 * `src/data/hero-colors.json` (outside `src/data/game/`, which only the sync
 * writes). The hero page tints its poster, its gauges and its focus rings
 * with it (`src/lib/hero-accent.ts`).
 *
 * The file is keyed by artwork path, not by hero: the page looks up the
 * colour of the artwork it actually shows, which has already gone through
 * `shownIllustrations` (`src/lib/listed.ts`). A withheld, altered or
 * provisional artwork may have a colour here, it is never read. Only the
 * first few artworks of each hero are measured: the page's poster is the
 * first one that passes the filter.
 *
 * The colour is the most present saturated hue of the artwork, weighted by
 * saturation and kept away from near-black and near-white pixels, so a dark
 * background or a sky does not win over the character. Its lightness is
 * clamped for contrast at runtime, not here: the raw colour stays the truth.
 *
 *   node scripts/hero-colors.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

const VISUALS = "src/data/game/visuals.json";
const OUTPUT = "src/data/hero-colors.json";
/** Artworks measured per hero, in catalogue order. */
const PER_HERO = 3;
/** Hue buckets of the histogram, in degrees. */
const BUCKET = 15;

/** RGB (0–255) to HSL (h in degrees, s and l in 0–1). */
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const hex = (n) => Math.round(n).toString(16).padStart(2, "0");

/**
 * Dominant accent of raw RGB pixels (`[r, g, b, r, g, b, …]`): the hue bucket
 * with the most weight, then the weighted mean colour of its pixels. `null`
 * when the image is grey all over.
 */
export function dominantAccent(pixels, channels = 3) {
  const buckets = new Map();
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (channels === 4 && pixels[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    // Saturated mid-tones weigh most: that is where the character's colours are.
    const weight = s * s * (1 - Math.abs(l - 0.5) * 1.6);
    if (weight <= 0) continue;
    const key = Math.floor(h / BUCKET) % (360 / BUCKET);
    const bucket = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
    bucket.w += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
    buckets.set(key, bucket);
  }
  let best = null;
  for (const bucket of buckets.values()) if (!best || bucket.w > best.w) best = bucket;
  if (!best) return null;
  return `#${hex(best.r / best.w)}${hex(best.g / best.w)}${hex(best.b / best.w)}`;
}

async function accentOf(file) {
  const { data, info } = await sharp(file)
    .resize(64, 64, { fit: "cover", position: "attention" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return dominantAccent(data, info.channels);
}

async function main() {
  const visuals = JSON.parse(await readFile(VISUALS, "utf8"));
  const colors = {};
  for (const byName of Object.values(visuals.illustrations ?? {})) {
    for (const path of Object.values(byName).slice(0, PER_HERO)) {
      const file = `public${path}`;
      if (!existsSync(file)) continue;
      try {
        const accent = await accentOf(file);
        if (accent) colors[path] = accent;
      } catch (error) {
        console.warn(`hero-colors: ${path}: ${error.message}`);
      }
    }
  }
  const sorted = Object.fromEntries(Object.entries(colors).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(OUTPUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`hero-colors: ${Object.keys(sorted).length} artworks measured.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
