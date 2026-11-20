import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { DexPose } from "@/components/mascot";
import type { Locale } from "@/i18n/config";

/**
 * What the share images draw with, read from `public` and kept in memory:
 * the display and heading faces (SIL Open Font License, in `public/fonts`)
 * and the site's pictures, converted from WebP, which the image engine
 * (satori) does not read.
 */

const PUBLIC = () => join(process.cwd(), "public");

type Weight = 600 | 700 | 900;
export interface OgFont {
  name: string;
  data: Buffer;
  weight: Weight;
  style: "normal";
}

/**
 * The faces: Saira Extra Condensed (the wordmark's, titles and figures) and
 * Barlow Condensed (labels and lines). Neither has Cyrillic nor Thai: Russian
 * falls back on Fira Sans Extra Condensed and Thai on Chakra Petch, as on the
 * site (`:lang()` in globals.css), loaded only for those languages.
 */
const FACES: Record<"latin" | "ru" | "th", [string, string, Weight][]> = {
  latin: [
    ["Saira", "SairaExtraCondensed-Black.ttf", 900],
    ["Barlow", "BarlowCondensed-SemiBold.ttf", 600],
    ["Barlow", "BarlowCondensed-Bold.ttf", 700],
  ],
  ru: [
    ["Fira", "FiraSansExtraCondensed-Black.ttf", 900],
    ["Fira", "FiraSansExtraCondensed-SemiBold.ttf", 600],
    ["Fira", "FiraSansExtraCondensed-SemiBold.ttf", 700],
  ],
  th: [
    ["Chakra", "ChakraPetch-Bold.ttf", 900],
    ["Chakra", "ChakraPetch-SemiBold.ttf", 600],
    ["Chakra", "ChakraPetch-Bold.ttf", 700],
  ],
};

/** Font stacks of the frame: the script's own face first, Saira and Barlow for the Latin parts. */
export const FONT_DISPLAY = "Saira, Fira, Chakra";
export const FONT_TEXT = "Barlow, Fira, Chakra";

const fileCache = new Map<string, Promise<Buffer>>();
function fontFile(file: string): Promise<Buffer> {
  let loading = fileCache.get(file);
  if (!loading) {
    loading = readFile(join(PUBLIC(), "fonts", file));
    fileCache.set(file, loading);
    loading.catch(() => fileCache.delete(file));
  }
  return loading;
}

/** The faces a language needs. */
export async function ogFonts(locale: Locale): Promise<OgFont[]> {
  const sets = [FACES.latin, ...(locale === "ru" ? [FACES.ru] : []), ...(locale === "th" ? [FACES.th] : [])];
  return Promise.all(
    sets.flat().map(async ([name, file, weight]) => ({ name, data: await fontFile(file), weight, style: "normal" as const })),
  );
}

/**
 * Small bounded memo of converted pictures: the same heroes and Dex come
 * back from one card to the next. A failure is not kept.
 */
const pictures = new Map<string, Promise<string | null>>();
const MAX_PICTURES = 120;

function memo(key: string, load: () => Promise<string | null>): Promise<string | null> {
  const known = pictures.get(key);
  if (known) return known;
  const value = load().catch(() => null);
  pictures.set(key, value);
  void value.then((v) => {
    if (v === null && pictures.get(key) === value) pictures.delete(key);
  });
  if (pictures.size > MAX_PICTURES) pictures.delete(pictures.keys().next().value!);
  return value;
}

/** Only the site's own pictures, never a path climbing out of `public`. */
const SAFE_PATH = /^\/(visuels|mascot)\/[\w./-]+$/;

/**
 * A site picture at the given size, as a data URI. Opaque pictures
 * (artworks, portraits) become JPEG, lighter; those with transparency
 * (items, emblems, Dex) stay PNG. `contain` keeps the whole picture, `cover`
 * crops it on its most telling part.
 */
export function ogPicture(
  path: string | null | undefined,
  width: number,
  height: number,
  { fit = "cover", position = "attention" }: { fit?: "cover" | "contain"; position?: "attention" | "top" | "center" } = {},
): Promise<string | null> {
  if (!path || !SAFE_PATH.test(path) || path.includes("..")) return Promise.resolve(null);
  return memo(`${path}:${width}x${height}:${fit}:${position}`, async () => {
    const source = sharp(await readFile(join(PUBLIC(), path)));
    const { hasAlpha } = await source.metadata();
    const resized = source.resize(width, height, {
      fit,
      position: position === "attention" ? sharp.strategy.attention : position,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if (hasAlpha || fit === "contain") {
      return `data:image/png;base64,${(await resized.png().toBuffer()).toString("base64")}`;
    }
    return `data:image/jpeg;base64,${(await resized.jpeg({ quality: 84 }).toBuffer()).toString("base64")}`;
  });
}

/** Proportions of each pose's file (`public/mascot/dex-<pose>.webp`), as in `mascot.tsx`. */
export const DEX_SIZE: Record<DexPose, [number, number]> = {
  salut: [264, 302],
  reflexion: [205, 308],
  idee: [261, 307],
  surpris: [234, 308],
  victoire: [276, 308],
  carte: [286, 292],
};

/** Width of Dex drawn at a given height. */
export const dexWidth = (pose: DexPose, height: number) => Math.round((DEX_SIZE[pose][0] / DEX_SIZE[pose][1]) * height);

/** Dex in a pose, at a given height, as a PNG data URI. */
export function ogDex(pose: DexPose, height: number): Promise<string | null> {
  return ogPicture(`/mascot/dex-${pose}.webp`, dexWidth(pose, height), height, { fit: "contain" });
}
