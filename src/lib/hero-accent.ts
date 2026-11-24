import heroColors from "@/data/hero-colors.json";

/**
 * A hero's accent colour, for its page: the dominant hue of its official
 * artwork (`scripts/hero-colors.mjs`), made readable on the night grounds.
 *
 * The raw colour is looked up by the path of the artwork the page actually
 * shows, which has gone through `shownIllustrations`: an artwork the site
 * withholds never gives its colour. Without a measure, the page keeps the
 * MLBB gold.
 *
 * The accent tints the poster's light, the gauges, the chips' edge and the
 * focus rings. It is also used as text (the epithet over the name), so it is
 * held to the text contrast (WCAG AA, 4.5:1) on every night ground it can sit
 * on, the lightest one included.
 */

/** The night grounds the accent sits on, darkest to lightest (globals.css). */
export const NIGHT_GROUNDS = ["#06080f", "#0b1020", "#0f1529", "#141b33"] as const;
/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5;
/** The accent without a measure: the gold (`gold-400`). */
export const DEFAULT_ACCENT = "#f5c451";

const COLORS = heroColors as Record<string, string>;

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a) ?? [0, 0, 0]);
  const lb = luminance(hexToRgb(b) ?? [0, 0, 0]);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/**
 * The colour made fit for the page: saturation held in a band (a washed-out
 * accent reads as grey, a screaming one as neon), then lightness raised
 * until it reaches `MIN_CONTRAST` on the lightest night ground. Hue is kept:
 * it is the hero's.
 */
export function readableAccent(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_ACCENT;
  const [h, s0, l0] = rgbToHsl(rgb);
  const s = Math.max(0.5, Math.min(0.85, s0));
  const lightest = NIGHT_GROUNDS[NIGHT_GROUNDS.length - 1];
  let l = Math.max(0.55, Math.min(0.78, l0));
  let out = rgbToHex(hslToRgb(h, s, l));
  while (contrast(out, lightest) < MIN_CONTRAST && l < 0.95) {
    l += 0.01;
    out = rgbToHex(hslToRgb(h, s, l));
  }
  return contrast(out, lightest) >= MIN_CONTRAST ? out : DEFAULT_ACCENT;
}

/** The accent of the artwork at `artwork` (a shown artwork's path), or the gold. */
export function heroAccent(artwork: string | null | undefined): string {
  const raw = artwork ? COLORS[artwork] : undefined;
  return raw ? readableAccent(raw) : DEFAULT_ACCENT;
}

/** The CSS variables the hero page reads (`.hero-accent` in globals.css). */
export function accentStyle(accent: string): Record<"--hero-accent", string> {
  return { "--hero-accent": accent };
}
