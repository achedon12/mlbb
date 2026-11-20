/**
 * Web app icons, drawn from the brand files in `public/brand/` (see
 * `docs/logo-brief.md`): the sliced gold "M" on the night tile whose two
 * bevelled corners are the two bases.
 *
 *   node scripts/app-icons.mjs
 *
 * Writes:
 * - `src/app/icon.svg` and `src/app/apple-icon.png`: the favicon and the iOS icon;
 * - `public/icons/icon-{192,512}.png`: purpose "any", the tile;
 * - `public/icons/maskable-{192,512}.png`: full-bleed night ground, the mark
 *   inside the central 80% that every launcher mask keeps;
 * - `public/icons/monochrome-512.png`: the mark alone, white on transparent,
 *   for Android 13+ themed icons (only the alpha is used);
 * - `public/icons/shortcuts/<name>-{96,192}.png`: the manifest shortcuts
 *   (tier list, heroes, MLBBdle, builds), a gold lucide glyph on the night tile.
 *
 * The PNGs are committed, so this only runs again when the brand changes.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const NIGHT = "#0b1020";
const GOLD = "#f5c451";
const inner = (svg) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const tile = await readFile("public/brand/icon.svg", "utf8");
const mark = inner(await readFile("public/brand/mark.svg", "utf8"));
const white = inner(await readFile("public/brand/mark-white.svg", "utf8"));

/** The favicon tile. */
const anyIcon = tile;

/** Full bleed: launchers crop to a circle, a squircle or a rounded square. */
const maskableIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${NIGHT}"/>
  <svg x="136" y="136" width="240" height="240" viewBox="-4 -4 108 108">${mark}</svg>
</svg>`;

/** Themed icons: Android tints the alpha channel, inside the 66% safe zone. */
const monochromeIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <svg x="156" y="156" width="200" height="200" viewBox="-4 -4 108 108">${white}</svg>
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

/** A shortcut: the gold glyph centred in the safe zone of a night tile. */
async function shortcutIcon(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="${NIGHT}"/>
  <g transform="translate(24 24) scale(2)" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${await glyph(name)}</g>
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
await render(anyIcon, 180, "src/app/apple-icon.png");
await copyFile("public/brand/icon.svg", "src/app/icon.svg");
for (const [name, icon] of Object.entries(SHORTCUTS)) {
  const svg = await shortcutIcon(icon);
  for (const size of [96, 192]) await render(svg, size, `public/icons/shortcuts/${name}-${size}.png`);
}
console.log("Icons written.");
