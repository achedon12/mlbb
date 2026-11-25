/* eslint-disable @next/next/no-img-element -- drawn by the image engine (satori), not a page: next/image has no place here. */
/**
 * The README key art: a store-banner poster of MLBBDex, drawn with the share
 * images' pipeline (satori through `next/og`, the faces and pictures of
 * `src/lib/og/assets.ts`, the palette of `frame.tsx`) and finished with sharp
 * (sky, light rays, sparkles, vignette, JPEG).
 *
 *   npm run readme:poster
 *
 * Writes `.github/readme/poster.jpg` (1920 × 1080) and
 * `.github/readme/social-preview.jpg` (1280 × 640, GitHub's social preview),
 * both from the same composition: the social one is laid out on a 1920 × 960
 * canvas, its scene a little smaller, then scaled down.
 *
 * The heroes are picked by hand for their artwork (fan favourites and the
 * meta's leaders); their tier crest comes from the live tier list and every
 * figure of the strip from the game data, so a new run stays true.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";
import sharp from "sharp";
import { LOCALES } from "@/i18n/config";
import { allHeroes } from "@/lib/data";
import { gallerySkinCount } from "@/lib/hero-skins";
import { rankingOfRank } from "@/lib/tier-list";
import type { Tier } from "@/lib/types";
import { FONT_DISPLAY, FONT_TEXT, ogDex, ogFonts, ogPicture } from "@/lib/og/assets";
import { C, Crest, SLANT, bevel } from "@/lib/og/frame";

const ROOT = process.cwd();
const OUT = join(ROOT, ".github", "readme");
const W = 1920;

/** The cast: hero, artwork (under `illustrations/`), where the figure stands across it (0 left, 1 right). */
interface Cast {
  slug: string;
  art: string;
  focus: number;
}

/**
 * Seats around Dex, back to front: x of the card's centre, top, size, tilt,
 * and how far back it sits (0 front, 1 farthest: blurred, darker).
 */
interface Seat {
  cx: number;
  top: number;
  w: number;
  h: number;
  angle: number;
  depth: number;
}

const CAST: Cast[] = [
  { slug: "obsidia", art: "sovereign-of-dark-s-end", focus: 0.5 },
  { slug: "sun", art: "monkey-king", focus: 0.55 },
  { slug: "layla", art: "twilight-waltz", focus: 0.5 },
  { slug: "hirara", art: "gilded-embers", focus: 0.52 },
  { slug: "fanny", art: "lightborn-ranger", focus: 0.36 },
  { slug: "ling", art: "cyan-finch", focus: 0.56 },
];

const SEATS: Seat[] = [
  { cx: 215, top: 215, w: 280, h: 420, angle: -9, depth: 1 },
  { cx: 1705, top: 215, w: 280, h: 420, angle: 9, depth: 1 },
  { cx: 430, top: 350, w: 330, h: 495, angle: -5, depth: 0.5 },
  { cx: 1490, top: 350, w: 330, h: 495, angle: 5, depth: 0.5 },
  { cx: 665, top: 425, w: 380, h: 570, angle: -2.5, depth: 0 },
  { cx: 1255, top: 425, w: 380, h: 570, angle: 2.5, depth: 0 },
];

/** What floats in the corners: rank badges up high, emblems low (paths under `/visuels`). */
const RELICS: { path: string; x: number; y: number; size: number; tile: boolean }[] = [
  { path: "/visuels/rangs/mythic-immortal.webp", x: 150, y: 120, size: 150, tile: false },
  { path: "/visuels/rangs/mythic-glory.webp", x: 1770, y: 120, size: 150, tile: false },
  { path: "/visuels/emblemes/assassin-emblem.webp", x: 112, y: 835, size: 112, tile: false },
  { path: "/visuels/emblemes/mage-emblem.webp", x: 1808, y: 835, size: 112, tile: false },
];

// ── Data ─────────────────────────────────────────────────────────────

const ranking = rankingOfRank("all");
const tierOf = (slug: string): Tier | null => ranking.find((e) => e.hero.slug === slug)?.tier ?? null;
const heroOf = (slug: string) => {
  const hero = allHeroes.find((h) => h.slug === slug);
  if (!hero) throw new Error(`Unknown hero: ${slug}`);
  return hero;
};
const thousands = (n: number) => n.toLocaleString("en-US");

const FACTS: { value: string; label: string }[] = [
  { value: String(allHeroes.length), label: "heroes" },
  { value: thousands(gallerySkinCount), label: "skins" },
  { value: String(LOCALES.length), label: "languages" },
  { value: "Daily", label: "quiz & MLBBdle" },
  { value: "Free", label: "no ads, open source" },
];

// ── Pictures ─────────────────────────────────────────────────────────

const dataUri = (buf: Buffer, type: "png" | "jpeg") => `data:image/${type};base64,${buf.toString("base64")}`;

/** A portrait crop of a 16:9 artwork around the figure, pushed back with blur and shade when it sits far. */
async function artCrop(c: Cast, w: number, h: number, depth: number): Promise<string> {
  const file = join(ROOT, "public", "visuels", "heros", c.slug, "illustrations", `${c.art}.webp`);
  const source = sharp(await readFile(file));
  const { width = 1280, height = 720 } = await source.metadata();
  const cropW = Math.round((height * w) / h);
  const left = Math.max(0, Math.min(width - cropW, Math.round(width * c.focus - cropW / 2)));
  let img = source.extract({ left, top: 0, width: cropW, height }).resize(w, h, { kernel: "lanczos3" });
  img = img.modulate({ brightness: 1 - depth * 0.32, saturation: 1.12 - depth * 0.25 });
  if (depth > 0) img = img.blur(0.3 + depth * 2.2);
  return dataUri(await img.jpeg({ quality: 92 }).toBuffer(), "jpeg");
}

/** An SVG of the brand kit, rasterised at a width, trimmed of its margin. */
async function brandSvg(name: string, width: number): Promise<{ src: string; w: number; h: number }> {
  const svg = await readFile(join(ROOT, "public", "brand", name));
  const buf = await sharp(svg, { density: 600 }).trim({ threshold: 1 }).resize({ width, kernel: "lanczos3" }).png().toBuffer();
  const { height = 0 } = await sharp(buf).metadata();
  return { src: dataUri(buf, "png"), w: width, h: height };
}

// ── Satori ───────────────────────────────────────────────────────────

let fonts: Awaited<ReturnType<typeof ogFonts>>;
async function render(node: ReactNode, width: number, height: number): Promise<Buffer> {
  fonts ??= await ogFonts("en");
  const image = new ImageResponse(node as ReactElement, { width, height, fonts });
  return Buffer.from(await image.arrayBuffer());
}

const abs = (left: number, top: number, extra: Record<string, string | number> = {}) =>
  ({ position: "absolute", left, top, display: "flex", ...extra }) as const;

/**
 * One hero card, as the site draws them: a bevelled frame of gold, the
 * artwork inside, the name in slanted capitals on a night fade, the tier
 * crest when the hero is at the top. Drawn flat, then tilted by sharp
 * (satori clips before it rotates).
 */
async function card(c: Cast, s: Seat, right: boolean): Promise<{ src: string; w: number; h: number }> {
  const { w, h } = s;
  const border = Math.round(w * 0.018) + 3;
  const cut = Math.round(w * 0.17);
  const iw = w - 2 * border;
  const ih = h - 2 * border;
  const icut = cut - Math.round(border * 0.6);
  const art = await artCrop(c, iw, ih, s.depth);
  const hero = heroOf(c.slug);
  const tier = tierOf(c.slug);
  const nameSize = Math.round(w * 0.15);
  const flat = await render(
    <div style={{ display: "flex", position: "relative", width: w, height: h }}>
      <div
        style={abs(0, 0, {
          width: w,
          height: h,
          clipPath: bevel(w, h, cut),
          background: `linear-gradient(155deg, ${C.gold300} 0%, ${C.gold400} 30%, ${C.gold600} 62%, ${C.gold300} 100%)`,
        })}
      />
      <div style={abs(border, border, { width: iw, height: ih, clipPath: bevel(iw, ih, icut), background: C.night900 })}>
        <img src={art} alt="" width={iw} height={ih} style={{ position: "absolute", left: 0, top: 0, width: iw, height: ih }} />
        <div
          style={abs(0, Math.round(ih * 0.5), {
            width: iw,
            height: Math.round(ih * 0.5),
            background: "linear-gradient(180deg, rgba(6,8,15,0) 0%, rgba(6,8,15,0.55) 45%, rgba(6,8,15,0.95) 100%)",
          })}
        />
        <div
          style={abs(0, 0, {
            width: iw,
            height: Math.round(ih * 0.3),
            background: "linear-gradient(180deg, rgba(255,216,122,0.18) 0%, rgba(255,216,122,0) 100%)",
          })}
        />
        {tier && (tier === "S+" || tier === "S") && (
          <div style={abs(right ? iw - Math.round(w * 0.24) : Math.round(w * 0.07), Math.round(w * 0.07))}>
            <Crest tier={tier} size={Math.round(w * 0.17)} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            ...(right ? { right: Math.round(w * 0.1) } : { left: Math.round(w * 0.08) }),
            bottom: Math.round(w * 0.12),
            display: "flex",
            flexDirection: "column",
            alignItems: right ? "flex-end" : "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: FONT_TEXT,
              fontWeight: 700,
              fontSize: Math.round(w * 0.05),
              letterSpacing: 3,
              color: C.gold400,
              textTransform: "uppercase",
            }}
          >
            {hero.roles.join(" · ")}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: FONT_DISPLAY,
              fontWeight: 900,
              fontSize: nameSize,
              lineHeight: 1,
              color: C.chalk,
              textTransform: "uppercase",
              transform: SLANT,
              textShadow: "0 4px 18px rgba(0,0,0,0.6)",
            }}
          >
            {hero.name}
          </div>
        </div>
      </div>
    </div>,
    w,
    h,
  );
  const tilted = await sharp(flat).rotate(s.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(tilted).metadata();
  return { src: dataUri(tilted, "png"), w: meta.width!, h: meta.height! };
}

/** A gold diamond. */
const Diamond = ({ size, color = C.gold400, style }: { size: number; color?: string; style?: Record<string, string | number> }) => (
  <div
    style={{
      display: "flex",
      width: size,
      height: size,
      background: `linear-gradient(135deg, ${C.gold300}, ${color} 50%, ${C.gold600})`,
      clipPath: `polygon(${size / 2}px 0px, ${size}px ${size / 2}px, ${size / 2}px ${size}px, 0px ${size / 2}px)`,
      ...style,
    }}
  />
);

/** The ornament on each side of the logotype: a blade of light ending on diamonds. */
function Ornament({ flip, width }: { flip?: boolean; width: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...(flip ? { transform: "scaleX(-1)" } : {}) }}>
      <Diamond size={14} />
      <div
        style={{
          display: "flex",
          width,
          height: 6,
          background: `linear-gradient(90deg, rgba(245,196,81,0) 0%, ${C.gold600} 30%, ${C.gold300} 100%)`,
          clipPath: `polygon(6px 0px, ${width}px 0px, ${width - 6}px 6px, 0px 6px)`,
        }}
      />
      <Diamond size={30} />
    </div>
  );
}

// ── Sky and light (sharp, SVG) ───────────────────────────────────────

/** A small seeded generator: the same sparkles on every run. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y} Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r} Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y} Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z`;

function hexPattern(size: number) {
  const h = size * Math.sqrt(3);
  const pts = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + size * Math.cos(a)).toFixed(1)},${(cy + size * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  return `<pattern id="hex" width="${size * 3}" height="${h}" patternUnits="userSpaceOnUse">
    <polygon points="${pts(size, h / 2)}" fill="none" stroke="#F5C451" stroke-width="1.2"/>
    <polygon points="${pts(size * 2.5, 0)}" fill="none" stroke="#F5C451" stroke-width="1.2"/>
    <polygon points="${pts(size * 2.5, h)}" fill="none" stroke="#F5C451" stroke-width="1.2"/>
  </pattern>`;
}

/** The sky: violet night over a gold dawn behind Dex, the two bases' colours on the sides, rays, the hex field, the arena ring. */
function skySvg(H: number, cx: number, glowY: number, floorY: number, ring: number) {
  const rays: string[] = [];
  const rnd = random(7);
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI + (i / 26) * Math.PI * 2 + rnd() * 0.08;
    const spread = 0.025 + rnd() * 0.05;
    const R = 2200;
    const p1 = [cx + R * Math.cos(a - spread), glowY + R * Math.sin(a - spread)];
    const p2 = [cx + R * Math.cos(a + spread), glowY + R * Math.sin(a + spread)];
    rays.push(`<polygon points="${cx},${glowY} ${p1.join(",")} ${p2.join(",")}" fill="#FFD87A" opacity="${(0.05 + rnd() * 0.09).toFixed(3)}"/>`);
  }
  const lanes = [-1, 1]
    .flatMap((side) => [
      `M${cx + side * ring * 0.9} ${floorY} Q${cx + side * 700} ${floorY - 40} ${cx + side * 1100} ${floorY - 10}`,
      `M${cx + side * ring * 0.6} ${floorY + 40} Q${cx + side * 600} ${floorY + 120} ${cx + side * 1000} ${H + 40}`,
    ])
    .map((d) => `<path d="${d}" fill="none" stroke="#F5C451" stroke-width="3" opacity="0.22"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#090824"/>
      <stop offset="0.28" stop-color="#1D1656"/>
      <stop offset="0.5" stop-color="#3A1F6E"/>
      <stop offset="0.68" stop-color="#4B2366"/>
      <stop offset="0.84" stop-color="#1A1438"/>
      <stop offset="1" stop-color="#06080F"/>
    </linearGradient>
    <radialGradient id="dawn" cx="${cx}" cy="${glowY}" r="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFE7A8" stop-opacity="0.95"/>
      <stop offset="0.18" stop-color="#F5C451" stop-opacity="0.6"/>
      <stop offset="0.45" stop-color="#E0702E" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#B0306A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blue" cx="120" cy="${H * 0.35}" r="900" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#3D8BFF" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#3D8BFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="red" cx="${W - 120}" cy="${H * 0.35}" r="900" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FF4D4D" stop-opacity="0.36"/>
      <stop offset="1" stop-color="#FF4D4D" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="hexfade" cx="${cx}" cy="${glowY}" r="1100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="0.6" stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="hexmask"><rect width="${W}" height="${H}" fill="url(#hexfade)"/></mask>
    <radialGradient id="floor" cx="${cx}" cy="${floorY}" r="${ring}" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${floorY}) scale(1 0.2) translate(0 ${-floorY})">
      <stop offset="0" stop-color="#FFD87A" stop-opacity="0.8"/>
      <stop offset="0.55" stop-color="#C8901E" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#C8901E" stop-opacity="0"/>
    </radialGradient>
    ${hexPattern(34)}
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="haze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#blue)"/>
  <rect width="${W}" height="${H}" fill="url(#red)"/>
  <g filter="url(#haze)" opacity="0.55">
    <ellipse cx="${cx - 620}" cy="${glowY + 60}" rx="420" ry="70" fill="#7A4AB8"/>
    <ellipse cx="${cx + 640}" cy="${glowY + 30}" rx="460" ry="80" fill="#8A3F9A"/>
    <ellipse cx="${cx}" cy="${glowY + 190}" rx="900" ry="90" fill="#5A2C7A"/>
  </g>
  <g filter="url(#soft)">${rays.join("")}</g>
  <rect width="${W}" height="${H}" fill="url(#hex)" mask="url(#hexmask)" opacity="0.13"/>
  <rect width="${W}" height="${H}" fill="url(#dawn)"/>
  ${lanes}
  <ellipse cx="${cx}" cy="${floorY}" rx="${ring * 1.25}" ry="${ring * 0.25}" fill="url(#floor)"/>
  <ellipse cx="${cx}" cy="${floorY}" rx="${ring}" ry="${ring * 0.17}" fill="none" stroke="#FFD87A" stroke-width="4" opacity="0.75"/>
  <ellipse cx="${cx}" cy="${floorY}" rx="${ring * 0.72}" ry="${ring * 0.12}" fill="none" stroke="#FFD87A" stroke-width="2" opacity="0.5"/>
  <ellipse cx="${cx}" cy="${floorY}" rx="${ring * 1.45}" ry="${ring * 0.25}" fill="none" stroke="#F5C451" stroke-width="2" stroke-dasharray="14 18" opacity="0.3"/>
</svg>`;
}

/** The vignette, under the logotype and the strip so they keep their light. */
function vignetteSvg(H: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="vig" cx="${W / 2}" cy="${H * 0.48}" r="${W * 0.62}" gradientUnits="userSpaceOnUse" gradientTransform="translate(${W / 2} ${H * 0.48}) scale(1 0.72) translate(${-W / 2} ${-H * 0.48})">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#02030A" stop-opacity="0.72"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;
}

/** Sparkles and embers, laid over everything. */
type Box = [number, number, number, number];
const inside = (x: number, y: number, boxes: Box[]) => boxes.some(([l, t, r, b]) => x > l && x < r && y > t && y < b);

function overlaySvg(H: number, cx: number, glowY: number, clear: Box[]) {
  const rnd = random(42);
  const sparkles: string[] = [];
  const embers: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W;
    const y = 30 + rnd() * (H - 180);
    // Keep the logotype, the tagline and Dex clear.
    if (inside(x, y, clear)) continue;
    const r = 5 + rnd() ** 3 * 22;
    const color = rnd() > 0.35 ? "#FFE3A0" : "#FFFFFF";
    sparkles.push(`<path d="${star(x, y, r)}" fill="${color}" opacity="${(0.55 + rnd() * 0.45).toFixed(2)}"/>`);
  }
  for (let i = 0; i < 110; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 120 + rnd() ** 0.7 * 900;
    const x = cx + Math.cos(a) * d * 1.2;
    const y = glowY + Math.sin(a) * d * 0.55;
    if (y > H - 60 || y < 0 || inside(x, y, clear)) continue;
    const r = 1.2 + rnd() * 3.2;
    const color = rnd() > 0.5 ? "#FFB347" : "#FFD87A";
    embers.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="emb" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#emb)">${embers.join("")}</g>
  <g filter="url(#glow)">${sparkles.join("")}</g>
</svg>`;
}

// ── Composition ──────────────────────────────────────────────────────

async function poster(H: number): Promise<Buffer> {
  const cx = W / 2;
  const bar = 112;
  // On a shorter canvas the scene shrinks around its foot, under the logotype.
  const k = H >= 1080 ? 1 : 0.86;
  const foot = H - bar + 30;
  const place = (s: Seat): Seat => ({
    cx: cx + (s.cx - cx) * (k === 1 ? 1 : 0.94),
    top: foot - (1080 - bar + 30 - s.top) * k,
    w: Math.round(s.w * k),
    h: Math.round(s.h * k),
    angle: s.angle,
    depth: s.depth,
  });
  const seats = SEATS.map(place);
  const dexH = Math.round(470 * k);
  const dexTop = foot - 40 - dexH;
  const glowY = dexTop + dexH * 0.35;
  const dexW = Math.round((276 / 308) * dexH);
  const logoTop = k === 1 ? 34 : 22;
  const floorY = foot - 52;

  const [vignette, sky, overlay, cards, relics, dex, logo] = await Promise.all([
    sharp(Buffer.from(vignetteSvg(H))).png().toBuffer(),
    sharp(Buffer.from(skySvg(H, cx, glowY, floorY, 330 * k))).png().toBuffer(),
    sharp(Buffer.from(overlaySvg(H, cx, glowY, [
      [cx - 470, 0, cx + 470, logoTop + 400],
      [cx - dexW / 2 - 20, dexTop - 20, cx + dexW / 2 + 20, dexTop + dexH + 20],
    ]))).png().toBuffer(),
    Promise.all(CAST.map((c, i) => card(c, seats[i], seats[i].cx > cx))),
    Promise.all(RELICS.map((r) => ogPicture(r.path, Math.round(r.size * (r.tile ? 0.78 : 1)), Math.round(r.size * (r.tile ? 0.78 : 1)), { fit: "contain" }))),
    ogDex("victoire", dexH),
    brandSvg("logo.svg", k === 1 ? 800 : 690),
  ]);
  const subtitleTop = logoTop + logo.h + (k === 1 ? 14 : 8);

  const scene = await render(
    <div style={{ display: "flex", position: "relative", width: W, height: H, background: "transparent" }}>
      <img src={dataUri(sky, "png")} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} />

      {/* Cards, back to front, each with its halo. */}
      {cards.map((c, i) => {
        const s = seats[i];
        const cy = s.top + s.h / 2;
        return (
          <div key={i} style={abs(0, 0, { width: W, height: H })}>
            <div
              style={abs(s.cx - s.w / 2 - 10, s.top + 26, {
                width: s.w + 20,
                height: s.h,
                background: s.depth === 0 ? "rgba(255,190,90,0.55)" : "rgba(4,4,16,0.7)",
                filter: `blur(${s.depth === 0 ? 34 : 24}px)`,
                transform: `rotate(${s.angle}deg)`,
              })}
            />
            <img src={c.src} alt="" width={c.w} height={c.h} style={{ position: "absolute", left: Math.round(s.cx - c.w / 2), top: Math.round(cy - c.h / 2) }} />
          </div>
        );
      })}

      {/* Relics in the corners: rank badges and item tiles, haloed. */}
      {RELICS.map((r, i) => {
        const y = r.y > 500 ? H - (1080 - r.y) : r.y;
        const inner = Math.round(r.size * 0.78);
        return (
          <div key={r.path} style={abs(r.x - r.size / 2, y - r.size / 2, { width: r.size, height: r.size, alignItems: "center", justifyContent: "center" })}>
            <div
              style={abs(-r.size * 0.3, -r.size * 0.3, {
                width: r.size * 1.6,
                height: r.size * 1.6,
                background: "radial-gradient(circle at center, rgba(255,216,122,0.45) 0%, rgba(255,216,122,0) 62%)",
              })}
            />
            {r.tile ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: r.size,
                  height: r.size,
                  background: `linear-gradient(155deg, ${C.gold300}, ${C.gold600})`,
                  clipPath: bevel(r.size, r.size, Math.round(r.size * 0.22)),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: r.size - 8,
                    height: r.size - 8,
                    background: `linear-gradient(160deg, ${C.night700} 0%, ${C.night950} 100%)`,
                    clipPath: bevel(r.size - 8, r.size - 8, Math.round(r.size * 0.2)),
                  }}
                >
                  {relics[i] && <img src={relics[i]!} alt="" width={inner} height={inner} />}
                </div>
              </div>
            ) : (
              relics[i] && <img src={relics[i]!} alt="" width={r.size} height={r.size} style={{ filter: "drop-shadow(0px 8px 16px rgba(0,0,0,0.6))" }} />
            )}
          </div>
        );
      })}

      {/* Dex, at the heart of the dawn. */}
      <div
        style={abs(cx - 360, dexTop - 120, {
          width: 720,
          height: 720,
          background: "radial-gradient(circle at center, rgba(255,236,180,0.75) 0%, rgba(245,196,81,0.35) 30%, rgba(245,196,81,0) 66%)",
        })}
      />
      {dex && (
        <img
          src={dex}
          alt=""
          width={dexW}
          height={dexH}
          style={{ position: "absolute", left: Math.round(cx - dexW / 2), top: dexTop, filter: "drop-shadow(0px 0px 18px rgba(255,216,122,0.75))" }}
        />
      )}

      <img src={dataUri(vignette, "png")} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} />

      {/* Logotype: the shade that seats it, the logo, the ornaments, the tagline. */}
      <div
        style={abs(cx - 620, 0, {
          width: 1240,
          height: subtitleTop + 120,
          background: "radial-gradient(ellipse at center, rgba(6,8,20,0.78) 0%, rgba(6,8,20,0.45) 45%, rgba(6,8,20,0) 72%)",
        })}
      />
      <div
        style={abs(cx - logo.w * 0.62, logoTop - logo.h * 0.25, {
          width: logo.w * 1.24,
          height: logo.h * 1.5,
          background: "radial-gradient(ellipse at center, rgba(245,196,81,0.32) 0%, rgba(245,196,81,0.1) 40%, rgba(245,196,81,0) 70%)",
        })}
      />
      <img
        src={logo.src}
        alt=""
        width={logo.w}
        height={logo.h}
        style={{ position: "absolute", left: cx - logo.w / 2, top: logoTop, filter: "drop-shadow(0px 10px 22px rgba(0,0,0,0.75))" }}
      />
      <div style={abs(cx - logo.w / 2 - 290, logoTop + logo.h * 0.42)}>
        <Ornament width={230} />
      </div>
      <div style={abs(cx + logo.w / 2 + 14, logoTop + logo.h * 0.42)}>
        <Ornament width={230} flip />
      </div>
      <div style={abs(0, subtitleTop, { width: W, justifyContent: "center", alignItems: "center", gap: 22 })}>
        <Diamond size={12} />
        <div
          style={{
            display: "flex",
            fontFamily: FONT_TEXT,
            fontWeight: 700,
            fontSize: k === 1 ? 30 : 27,
            letterSpacing: k === 1 ? 5 : 4,
            color: C.chalk,
            textTransform: "uppercase",
            textShadow: "0 2px 14px rgba(0,0,0,0.9)",
          }}
        >
          Mobile Legends: Bang Bang knowledge base
        </div>
        <Diamond size={12} />
      </div>

      {/* The strip of facts. */}
      <div
        style={abs(0, H - bar - 50, {
          width: W,
          height: bar + 50,
          background: "linear-gradient(180deg, rgba(6,8,15,0) 0%, rgba(6,8,15,0.88) 38%, rgba(6,8,15,0.97) 100%)",
        })}
      />
      <div
        style={abs(0, H - bar, {
          width: W,
          height: 3,
          background: `linear-gradient(90deg, rgba(245,196,81,0) 0%, ${C.gold600} 22%, ${C.gold300} 50%, ${C.gold600} 78%, rgba(245,196,81,0) 100%)`,
        })}
      />
      <div style={abs(0, H - bar, { width: W, height: bar, justifyContent: "center", alignItems: "center", gap: 46 })}>
        {FACTS.flatMap((f, i) => [
          ...(i ? [<Diamond key={`d${i}`} size={14} />] : []),
          <div key={f.label} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div
              style={{
                display: "flex",
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: 60,
                lineHeight: 1.1,
                paddingRight: 8,
                backgroundImage: `linear-gradient(180deg, #FFF1C4 0%, ${C.gold300} 30%, ${C.gold400} 70%, #E3A93A 100%)`,
                backgroundClip: "text",
                color: "transparent",
                transform: SLANT,
                textTransform: "uppercase",
              }}
            >
              {f.value}
            </div>
            <div style={{ display: "flex", fontFamily: FONT_TEXT, fontWeight: 700, fontSize: 27, letterSpacing: 2, color: C.chalk, textTransform: "uppercase" }}>
              {f.label}
            </div>
          </div>,
        ])}
      </div>
    </div>,
    W,
    H,
  );

  return sharp(scene).composite([{ input: overlay }]).flatten({ background: C.night950 }).png().toBuffer();
}

await mkdir(OUT, { recursive: true });
const [big, wide] = await Promise.all([poster(1080), poster(960)]);
const posterJpg = await sharp(big).jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
const socialJpg = await sharp(wide).resize(1280, 640, { kernel: "lanczos3" }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
await writeFile(join(OUT, "poster.jpg"), posterJpg);
await writeFile(join(OUT, "social-preview.jpg"), socialJpg);
console.log(`poster.jpg ${(posterJpg.length / 1024).toFixed(0)} KB · social-preview.jpg ${(socialJpg.length / 1024).toFixed(0)} KB`);
