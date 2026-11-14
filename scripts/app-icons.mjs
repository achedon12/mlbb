/**
 * Web app icons, drawn from the site's brand mark (`src/app/icon.svg`: the
 * gold bevel-cut tile with "ML" in midnight blue).
 *
 *   node scripts/app-icons.mjs
 *
 * Writes:
 * - `public/icons/icon-{192,512}.png`: purpose "any", the tile as on the
 *   favicon, transparent corners;
 * - `public/icons/maskable-{192,512}.png`: full bleed gold, the letters inside
 *   the central 80% circle that every launcher mask keeps;
 * - `public/icons/monochrome-512.png`: the letters alone, white on
 *   transparent, for Android 13+ themed icons (only the alpha is used);
 * - `public/icons/shortcuts/<name>-{96,192}.png`: the manifest shortcuts
 *   (tier list, heroes, MLBBdle, builds), a lucide glyph on the gold tile.
 *
 * The letters are SVG text: the rendering uses whichever bold sans-serif the
 * machine has (DejaVu Sans on most Linux). The PNGs are committed, so this
 * only runs again when the mark changes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const NIGHT = "#06080f";
const GOLD_LIGHT = "#f5c451";
const GOLD_DARK = "#b8871f";
const FONT = "Segoe UI, DejaVu Sans, Liberation Sans, Arial, sans-serif";

const gradient = `<linearGradient id="or" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="1" stop-color="${GOLD_DARK}"/>
</linearGradient>`;

const letters = (x, y, size, fill) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="700" text-anchor="middle" fill="${fill}">ML</text>`;

/** The favicon tile, scaled to 512. */
const anyIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${gradient}</defs>
  <path d="M0 0h400l112 112v400H112L0 400z" fill="url(#or)"/>
  ${letters(256, 352, 240, NIGHT)}
</svg>`;

/** Full bleed: launchers crop to a circle, a squircle or a rounded square. */
const maskableIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${gradient}</defs>
  <rect width="512" height="512" fill="url(#or)"/>
  ${letters(256, 316, 172, NIGHT)}
</svg>`;

/** Themed icons: Android tints the alpha channel, inside the 66% safe zone. */
const monochromeIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${letters(256, 310, 150, "#ffffff")}
</svg>`;

/** Lucide glyphs (ISC license), read from the package the site already uses. */
async function glyph(name) {
  const { __iconData } = await import(`lucide-react/dist/esm/icons/${name}.mjs`);
  return __iconData.node
    .map(([tag, attributes]) => {
      const attrs = Object.entries(attributes)
        .filter(([key]) => key !== "key")
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
      return `<${tag} ${attrs}/>`;
    })
    .join("");
}

/** A shortcut: the glyph centred in the safe zone of a maskable gold tile. */
async function shortcutIcon(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs>${gradient}</defs>
  <rect width="96" height="96" fill="url(#or)"/>
  <g transform="translate(24 24) scale(2)" fill="none" stroke="${NIGHT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${await glyph(name)}</g>
</svg>`;
}

/** Same names as `SHORTCUTS` in `src/app/manifest.ts`. */
const SHORTCUTS = { "tier-list": "trophy", heroes: "users", mlbbdle: "puzzle", builds: "hammer" };

async function render(svg, size, file) {
  await mkdir(dirname(file), { recursive: true });
  const image = sharp(Buffer.from(svg), { density: 384 }).resize(size, size);
  await writeFile(file, await image.png({ compressionLevel: 9 }).toBuffer());
  console.log(`  ${file}`);
}

for (const size of [192, 512]) {
  await render(anyIcon, size, `public/icons/icon-${size}.png`);
  await render(maskableIcon, size, `public/icons/maskable-${size}.png`);
}
await render(monochromeIcon, 512, "public/icons/monochrome-512.png");
for (const [name, icon] of Object.entries(SHORTCUTS)) {
  const svg = await shortcutIcon(icon);
  for (const size of [96, 192]) await render(svg, size, `public/icons/shortcuts/${name}-${size}.png`);
}
console.log("Icons written.");
