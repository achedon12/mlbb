/**
 * Result card of the Retribution trainer, drawn in a canvas in the
 * share card format (1200 x 630): as a still image, or animated and
 * recorded as a short video — the score counting up, the rounds dropping in one
 * by one, the lightning on the monster.
 *
 * No external image: drawing happens offline, with the fonts already
 * loaded by the page and the monster's local portrait, and nothing leaves the
 * browser until the player shares.
 */
import type { Issue } from "./retribution";

export const WIDTH_CARD = 1200;
export const HEIGHT_CARD = 630;
/** Duration of the animation, then of the video: the final frame stays on screen for a moment. */
export const DURATION_ANIMATION_MS = 2600;
export const DURATION_VIDEO_MS = 4200;

export interface CardData {
  mark: string;
  title: string;
  subtitle: string;
  total: number;
  /** Number formatting in the page language. */
  format: (n: number) => string;
  labelScore: string;
  stats: { label: string; value: string }[];
  rounds: Issue[];
  /** "New record" badge, or null. */
  record: string | null;
  address: string;
  fonts: { title: string; body: string };
  /** Monster portrait, already loaded; null if it could not be. */
  portrait: CanvasImageSource | null;
  /** Monster tint: portrait halo and ring. */
  tint: string;
}

const C = {
  background: "#06080f",
  backgroundLight: "#131b30",
  or: "#f5c451",
  goldDark: "#b8871f",
  chalk: "#eef2fb",
  gris: "#99a4c0",
  sang: "#d94848",
  filet: "#2a3758",
};

/** Rectangle with beveled corners (top left, bottom right), a motif of the site's interface. */
function bevel(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, c: number) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + l, y);
  ctx.lineTo(x + l, y + h - c);
  ctx.lineTo(x + l - c, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

const bound = (x: number) => Math.min(1, Math.max(0, x));
const soften = (x: number) => 1 - (1 - x) ** 3;
/** Slight overshoot before settling, for elements that "drop". */
const bounce = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
/** Progress (0 to 1) of an animated element between two moments of the animation. */
const lead = (t: number, start: number, end: number) => bound((t - start) / (end - start));

/** Draws `trace` at scale `s` around (cx, cy). */
function hasScale(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, trace: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  trace();
  ctx.restore();
}

/**
 * Draws the card. `t` goes from 0 (start of the animation) to 1 (final frame,
 * the one of the still card).
 */
export function drawCard(ctx: CanvasRenderingContext2D, d: CardData, t = 1) {
  const L = WIDTH_CARD;
  const H = HEIGHT_CARD;
  const title = (px: number) => `700 ${px}px ${d.fonts.title}`;
  const body = (px: number, weight = 500) => `${weight} ${px}px ${d.fonts.body}`;
  const secured = d.rounds.includes("secured");
  // The lightning strikes when the score finishes counting up: three quick flashes.
  const flash = secured ? [0, 0.9, 0.35, 1, 0][Math.floor(lead(t, 0.56, 0.8) * 4.999)] * (t < 0.8 ? 1 : 0) : 0;

  ctx.globalAlpha = 1;
  const background = ctx.createLinearGradient(0, 0, L, H);
  background.addColorStop(0, C.background);
  background.addColorStop(1, C.backgroundLight);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, L, H);
  const halo = ctx.createRadialGradient(L - 200, 190, 10, L - 200, 190, 560);
  halo.addColorStop(0, `rgba(245, 196, 81, ${0.2 + 0.2 * flash})`);
  halo.addColorStop(1, "rgba(245, 196, 81, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, L, H);

  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = 3;
  bevel(ctx, 32, 32, L - 64, H - 64, 36);
  ctx.stroke();

  // Header: it slides into place at the very start.
  const entry = soften(lead(t, 0, 0.16));
  ctx.globalAlpha = entry;
  ctx.textBaseline = "alphabetic";
  const offset = (1 - entry) * 16;
  ctx.fillStyle = C.or;
  ctx.font = title(34);
  ctx.fillText(d.mark.toUpperCase(), 80, 104 + offset);
  ctx.fillStyle = C.chalk;
  ctx.font = title(58);
  ctx.fillText(d.title, 80, 172 + offset, L - 440);
  ctx.fillStyle = C.gris;
  ctx.font = body(30);
  ctx.fillText(d.subtitle, 80, 220 + offset, L - 440);
  ctx.globalAlpha = 1;

  // Monster portrait: it appears, shakes under the hits, then the lightning strikes it.
  const px = L - 190;
  const py = 200;
  const r = 80;
  const spawn = bounce(lead(t, 0.04, 0.24));
  const tremble = t > 0.26 && t < 0.56 ? Math.sin(t * 190) * 4 * (1 - lead(t, 0.26, 0.56)) : 0;
  if (spawn > 0) {
    hasScale(ctx, px, py, spawn, () => {
      const glow = ctx.createRadialGradient(px, py, r * 0.6, px, py, r * 1.9);
      glow.addColorStop(0, `${d.tint}88`);
      glow.addColorStop(1, `${d.tint}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(px - r * 2, py - r * 2, r * 4, r * 4);
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + tremble, py, r, 0, Math.PI * 2);
      ctx.clip();
      if (d.portrait) ctx.drawImage(d.portrait, px + tremble - r, py - r, r * 2, r * 2);
      else {
        ctx.fillStyle = C.backgroundLight;
        ctx.fill();
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 245, 207, ${0.55 * flash})`;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
      ctx.restore();
      ctx.strokeStyle = d.tint;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px + tremble, py, r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.shadowColor = C.or;
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#fff5cf";
    ctx.strokeStyle = C.or;
    ctx.lineWidth = 3;
    // The page's lightning path, at portrait scale (64 x 128).
    const e = (2.1 * r) / 128;
    const ox = px - 32 * e;
    const oy = py - r * 1.35;
    const points = [[40, 0], [14, 72], [31, 72], [20, 128], [54, 50], [36, 50], [48, 0]];
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * e, oy + y * e) : ctx.moveTo(ox + x * e, oy + y * e)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (d.record) {
    const pop = bounce(lead(t, 0.8, 0.92));
    if (pop > 0) {
      ctx.font = title(28);
      const width = ctx.measureText(d.record).width + 44;
      const x = L - 80 - width;
      hasScale(ctx, x + width / 2, 94, pop, () => {
        bevel(ctx, x, 70, width, 48, 12);
        ctx.fillStyle = C.or;
        ctx.fill();
        ctx.fillStyle = C.background;
        ctx.fillText(d.record!, x + 22, 104);
      });
    }
  }

  // The score counts up from zero; its label, positioned from the final score,
  // only appears at the end of the count, once the number has caught up with it.
  ctx.globalAlpha = entry;
  ctx.font = title(150);
  const widthScore = ctx.measureText(d.format(d.total)).width;
  ctx.fillStyle = C.or;
  ctx.fillText(d.format(Math.round(d.total * soften(lead(t, 0.14, 0.58)))), 74, 388);
  ctx.globalAlpha = soften(lead(t, 0.5, 0.62));
  ctx.fillStyle = C.gris;
  ctx.font = body(34);
  ctx.fillText(d.labelScore, 74 + widthScore + 20, 388);

  // One box per round: filled if the monster is secured, crossed out otherwise.
  // They drop in one after another while the score counts up.
  const side = 46;
  const gap = 14;
  const x0 = L - 80 - d.rounds.length * (side + gap) + gap;
  d.rounds.forEach((issue, i) => {
    const x = x0 + i * (side + gap);
    const y = 300;
    ctx.globalAlpha = entry;
    bevel(ctx, x, y, side, side, 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.filet;
    ctx.stroke();
    const fall = bounce(lead(t, 0.2 + i * 0.075, 0.3 + i * 0.075));
    if (fall <= 0) return;
    ctx.globalAlpha = 1;
    hasScale(ctx, x + side / 2, y + side / 2, fall, () => {
      bevel(ctx, x, y, side, side, 10);
      if (issue === "secured") {
        ctx.fillStyle = C.or;
        ctx.fill();
        ctx.strokeStyle = C.or;
        ctx.stroke();
        return;
      }
      ctx.fillStyle = C.background;
      ctx.fill();
      ctx.strokeStyle = issue === "missed" ? C.gris : C.sang;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 13, y + 13);
      ctx.lineTo(x + side - 13, y + side - 13);
      ctx.moveTo(x + side - 13, y + 13);
      ctx.lineTo(x + 13, y + side - 13);
      ctx.stroke();
    });
  });

  const column = (L - 160) / Math.max(1, d.stats.length);
  d.stats.forEach((s, i) => {
    const a = soften(lead(t, 0.58 + i * 0.05, 0.74 + i * 0.05));
    ctx.globalAlpha = a;
    const x = 80 + i * column;
    const y = (1 - a) * 18;
    ctx.fillStyle = C.gris;
    ctx.font = body(22, 600);
    ctx.fillText(s.label.toUpperCase(), x, 462 + y, column - 24);
    ctx.fillStyle = C.chalk;
    ctx.font = title(48);
    ctx.fillText(s.value, x, 514 + y, column - 24);
  });

  ctx.globalAlpha = entry;
  ctx.strokeStyle = C.filet;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 545);
  ctx.lineTo(L - 80, 545);
  ctx.stroke();
  ctx.fillStyle = C.gris;
  ctx.font = body(24);
  ctx.fillText(d.address, 80, 584, L - 160);
  ctx.globalAlpha = 1;
}

/** Formats tried, from the most shareable (MP4, plays everywhere) to the most widely supported for recording (WebM). */
const FORMATS_VIDEO = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

/**
 * Records the animated card: a few seconds recorded in real time from
 * an off-page canvas. Null when the browser cannot record.
 */
export async function recordCard(d: CardData): Promise<Blob | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const format = FORMATS_VIDEO.find((f) => MediaRecorder.isTypeSupported(f));
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH_CARD;
  canvas.height = HEIGHT_CARD;
  const ctx = canvas.getContext("2d");
  if (!format || !ctx || typeof canvas.captureStream !== "function") return null;

  drawCard(ctx, d, 0);
  const feed = canvas.captureStream(30);
  const recorder = new MediaRecorder(feed, { mimeType: format, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stop = new Promise<void>((ok) => {
    recorder.onstop = () => ok();
  });
  recorder.start();
  await new Promise<void>((ok) => {
    const start = performance.now();
    const image = (instant: number) => {
      const elapsed = instant - start;
      drawCard(ctx, d, Math.min(1, elapsed / DURATION_ANIMATION_MS));
      if (elapsed < DURATION_VIDEO_MS) requestAnimationFrame(image);
      else ok();
    };
    requestAnimationFrame(image);
  });
  recorder.stop();
  await stop;
  feed.getTracks().forEach((track) => track.stop());
  return chunks.length ? new Blob(chunks, { type: format.split(";")[0] }) : null;
}
