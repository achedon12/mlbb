/* eslint-disable @next/next/no-img-element -- drawn by the image engine (satori), not a page: next/image has no place here. */
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import type { DexPose } from "@/components/mascot";
import type { Locale } from "@/i18n/config";
import { SHARE_SIZES } from "@/lib/share-card";
import { FONT_DISPLAY, FONT_TEXT, dexWidth, ogDex, ogFonts, ogPicture } from "./assets";
import { C, Eclat, SLANT, Wordmark, bevel } from "./frame";
import { TITLE_LINE_HEIGHT, fitTitle, shorten } from "./layout";

/**
 * The portrait frame of the share images (1080 × 1350, 4:5, what feeds and
 * stories crop least): the official artwork across the top behind a
 * bevelled foot, the title in slanted condensed capitals overlapping it, the
 * card's own data in the middle, and at the foot Dex with one line in his
 * voice beside the address. Same palette, faces and signature as the
 * landscape frame (`frame.tsx`); satori only knows flex boxes.
 *
 * The social kit (`social-kit.tsx`) draws its square (1080 × 1080) and story
 * (1080 × 1920) in the same frame: `size` sets the image, `safeTop` and
 * `safeBottom` keep the words and Dex out of the bands a story app covers.
 */

const SIDE = 64;

export interface PortraitProps {
  locale: Locale;
  kicker?: string | null;
  title: string;
  subtitle?: string | null;
  /** Official artwork across the top (a path under `/visuels`). */
  art?: string | null;
  /** Height of the artwork band; the body takes what is left. */
  artHeight?: number;
  dex: DexPose;
  /** Dex's line, in his voice (`tu`, short). */
  quote?: string | null;
  /** The card's data, between the title and the foot. */
  body: ReactNode;
  /** Size of the image: the share images' portrait by default; the social kit's square and story too. */
  size?: { width: number; height: number };
  /** Bands kept clear of words at the top and the foot (a story's app interface); the art and the ground run under them. */
  safeTop?: number;
  safeBottom?: number;
  /** Dex's height at the foot (220 by default); the foot band follows it. */
  dexHeight?: number;
  /** Largest size of the title. */
  titleMax?: number;
}

async function portrait(p: PortraitProps): Promise<ReactNode> {
  const W = p.size?.width ?? SHARE_SIZES.portrait.width;
  const safeTop = p.safeTop ?? 0;
  const safeBottom = p.safeBottom ?? 0;
  const artHeight = p.artHeight ?? 560;
  const dexHeight = p.dexHeight ?? 220;
  /** Height of the foot band: Dex, his line and the address. */
  const FOOT = dexHeight + 30 + safeBottom;
  const quoteWidth = W - SIDE * 2 - dexWidth(p.dex, dexHeight) - 24;
  const quoteHeight = dexHeight >= 200 ? 120 : 100;
  const [art, dex] = await Promise.all([ogPicture(p.art, W, artHeight), ogDex(p.dex, dexHeight)]);
  const lineHeight = p.locale === "th" ? 1.25 : TITLE_LINE_HEIGHT;
  const title = fitTitle(p.title, { width: W - SIDE * 2 - 40, lines: 2, max: p.titleMax ?? 132, min: 64, height: 260, lineHeight });
  const cut = 140;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: `linear-gradient(170deg, ${C.night900} 0%, ${C.night950} 55%)`,
        color: C.chalk,
        fontFamily: FONT_TEXT,
      }}
    >
      {/* The artwork band, its bottom-left corner cut at 45°, night closing in from the foot. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: artHeight,
          display: "flex",
          background: `linear-gradient(200deg, ${C.night800} 0%, ${C.night900} 70%)`,
          clipPath: `polygon(0px 0px, ${W}px 0px, ${W}px ${artHeight}px, ${cut}px ${artHeight}px, 0px ${artHeight - cut}px)`,
        }}
      >
        {art && <img src={art} alt="" width={W} height={artHeight} style={{ width: W, height: artHeight, objectFit: "cover" }} />}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: W,
            height: Math.round(artHeight * 0.7),
            display: "flex",
            background: "linear-gradient(180deg, rgba(6,8,15,0) 0%, rgba(6,8,15,0.7) 55%, rgba(6,8,15,0.96) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: W,
            height: 200 + safeTop,
            display: "flex",
            background: "linear-gradient(180deg, rgba(6,8,15,0.75) 0%, rgba(6,8,15,0) 100%)",
          }}
        />
      </div>
      {/* The éclat along the art's foot. */}
      <Eclat width={W - cut - SIDE} height={8} style={{ position: "absolute", left: cut, top: artHeight - 4 }} />

      {/* Wordmark over the art. */}
      <div style={{ position: "absolute", left: SIDE, top: 56 + safeTop, display: "flex" }}>
        <Wordmark size={46} />
      </div>

      {/* Title, overlapping the art's foot. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          height: artHeight - 18,
          paddingLeft: SIDE,
          paddingRight: SIDE,
        }}
      >
        {p.kicker && (
          <div
            style={{
              display: "flex",
              fontFamily: FONT_TEXT,
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: C.gold400,
              marginBottom: 8,
            }}
          >
            {shorten(p.kicker, 48)}
          </div>
        )}
        {title.lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontFamily: FONT_DISPLAY,
              fontWeight: 900,
              fontSize: title.size,
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

      {p.subtitle && (
        <div
          style={{
            display: "flex",
            paddingLeft: SIDE,
            paddingRight: SIDE,
            marginTop: 30,
            fontFamily: FONT_TEXT,
            fontWeight: 600,
            fontSize: 34,
            lineHeight: 1.2,
            color: C.chalk400,
          }}
        >
          {shorten(p.subtitle, 70)}
        </div>
      )}

      {/* The card's data. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flexGrow: 1,
          paddingLeft: SIDE,
          paddingRight: SIDE,
          paddingBottom: FOOT,
          paddingTop: 24,
        }}
      >
        {p.body}
      </div>

      {/* Foot: Dex's line and the address on the left, Dex on the right. */}
      <div
        style={{
          position: "absolute",
          left: SIDE,
          bottom: 52 + safeBottom,
          width: quoteWidth,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {p.quote && (
          <div
            style={{
              display: "flex",
              padding: "20px 26px",
              background: C.night800,
              clipPath: bevel(quoteWidth, quoteHeight, 18),
              height: quoteHeight,
              alignItems: "center",
              fontFamily: FONT_TEXT,
              fontWeight: 600,
              fontSize: 30,
              lineHeight: 1.2,
              color: C.chalk,
            }}
          >
            {shorten(p.quote, 90)}
          </div>
        )}
        <div style={{ display: "flex", fontFamily: FONT_TEXT, fontWeight: 700, fontSize: 30, color: C.gold400, letterSpacing: 1 }}>
          mlbbdex.com
        </div>
      </div>
      {dex && (
        <img
          src={dex}
          alt=""
          width={dexWidth(p.dex, dexHeight)}
          height={dexHeight}
          style={{ position: "absolute", right: SIDE - 20, bottom: 36 + safeBottom, width: dexWidth(p.dex, dexHeight), height: dexHeight }}
        />
      )}

      {/* The gold foot strip. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: W * 0.62,
          height: 12,
          display: "flex",
          background: `linear-gradient(90deg, ${C.gold600} 0%, ${C.gold400} 70%, ${C.gold300} 100%)`,
          clipPath: `polygon(0px 0px, ${W * 0.62 - 12}px 0px, ${W * 0.62}px 12px, 0px 12px)`,
        }}
      />
    </div>
  );
}

/** A portrait share image (1080 × 1350), or the size `size` gives. */
export async function portraitImage(p: PortraitProps): Promise<ImageResponse> {
  const [node, fonts] = await Promise.all([portrait(p), ogFonts(p.locale)]);
  return new ImageResponse(node as React.ReactElement, { ...(p.size ?? SHARE_SIZES.portrait), fonts });
}

/** A square of an MLBBdle grid, coloured like the game's share text. */
export const CELL_COLOR: Record<"m" | "p" | "x" | "u", string> = {
  m: C.azure,
  p: "#FF7A3D",
  x: C.blood,
  u: C.night700,
};

/** A grid of verdict squares, bevelled, rows top to bottom. */
export function CellGrid({ rows, cell, gap }: { rows: ("m" | "p" | "x" | "u")[][]; cell: number; gap: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap }}>
          {row.map((c, j) => (
            <div
              key={j}
              style={{ display: "flex", width: cell, height: cell, background: CELL_COLOR[c], clipPath: bevel(cell, cell, Math.round(cell * 0.22)) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
