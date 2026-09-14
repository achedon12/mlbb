import { colorText, type StateTier } from "./tier-maker";

/**
 * Image of a tier list, drawn in a browser canvas.
 *
 * Thumbnails come from `public/visuels`, on the same domain: the canvas
 * is not "tainted" and exports to PNG without a proxy or CORS header.
 */

const WIDTH = 1200;
const MARGIN = 24;
const LABEL = 150;
const ICON = 72;
const GAP = 6;
const HEADER = 88;
const FOOTER = 48;
const LINEHEIGHT = 4;

const BACKGROUND = "#06080f";
const SURFACE = "#0e1424";
const TEXT = "#eef2fb";
const SUBTLE = "#7b88a6";

interface ImageThumb {
  name: string;
  icon: string | null;
}

async function load(source: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/** Site heading font (`next/font`), if loaded; otherwise the system one. */
async function fontTitle(): Promise<string> {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--heading-font").trim();
  const font = family ? `${family}, sans-serif` : "sans-serif";
  try {
    await document.fonts.load(`700 40px ${font}`);
  } catch {
    /* fallback font */
  }
  return font;
}

/** Largest size, from `max` down to 14 px, at which the text fits in `width`. */
function adjust(ctx: CanvasRenderingContext2D, text: string, font: string, width: number, max: number) {
  for (let size = max; size > 14; size -= 2) {
    ctx.font = `700 ${size}px ${font}`;
    if (ctx.measureText(text).width <= width) return;
  }
  ctx.font = `700 14px ${font}`;
}

export async function exportImage(
  state: StateTier,
  o: { title: string; pied: string; heroes: Map<string, ImageThumb> },
): Promise<Blob> {
  const font = await fontTitle();
  const byRow = Math.floor((WIDTH - 2 * MARGIN - LABEL - GAP) / (ICON + GAP));
  const heights = state.rows.map(
    (r) => Math.max(1, Math.ceil(r.heroes.length / byRow)) * (ICON + GAP) + GAP,
  );
  const height = HEADER + heights.reduce((a, b) => a + b, 0) + LINEHEIGHT * (state.rows.length - 1) + FOOTER;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const slugs = [...new Set(state.rows.flatMap((r) => r.heroes))];
  const images = new Map(
    await Promise.all(
      slugs.map(async (s) => {
        const source = o.heroes.get(s)?.icon;
        return [s, source ? await load(source) : null] as const;
      }),
    ),
  );

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "middle";

  ctx.fillStyle = TEXT;
  adjust(ctx, o.title, font, WIDTH - 2 * MARGIN, 40);
  ctx.fillText(o.title, MARGIN, HEADER / 2);

  let y = HEADER;
  state.rows.forEach((r, i) => {
    const h = heights[i];
    ctx.fillStyle = r.color;
    ctx.fillRect(MARGIN, y, LABEL, h);
    ctx.fillStyle = SURFACE;
    ctx.fillRect(MARGIN + LABEL, y, WIDTH - 2 * MARGIN - LABEL, h);

    ctx.fillStyle = colorText(r.color);
    ctx.textAlign = "center";
    adjust(ctx, r.name, font, LABEL - 16, 44);
    ctx.fillText(r.name, MARGIN + LABEL / 2, y + h / 2);
    ctx.textAlign = "left";

    r.heroes.forEach((slug, k) => {
      const x = MARGIN + LABEL + GAP + (k % byRow) * (ICON + GAP);
      const yy = y + GAP + Math.floor(k / byRow) * (ICON + GAP);
      const image = images.get(slug);
      if (image) {
        // Square crop, aligned to the top: a portrait keeps the face.
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        ctx.drawImage(image, (image.naturalWidth - side) / 2, 0, side, side, x, yy, ICON, ICON);
      } else {
        const name = o.heroes.get(slug)?.name ?? slug;
        ctx.fillStyle = "#1c2742";
        ctx.fillRect(x, yy, ICON, ICON);
        ctx.fillStyle = TEXT;
        ctx.textAlign = "center";
        adjust(ctx, name, font, ICON - 6, 16);
        ctx.fillText(name, x + ICON / 2, yy + ICON / 2);
        ctx.textAlign = "left";
      }
    });
    y += h + LINEHEIGHT;
  });

  ctx.fillStyle = SUBTLE;
  ctx.font = `600 20px ${font}`;
  ctx.fillText(o.pied, MARGIN, height - FOOTER / 2);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"),
  );
}
