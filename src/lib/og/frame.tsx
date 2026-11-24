/* eslint-disable @next/next/no-img-element -- drawn by the image engine (satori), not a page: next/image has no place here. */
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import type { DexPose } from "@/components/mascot";
import type { Locale } from "@/i18n/config";
import type { Tier } from "@/lib/types";
import { FONT_DISPLAY, FONT_TEXT, dexWidth, ogDex, ogFonts, ogPicture } from "./assets";
import { OG_SIZE, TITLE_LINE_HEIGHT, fitTitle, shorten, textWidth } from "./layout";

/**
 * The brand frame of every share image (1200 × 630): the night ground, the
 * official artwork on the right behind a bevelled cut, the éclat along the
 * cut, the "MLBBDEX" wordmark, the title in slanted condensed capitals, and
 * Dex in the pose of the page. Pages only give their words, their artwork
 * and, when they have one, a strip of real data (`aside` or `data`).
 *
 * Palette and signature from `docs/design-system.md`; the engine is satori,
 * which only knows flex boxes: every box with several children is a flex.
 */

export const C = {
  night950: "#06080F",
  night900: "#0B1020",
  night800: "#141B33",
  night700: "#1F2847",
  gold400: "#F5C451",
  gold600: "#C8901E",
  gold300: "#FFD87A",
  azure: "#3D8BFF",
  blood: "#FF4D4D",
  chalk: "#EEF2FB",
  chalk400: "#9AA6C2",
} as const;

export const TIER_COLOR: Record<Tier, string> = {
  "S+": "#FF7A3D",
  S: "#F5C451",
  A: "#3D8BFF",
  B: "#9AA6C2",
  C: "#3A4566",
};

/** Slant of the display face (the site slants Saira with `font-style: italic`). */
export const SLANT = "skewX(-9deg)";

/** Where the artwork's cut starts, from the left edge, at the top and at the foot. */
const CUT_TOP = 560;
const CUT_FOOT = 400;

/** Height of the text column (52 px from the top, 48 from the foot), and what its wordmark and address take. */
const COLUMN_HEIGHT = OG_SIZE.height - 52 - 48;
const COLUMN_FIXED = 40 + 30 + 24;

/** The bevel cut: top-right and bottom-left corners at 45°, `cut` pixels deep. */
export const bevel = (width: number, height: number, cut: number) =>
  `polygon(0px 0px, ${width - cut}px 0px, ${width}px ${cut}px, ${width}px ${height}px, ${cut}px ${height}px, 0px ${height - cut}px)`;

export interface OgFrameProps {
  locale: Locale;
  /** The small gold line above the title: the section, a rank, a date. */
  kicker?: string | null;
  title: string;
  /** One or two lines under the title. */
  subtitle?: string | null;
  /** Artwork shown on the right, behind the cut (a path under `/visuels`). */
  art?: string | null;
  /** Dex's pose; null leaves him out. */
  dex?: DexPose | null;
  dexHeight?: number;
  /** Real data under the subtitle: figures, crests. */
  data?: ReactNode;
  /** Replaces the right part of the frame (a row of portraits, an item). */
  aside?: ReactNode;
  /** Width of the title's box; narrower when an aside takes the right. */
  titleWidth?: number;
  titleLines?: number;
  titleMax?: number;
  /** Where Dex stands: at the foot of the right part (default), or by the cut, when an aside fills the right. */
  dexPlace?: "right" | "cut";
  /** A line after the address, at the foot of the text column. */
  footer?: string | null;
}

/** The "MLBBDEX" wordmark, in text: the logo files in `public/brand` are drawn apart. */
export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          display: "flex",
          width: size * 0.62,
          height: size * 0.72,
          background: `linear-gradient(160deg, ${C.gold300} 0%, ${C.gold400} 45%, ${C.gold600} 100%)`,
          clipPath: bevel(size * 0.62, size * 0.72, size * 0.2),
        }}
      />
      <div
        style={{
          display: "flex",
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: 1,
          transform: SLANT,
        }}
      >
        <span style={{ color: C.chalk }}>MLBB</span>
        <span style={{ color: C.gold400 }}>DEX</span>
      </div>
    </div>
  );
}

/** The éclat: a slanted blade of light, gold fading out at both ends. */
export function Eclat({ width = 260, height = 6, style }: { width?: number; height?: number; style?: Record<string, string | number> }) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        background: `linear-gradient(90deg, ${C.gold600} 0%, ${C.gold300} 35%, ${C.gold400} 60%, rgba(245,196,81,0) 100%)`,
        clipPath: `polygon(${height}px 0px, ${width}px 0px, ${width - height}px ${height}px, 0px ${height}px)`,
        ...style,
      }}
    />
  );
}

/** The big score figure, gold, with an optional label beside it. */
export function Figure({ value, label, color = C.gold400, size = 92 }: { value: string; label?: string; color?: string; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
      <div style={{ display: "flex", fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: size, lineHeight: 0.9, color, transform: SLANT }}>
        {value}
      </div>
      {label && (
        <div
          style={{
            display: "flex",
            fontFamily: FONT_TEXT,
            fontWeight: 600,
            fontSize: 26,
            lineHeight: 1.1,
            color: C.chalk400,
            maxWidth: 220,
            paddingBottom: 6,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/** The tier crest: a bevelled shield coloured by tier. */
export function Crest({ tier, size = 76 }: { tier: Tier; size?: number }) {
  const w = size;
  const h = Math.round(size * 1.15);
  const cut = Math.round(size * 0.22);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: w,
        height: h,
        paddingBottom: Math.round(size * 0.12),
        background: `linear-gradient(160deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 55%), ${TIER_COLOR[tier]}`,
        clipPath: `polygon(0px 0px, ${w - cut}px 0px, ${w}px ${cut}px, ${w}px ${Math.round(h * 0.74)}px, ${w / 2}px ${h}px, 0px ${Math.round(h * 0.74)}px)`,
        fontFamily: FONT_DISPLAY,
        fontWeight: 900,
        fontSize: Math.round(size * 0.48),
        color: C.night950,
        transform: SLANT,
      }}
    >
      {tier}
    </div>
  );
}

/** A bevelled portrait with the hero's name on it, and a figure in gold. */
export function Portrait({
  src,
  name,
  figure,
  figureColor = C.gold400,
  figureSize = 34,
  width,
  height,
}: {
  src: string | null;
  name: string;
  figure?: string;
  /** Blue or red when the figure carries a direction. */
  figureColor?: string;
  figureSize?: number;
  width: number;
  height: number;
}) {
  const cut = Math.round(width * 0.16);
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        background: C.night800,
        clipPath: bevel(width, height, cut),
      }}
    >
      {src && <img src={src} alt="" width={width} height={height} style={{ position: "absolute", left: 0, top: 0, width, height, objectFit: "cover" }} />}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width,
          height: Math.round(height * 0.55),
          display: "flex",
          background: "linear-gradient(180deg, rgba(6,8,15,0) 0%, rgba(6,8,15,0.92) 80%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 10,
          bottom: 12,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {figure && (
          <div style={{ display: "flex", fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: figureSize, lineHeight: 1, color: figureColor, transform: SLANT }}>
            {figure}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: name.length > 9 ? 22 : 26,
            lineHeight: 1.05,
            color: C.chalk,
            textTransform: "uppercase",
            transform: SLANT,
          }}
        >
          {shorten(name, 14)}
        </div>
      </div>
    </div>
  );
}

/** A row of bevelled portraits (tier list, patch, esports), read from the heroes' portraits. */
export async function portraitRow(
  heroes: { portrait: string | null; name: string; figure?: string; figureColor?: string }[],
  { width = 150, height = 244 }: { width?: number; height?: number } = {},
): Promise<ReactNode> {
  const pictures = await Promise.all(heroes.map((h) => ogPicture(h.portrait, width, height, { position: "top" })));
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
      {heroes.map((h, i) => (
        <div key={h.name} style={{ display: "flex", marginBottom: i % 2 === 1 ? 26 : 0 }}>
          <Portrait src={pictures[i]} name={h.name} figure={h.figure} figureColor={h.figureColor} width={width} height={height} />
        </div>
      ))}
    </div>
  );
}

/** The frame itself. */
async function frame(p: OgFrameProps): Promise<ReactNode> {
  // Without artwork, Dex fills the right part on his own: larger.
  const dexHeight = p.dexHeight ?? (p.art || p.aside ? 300 : 400);
  const [art, dex] = await Promise.all([
    p.aside ? Promise.resolve(null) : ogPicture(p.art, OG_SIZE.width - CUT_FOOT, OG_SIZE.height),
    p.dex ? ogDex(p.dex, dexHeight) : Promise.resolve(null),
  ]);
  const titleWidth = p.titleWidth ?? (p.aside ? 600 : 660);
  // What the column holds around the title: the wordmark and the address
  // (fixed), the kicker, the éclat, the subtitle and the data when present.
  const lineHeight = p.locale === "th" ? 1.25 : TITLE_LINE_HEIGHT;
  const around =
    COLUMN_FIXED + (p.kicker ? 48 : 0) + 44 + (p.subtitle ? (textWidth(p.subtitle) * 30 > Math.min(titleWidth, 620) * 2.1 ? 76 : 40) : 0) + (p.data ? 136 : 0);
  const title = fitTitle(p.title, {
    width: titleWidth,
    height: COLUMN_HEIGHT - around,
    lines: p.titleLines ?? 2,
    max: p.titleMax ?? 124,
    min: 52,
    lineHeight,
  });
  const artWidth = OG_SIZE.width - CUT_FOOT;
  // The cut of the art: its left edge runs from CUT_TOP at the top to CUT_FOOT at the foot.
  const cutShift = CUT_TOP - CUT_FOOT;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: `linear-gradient(160deg, ${C.night900} 0%, ${C.night950} 62%)`,
        color: C.chalk,
        fontFamily: FONT_TEXT,
      }}
    >
      {/* A raised night band behind the right part, bevelled, gives the cut its depth even without art. */}
      <div
        style={{
          position: "absolute",
          left: CUT_FOOT - 28,
          top: 0,
          width: artWidth + 28,
          height: OG_SIZE.height,
          display: "flex",
          background: `linear-gradient(200deg, ${C.night800} 0%, ${C.night900} 70%)`,
          clipPath: `polygon(${cutShift + 28}px 0px, ${artWidth + 28}px 0px, ${artWidth + 28}px ${OG_SIZE.height}px, 0px ${OG_SIZE.height}px)`,
        }}
      />
      {art && (
        <div
          style={{
            position: "absolute",
            left: CUT_FOOT,
            top: 0,
            width: artWidth,
            height: OG_SIZE.height,
            display: "flex",
            clipPath: `polygon(${cutShift}px 0px, ${artWidth}px 0px, ${artWidth}px ${OG_SIZE.height}px, 0px ${OG_SIZE.height}px)`,
          }}
        >
          <img src={art} alt="" width={artWidth} height={OG_SIZE.height} style={{ width: artWidth, height: OG_SIZE.height, objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: artWidth,
              height: OG_SIZE.height,
              display: "flex",
              background: "linear-gradient(90deg, rgba(6,8,15,0.88) 0%, rgba(6,8,15,0.35) 38%, rgba(6,8,15,0) 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: artWidth,
              height: 260,
              display: "flex",
              background: "linear-gradient(180deg, rgba(6,8,15,0) 0%, rgba(6,8,15,0.85) 100%)",
            }}
          />
        </div>
      )}
      {/* The éclat along the cut: a thin blade of gold, brightest in the middle. */}
      <div
        style={{
          position: "absolute",
          left: CUT_FOOT - 4,
          top: 0,
          width: cutShift + 12,
          height: OG_SIZE.height,
          display: "flex",
          background: `linear-gradient(180deg, rgba(245,196,81,0) 0%, ${C.gold400} 45%, ${C.gold300} 60%, rgba(245,196,81,0) 100%)`,
          clipPath: `polygon(${cutShift + 4}px 0px, ${cutShift + 10}px 0px, 6px ${OG_SIZE.height}px, 0px ${OG_SIZE.height}px)`,
        }}
      />

      {p.aside && (
        <div
          style={{
            position: "absolute",
            right: 56,
            top: 0,
            height: OG_SIZE.height,
            display: "flex",
            alignItems: "center",
          }}
        >
          {p.aside}
        </div>
      )}

      {dex && p.dex && (
        <img
          src={dex}
          alt=""
          width={dexWidth(p.dex, dexHeight)}
          height={dexHeight}
          style={{
            position: "absolute",
            ...(p.dexPlace === "cut"
              ? { left: CUT_FOOT - dexWidth(p.dex, dexHeight) / 2 + 20 }
              : p.art || p.aside
                ? { right: 34 }
                : { right: Math.round((OG_SIZE.width - CUT_TOP - dexWidth(p.dex, dexHeight)) / 2) - 10 }),
            bottom: p.art || p.aside ? -6 : 60,
            width: dexWidth(p.dex, dexHeight),
            height: dexHeight,
          }}
        />
      )}

      {/* Text column. */}
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 52,
          bottom: 48,
          width: Math.max(titleWidth, 560),
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          {p.kicker && (
            <div
              style={{
                display: "flex",
                fontFamily: FONT_TEXT,
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: C.gold400,
                marginBottom: 10,
              }}
            >
              {shorten(p.kicker, 44)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", width: titleWidth + 40 }}>
            {title.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 900,
                  fontSize: title.size,
                  // Thai marks stand above and below the line: they need room.
                  lineHeight,
                  color: C.chalk,
                  whiteSpace: "nowrap",
                  transform: SLANT,
                  marginLeft: 6,
                }}
              >
                {line}
              </div>
            ))}
          </div>
          <Eclat style={{ marginTop: 20, marginBottom: 18 }} />
          {p.subtitle && (
            <div
              style={{
                display: "flex",
                width: Math.min(titleWidth, 620),
                fontFamily: FONT_TEXT,
                fontWeight: 600,
                fontSize: 30,
                lineHeight: 1.2,
                color: C.chalk400,
              }}
            >
              {shorten(p.subtitle, 96)}
            </div>
          )}
          {p.data && <div style={{ display: "flex", marginTop: 26 }}>{p.data}</div>}
        </div>
        <div style={{ display: "flex", fontFamily: FONT_TEXT, fontWeight: 600, fontSize: 24, color: C.chalk400, letterSpacing: 1 }}>
          {p.footer ? `mlbbdex.com · ${shorten(p.footer, 52)}` : "mlbbdex.com"}
        </div>
      </div>

      {/* The gold foot: a bevelled strip under the text column. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: CUT_FOOT - 8,
          height: 10,
          display: "flex",
          background: `linear-gradient(90deg, ${C.gold600} 0%, ${C.gold400} 70%, ${C.gold300} 100%)`,
          clipPath: `polygon(0px 0px, ${CUT_FOOT - 18}px 0px, ${CUT_FOOT - 8}px 10px, 0px 10px)`,
        }}
      />
    </div>
  );
}

/** A share image in the brand frame, ready to be returned by an `opengraph-image` route. */
export async function ogImage(p: OgFrameProps): Promise<ImageResponse> {
  const [node, fonts] = await Promise.all([frame(p), ogFonts(p.locale)]);
  return new ImageResponse(node as React.ReactElement, { ...OG_SIZE, fonts });
}
