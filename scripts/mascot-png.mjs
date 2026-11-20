/**
 * Dex's poses as PNG, for the brand kit (`/brand`): the site serves the
 * WebP files of `public/mascot/`, but a stream overlay, a slide or a Discord
 * emoji wants a PNG. Each pose is written twice, on a transparent ground:
 *
 * - `public/mascot/dex-<pose>.png`: the drawing at its own size;
 * - `public/mascot/dex-<pose>-square.png`: centred on a 512 × 512 square with
 *   a margin, the format of an avatar or an emoji (Discord scales it down).
 *
 *   node scripts/mascot-png.mjs
 *
 * The PNGs are committed, so this only runs again when a pose changes.
 */
import sharp from "sharp";

const POSES = ["salut", "reflexion", "idee", "surpris", "victoire", "carte"];
const SQUARE = 512;
const INNER = 448;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

for (const pose of POSES) {
  const source = `public/mascot/dex-${pose}.webp`;
  await sharp(source).png({ compressionLevel: 9 }).toFile(`public/mascot/dex-${pose}.png`);
  const drawing = await sharp(source)
    .resize({ width: INNER, height: INNER, fit: "contain", background: CLEAR, kernel: "lanczos3" })
    .png()
    .toBuffer();
  await sharp({ create: { width: SQUARE, height: SQUARE, channels: 4, background: CLEAR } })
    .composite([{ input: drawing, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(`public/mascot/dex-${pose}-square.png`);
  console.log(`dex-${pose}.png, dex-${pose}-square.png`);
}
