/* eslint-disable @next/next/no-img-element -- drawn by the image engine (satori), not a page: next/image has no place here. */
import { readFile } from "node:fs/promises";
import { celestialLevel } from "@/lib/account-level";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import sharp from "sharp";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { heroesBySlug, illustrations } from "@/lib/data";
import { countryName, readableRank } from "@/lib/ranks";
import { CARD_HEIGHT, CARD_WIDTH, regionOf, winRate, type CardHero, type ProfileSnapshot } from "./snapshot";

/**
 * The profile card the bot posts: a PNG drawn on the site, where the fonts,
 * the rank emblems and the hero artworks are at hand, so the bot stays light.
 *
 * MLBBDex's own look: the site's night blue and gold, its "ML" mark and its
 * heading font (Rajdhani, under the SIL Open Font License, in
 * `public/fonts`). Left, the player: avatar, name, country, id, win-rate
 * gauge, matches and wins, rank. Right, the three most played heroes of the
 * season, each on a strip of its artwork.
 *
 * Images from outside (the avatar on Moonton's CDN, the flag) are fetched
 * with a short timeout and replaced by a plain stand-in when they do not
 * come: a card is always drawn.
 */

export { CARD_HEIGHT, CARD_WIDTH };

const C = {
  night950: "#06080f",
  night900: "#0a0e1a",
  night850: "#0e1424",
  night800: "#131b30",
  night700: "#1c2742",
  night600: "#2a3758",
  gold400: "#f5c451",
  gold500: "#e0a92e",
  gold600: "#b8871f",
  chalk100: "#eef2fb",
  chalk300: "#b7c2da",
  chalk500: "#7b88a6",
  green: "#3fb37f",
  blood: "#ef6b6b",
};

// -- Labels ------------------------------------------------------------------

export interface CardLabels {
  locale: Locale;
  matches: string;
  wins: string;
  winRate: string;
  mvp: string;
  season: (n: number) => string;
  allSeasons: string;
  rank: (key: string) => string;
  highest: string;
  level: (n: number) => string;
  heroesTitle: string;
  noHeroes: string;
  heroMatches: (n: string) => string;
  updated: (date: string) => string;
  minimum: string;
  region: string;
  statsLater: string;
}

/** The card's texts in one of the site's languages, from the site's own catalogue. */
export function cardLabels(locale: Locale): CardLabels {
  const t = createT(locale);
  return {
    locale,
    matches: t("pages.accountProfile.games"),
    wins: t("pages.discordCard.card.wins"),
    winRate: t("pages.heroDetail.stat.winRate"),
    mvp: t("pages.accountProfile.mvp"),
    season: (n) => t("pages.accountProfile.season", { n }),
    allSeasons: t("pages.accountProfile.overAllSeasons"),
    rank: (key) => t(`rankNames.${key}`),
    highest: t("pages.account.bestRank"),
    level: (n) => {
      const celestial = celestialLevel(n);
      return celestial === null ? t("pages.account.levelX", { n }) : t("pages.account.levelCelestial", { n: celestial });
    },
    heroesTitle: t("pages.accountProfile.heroesTitle"),
    noHeroes: t("pages.accountProfile.heroesEmpty"),
    heroMatches: (n) => t("pages.discordCard.card.heroMatches", { n }),
    updated: (date) => t("pages.discordCard.card.updated", { date }),
    minimum: t("pages.discordCard.card.minimum"),
    region: t("pages.discordCard.card.region"),
    statsLater: t("pages.discordCard.card.statsLater"),
  };
}

// -- Assets ------------------------------------------------------------------

const PUBLIC = () => join(process.cwd(), "public");

let fontsLoading: Promise<{ name: string; data: Buffer; weight: 600 | 700; style: "normal" }[]> | null = null;
function fonts() {
  fontsLoading ??= Promise.all([
    readFile(join(PUBLIC(), "fonts", "Rajdhani-SemiBold.ttf")).then((data) => ({ name: "Rajdhani", data, weight: 600 as const, style: "normal" as const })),
    readFile(join(PUBLIC(), "fonts", "Rajdhani-Bold.ttf")).then((data) => ({ name: "Rajdhani", data, weight: 700 as const, style: "normal" as const })),
  ]).catch((error) => {
    fontsLoading = null;
    throw error;
  });
  return fontsLoading;
}

/**
 * Small bounded memo of drawn assets: the same emblems and heroes come back
 * on every card. A failure is not kept: the next card tries again.
 */
class Memo {
  private readonly map = new Map<string, Promise<string | null>>();
  constructor(private readonly max: number) {}
  get(key: string, load: () => Promise<string | null>): Promise<string | null> {
    const known = this.map.get(key);
    if (known) return known;
    const value = load().catch(() => null);
    this.map.set(key, value);
    void value.then((v) => {
      if (v === null && this.map.get(key) === value) this.map.delete(key);
    });
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
    return value;
  }
}

/** About 80 kB each: a few megabytes at most. */
const localAssets = new Memo(150);
const remoteAssets = new Memo(100);

const png = (buffer: Buffer) => `data:image/png;base64,${buffer.toString("base64")}`;

/** A site image (WebP, which the image engine does not read), converted and cropped. */
function siteImage(path: string, width: number, height: number, position: string | number = sharp.strategy.attention): Promise<string | null> {
  if (!/^\/visuels\/[\w./-]+$/.test(path) || path.includes("..")) return Promise.resolve(null);
  return localAssets.get(`${path}:${width}x${height}`, async () =>
    png(await sharp(await readFile(join(PUBLIC(), path))).resize(width, height, { fit: "cover", position }).png().toBuffer()),
  );
}

const MAX_REMOTE_BYTES = 2 * 1024 * 1024;

/** An image from outside, within a few seconds and a size cap, or null. */
async function fetchBytes(url: string, timeoutMs: number): Promise<Buffer | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!response.ok) return null;
  if (Number(response.headers.get("content-length") ?? 0) > MAX_REMOTE_BYTES) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length > MAX_REMOTE_BYTES ? null : bytes;
}

const CDN = /^https:\/\/(akmweb|akmpicture)\.youngjoygame\.com\/[^\s"'<>]+$/;

function remoteImage(url: string | null, width: number, height: number): Promise<string | null> {
  if (!url || !CDN.test(url)) return Promise.resolve(null);
  return remoteAssets.get(`${url}:${width}x${height}`, async () => {
    const bytes = await fetchBytes(url, 4000);
    return bytes ? png(await sharp(bytes).resize(width, height, { fit: "cover" }).png().toBuffer()) : null;
  });
}

/** The avatar cut to an octagon (the image engine has no clip-path), matching the frame. */
function octagonAvatar(url: string | null, size: number): Promise<string | null> {
  if (!url || !CDN.test(url)) return Promise.resolve(null);
  return remoteAssets.get(`octagon:${url}:${size}`, async () => {
    const bytes = await fetchBytes(url, 4000);
    if (!bytes) return null;
    const c = Math.round(size * 0.19);
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><polygon fill="#fff" points="${c},0 ${size - c},0 ${size},${c} ${size},${size - c} ${size - c},${size} ${c},${size} 0,${size - c} 0,${c}"/></svg>`,
    );
    return png(await sharp(bytes).resize(size, size, { fit: "cover" }).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer());
  });
}

/** The country's flag (Twemoji, CC BY 4.0), or null: the country code then stands alone. */
function flag(country: string): Promise<string | null> {
  if (!/^[A-Z]{2}$/.test(country)) return Promise.resolve(null);
  const code = [...country].map((c) => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16)).join("-");
  return remoteAssets.get(`flag:${country}`, async () => {
    const bytes = await fetchBytes(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`, 3000);
    return bytes && bytes.toString("utf8").includes("<svg") ? `data:image/svg+xml;base64,${bytes.toString("base64")}` : null;
  });
}

/** The hero's artwork for its strip: an illustration, else its portrait, else the service's icon. */
function heroArt(hero: CardHero): Promise<string | null> {
  const site = hero.slug ? heroesBySlug.get(hero.slug) : undefined;
  const path = (hero.slug && Object.values(illustrations[hero.slug] ?? {})[0]) || site?.images.portrait;
  if (path) return siteImage(path, 300, 150);
  return remoteImage(hero.image, 150, 150);
}

const svg = (body: string, w: number, h: number) =>
  `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`).toString("base64")}`;

const STAR = svg(`<path fill="${C.gold400}" d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5L7 14l-5.3-5 7.2-.9z"/>`, 24, 24);

/** The win-rate ring: a night track and a gold arc, drawn as SVG. */
function gauge(rate: number | null, size: number): string {
  const r = size / 2 - 11;
  const length = 2 * Math.PI * r;
  const filled = rate === null ? 0 : (Math.max(0, Math.min(100, rate)) / 100) * length;
  return svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.gold400}"/><stop offset="1" stop-color="${C.gold600}"/></linearGradient></defs>` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${C.night700}" stroke-width="14"/>` +
      (filled > 0
        ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#g)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${filled.toFixed(2)} ${length.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`
        : ""),
    size,
    size,
  );
}

// -- Drawing -----------------------------------------------------------------

export interface CardOptions {
  showId: boolean;
  /** When the figures were read. */
  updatedAt: Date;
}

/** The favourite hero's artwork across the whole card, blurred and darkened: the card's mood. */
function backdrop(hero: CardHero | undefined): Promise<string | null> {
  const path = hero?.slug ? Object.values(illustrations[hero.slug] ?? {})[0] || heroesBySlug.get(hero.slug)?.images.portrait : undefined;
  if (!path || !/^\/visuels\/[\w./-]+$/.test(path) || path.includes("..")) return Promise.resolve(null);
  return localAssets.get(`backdrop:${path}`, async () =>
    png(
      await sharp(await readFile(join(PUBLIC(), path)))
        .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
        .blur(5)
        .modulate({ brightness: 0.75, saturation: 1.2 })
        .png()
        .toBuffer(),
    ),
  );
}

/** The avatar's frame: an octagon of gold with an inner bevel and four studs. */
function frame(size: number, accent: string): string {
  const s = size;
  const c = s * 0.2;
  const oct = (inset: number) => {
    const a = c + inset * 0.4;
    const p = [
      [a, inset], [s - a, inset], [s - inset, a], [s - inset, s - a],
      [s - a, s - inset], [a, s - inset], [inset, s - a], [inset, a],
    ];
    return p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  };
  const stud = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.gold400}" stroke="${C.night950}" stroke-width="2"/>`;
  return svg(
    `<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="0.35" stop-color="${C.gold400}"/><stop offset="0.7" stop-color="${C.gold600}"/><stop offset="1" stop-color="#7a5510"/></linearGradient>` +
      `<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.9"/><stop offset="1" stop-color="${accent}" stop-opacity="0.2"/></linearGradient></defs>` +
      `<polygon points="${oct(2)}" fill="none" stroke="url(#f)" stroke-width="9" stroke-linejoin="round"/>` +
      `<polygon points="${oct(12)}" fill="none" stroke="url(#a)" stroke-width="3"/>` +
      stud(s / 2, 3) + stud(s / 2, s - 3) + stud(3, s / 2) + stud(s - 3, s / 2),
    s,
    s,
  );
}

/** A plain globe for the region medallion. */
const GLOBE = svg(
  `<g fill="none" stroke="${C.chalk100}" stroke-width="3.2" stroke-linecap="round">` +
    `<circle cx="40" cy="40" r="30"/><ellipse cx="40" cy="40" rx="13" ry="30"/><path d="M10 40h60M15 25h50M15 55h50"/></g>`,
  80,
  80,
);

/** A medallion's base: a dark disc with a thin ring in the accent colour. */
function disc(size: number, accent: string): string {
  const r = size / 2;
  return svg(
    `<defs><radialGradient id="d" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="${C.night700}"/><stop offset="1" stop-color="${C.night950}"/></radialGradient></defs>` +
      `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="url(#d)" fill-opacity="0.92" stroke="${accent}" stroke-opacity="0.55" stroke-width="2"/>`,
    size,
    size,
  );
}

const MEDAL = 150;

function Medallion({ label, sub, accent, children }: { label: string; sub: ReactNode; accent: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 190 }}>
      <div style={{ display: "flex", position: "relative", width: MEDAL, height: MEDAL, alignItems: "center", justifyContent: "center" }}>
        <img src={disc(MEDAL, accent)} alt="" width={MEDAL} height={MEDAL} style={{ position: "absolute", left: 0, top: 0 }} />
        {children}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 26, marginTop: 8, fontSize: 22, fontWeight: 700, color: C.chalk100, lineHeight: 1 }}>{sub}</div>
      <div style={{ display: "flex", marginTop: 4, fontSize: 17, fontWeight: 700, color: C.chalk500, textTransform: "uppercase", letterSpacing: 2 }}>{label}</div>
    </div>
  );
}

function HeroBanner({ hero, art, rank, labels, format }: { hero: CardHero; art: string | null; rank: number; labels: CardLabels; format: Formats }) {
  const rate = winRate(hero.wins, hero.matches) ?? 0;
  const color = rate >= 55 ? C.green : rate < 45 ? C.blood : C.gold400;
  const W = 450;
  const H = 146;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: W,
        height: H,
        borderRadius: 14,
        overflow: "hidden",
        border: `2px solid rgba(245,196,81,${rank === 1 ? 0.75 : 0.28})`,
        background: C.night850,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      {art && <img src={art} alt="" width={300} height={H} style={{ position: "absolute", right: 0, top: 0, width: 300, height: H, objectFit: "cover" }} />}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          backgroundImage: `linear-gradient(90deg, rgba(10,14,26,0.97) 0%, rgba(10,14,26,0.93) 38%, rgba(10,14,26,0.35) 70%, rgba(10,14,26,0) 100%)`,
        }}
      />
      <div style={{ display: "flex", position: "absolute", left: 18, top: 4, fontSize: 120, fontWeight: 700, lineHeight: 1, color: "rgba(245,196,81,0.13)" }}>{String(rank)}</div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", width: W, height: H, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              background: rank === 1 ? C.gold400 : C.night700,
              color: rank === 1 ? C.night950 : C.gold400,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {String(rank)}
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: C.chalk100, lineHeight: 1, textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}>{hero.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 10 }}>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: C.chalk300 }}>{labels.heroMatches(format.count(hero.matches))}</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color }}>{format.percent(rate)}</div>
        </div>
        <div style={{ display: "flex", marginTop: 10, width: 220, height: 8, borderRadius: 4, background: "rgba(42,55,88,0.9)" }}>
          <div style={{ display: "flex", width: Math.max(8, Math.round((rate / 100) * 220)), height: 8, borderRadius: 4, backgroundImage: `linear-gradient(90deg, ${color}, ${C.gold400})` }} />
        </div>
      </div>
    </div>
  );
}

interface Formats {
  count: (n: number) => string;
  percent: (n: number) => string;
  date: (d: Date) => string;
}

function formats(locale: Locale): Formats {
  const intl = LOCALE_INTL[locale];
  const count = new Intl.NumberFormat(intl);
  const percent = new Intl.NumberFormat(intl, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return { count: (n) => count.format(n), percent: (n) => percent.format(n / 100), date: (d) => date.format(d) };
}

/**
 * The card, as PNG bytes. Left, the player: framed avatar, name, flag,
 * level, then three medallions (win rate, rank, region). Right, the three
 * most played heroes on strips of their artwork. Behind it all, the
 * favourite hero's artwork, blurred; without heroes, a glow of the rank's
 * colour and its emblem, large and faint.
 */
export async function renderCard(snapshot: ProfileSnapshot, labels: CardLabels, options: CardOptions): Promise<Buffer> {
  const format = formats(labels.locale);
  const rank = readableRank(snapshot.rankLevel);
  const best = readableRank(snapshot.rankMaxLevel);
  const rate = winRate(snapshot.wins, snapshot.matches);
  const region = regionOf(snapshot.country);
  const hasHeroes = snapshot.heroes.length > 0;

  const [fontList, avatar, countryFlag, emblem, back, ...arts] = await Promise.all([
    fonts(),
    octagonAvatar(snapshot.avatar, 284),
    flag(snapshot.country),
    rank.image ? siteImage(rank.image, 240, 240, "centre") : Promise.resolve(null),
    backdrop(snapshot.heroes[0]),
    ...snapshot.heroes.map(heroArt),
  ]);

  const rankName = `${labels.rank(rank.key)}${rank.division ? ` ${rank.division}` : ""}`;
  const bestName = `${labels.rank(best.key)}${best.division ? ` ${best.division}` : ""}`;
  const seasonLabel = snapshot.season !== null ? labels.season(snapshot.season) : labels.allSeasons;
  const initials = [...snapshot.name].slice(0, 2).join("").toUpperCase();
  const country = snapshot.country ? countryName(snapshot.country, labels.locale) : "";
  const AV = 176;
  const nameSize = snapshot.name.length > 16 ? 42 : snapshot.name.length > 11 ? 50 : 58;

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          fontFamily: "Rajdhani",
          color: C.chalk100,
          backgroundColor: C.night950,
          overflow: "hidden",
        }}
      >
        {/* Mood: the favourite hero, or the rank's glow. */}
        {back ? (
          <img src={back} alt="" width={CARD_WIDTH} height={CARD_HEIGHT} style={{ position: "absolute", left: 0, top: 0 }} />
        ) : (
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              top: 0,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              backgroundImage: `radial-gradient(circle at 78% 45%, ${rank.color}55 0%, ${C.night900} 45%, ${C.night950} 100%)`,
            }}
          />
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundImage: `linear-gradient(90deg, rgba(6,8,15,0.93) 0%, rgba(6,8,15,0.78) 45%, rgba(6,8,15,0.3) 100%)`,
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundImage: `linear-gradient(180deg, rgba(6,8,15,0) 60%, rgba(6,8,15,0.85) 100%)`,
          }}
        />
        {/* Gold rails. */}
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: CARD_WIDTH, height: 5, backgroundImage: `linear-gradient(90deg, ${C.gold400}, rgba(224,169,46,0.05))` }} />
        <div style={{ display: "flex", position: "absolute", left: 0, bottom: 0, width: CARD_WIDTH, height: 3, backgroundImage: `linear-gradient(270deg, ${C.gold500}, rgba(224,169,46,0))` }} />
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 5, height: CARD_HEIGHT, backgroundImage: `linear-gradient(180deg, ${C.gold400}, rgba(224,169,46,0))` }} />

        {/* Left: the player. */}
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 44, top: 36, width: 640, height: CARD_HEIGHT - 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ display: "flex", position: "relative", width: AV, height: AV, alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", position: "absolute", left: 10, top: 10, width: AV - 20, height: AV - 20, borderRadius: 40, boxShadow: `0 0 40px ${rank.color}66` }} />
              {avatar ? (
                <img src={avatar} alt="" width={AV - 34} height={AV - 34} style={{ width: AV - 34, height: AV - 34 }} />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: AV - 34,
                    height: AV - 34,
                    borderRadius: 26,
                    background: C.night700,
                    color: C.chalk300,
                    fontSize: 54,
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </div>
              )}
              <img src={frame(AV, rank.color)} alt="" width={AV} height={AV} style={{ position: "absolute", left: 0, top: 0 }} />
              {snapshot.season !== null && (
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    left: -8,
                    top: -6,
                    padding: "2px 12px",
                    borderRadius: 8,
                    border: `2px solid ${C.night950}`,
                    backgroundImage: `linear-gradient(135deg, #fff1b8, ${C.gold400} 40%, ${C.gold600})`,
                    color: C.night950,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  {`S${snapshot.season}`}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, lineHeight: 1, color: C.chalk100, textShadow: "0 3px 10px rgba(0,0,0,0.7)" }}>{snapshot.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 23, fontWeight: 600, color: C.chalk300 }}>
                {countryFlag ? (
                  <img src={countryFlag} alt="" width={34} height={34} style={{ width: 34, height: 34 }} />
                ) : snapshot.country ? (
                  <div style={{ display: "flex", padding: "0 8px", borderRadius: 6, background: C.night700, color: C.chalk100, fontSize: 18 }}>{snapshot.country}</div>
                ) : null}
                {country && <div style={{ display: "flex" }}>{country}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                {snapshot.level > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: 32,
                      padding: "0 14px",
                      borderRadius: 16,
                      border: `2px solid ${C.gold500}`,
                      background: "rgba(224,169,46,0.14)",
                      color: C.gold400,
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    {labels.level(snapshot.level)}
                  </div>
                )}
                {options.showId && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: 32,
                      padding: "0 14px",
                      borderRadius: 16,
                      border: `2px solid ${C.night600}`,
                      background: "rgba(19,27,48,0.8)",
                      color: C.chalk300,
                      fontSize: 20,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}
                  >
                    {`ID ${snapshot.roleId} (${snapshot.zoneId})`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Medallions: win rate, rank, region. */}
          <div style={{ display: "flex", gap: 22, marginTop: 34 }}>
            <Medallion label={labels.winRate} sub={snapshot.matches > 0 ? labels.heroMatches(format.count(snapshot.matches)) : "—"} accent={C.gold500}>
              <img src={gauge(rate, MEDAL - 14)} alt="" width={MEDAL - 14} height={MEDAL - 14} style={{ position: "absolute", left: 7, top: 7 }} />
              <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: C.gold400 }}>{rate === null ? "—" : format.percent(rate)}</div>
            </Medallion>
            <Medallion label={rankName} sub={
                snapshot.rankLevel > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <img src={STAR} alt="" width={22} height={22} style={{ width: 22, height: 22 }} />
                    <div style={{ display: "flex" }}>{String(rank.stars)}</div>
                  </div>
                ) : (
                  "—"
                )
              } accent={rank.color}>
              {emblem ? <img src={emblem} alt="" width={118} height={118} style={{ width: 118, height: 118 }} /> : <div style={{ display: "flex" }} />}
            </Medallion>
            <Medallion label={labels.region} sub={region ?? "—"} accent={C.chalk500}>
              <img src={GLOBE} alt="" width={78} height={78} style={{ width: 78, height: 78, opacity: 0.9 }} />
            </Medallion>
          </div>

          {/* Footer: season ribbon and the site. */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: "auto", height: 38 }}>
            {snapshot.season !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 38,
                padding: "0 22px 0 16px",
                backgroundImage: `linear-gradient(90deg, ${C.gold400}, ${C.gold600})`,
                color: C.night950,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                borderRadius: "4px 19px 19px 4px",
              }}
            >
              {seasonLabel}
            </div>
            )}
            {bestName !== rankName && snapshot.rankMaxLevel > snapshot.rankLevel && (
              <div style={{ display: "flex", fontSize: 19, fontWeight: 600, color: C.chalk500, whiteSpace: "nowrap" }}>{`${labels.highest} · ${bestName}`}</div>
            )}
          </div>
        </div>

        {/* Right: most played heroes. */}
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", right: 40, top: 30, width: 450 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: C.gold400, textTransform: "uppercase", letterSpacing: 2.5 }}>{labels.heroesTitle}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, background: C.gold400, color: C.night950, fontSize: 16, fontWeight: 700 }}>ML</div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: C.gold400 }}>MLBBDex</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
            {hasHeroes ? (
              snapshot.heroes.map((hero, i) => <HeroBanner key={`${hero.name}-${i}`} hero={hero} art={arts[i] ?? null} rank={i + 1} labels={labels} format={format} />)
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 450,
                  height: 466,
                  padding: "0 40px",
                  borderRadius: 14,
                  border: `2px solid rgba(245,196,81,0.22)`,
                  backgroundImage: `radial-gradient(circle at 50% 38%, rgba(245,196,81,0.16) 0%, rgba(10,14,26,0.75) 60%)`,
                }}
              >
                {emblem && <img src={emblem} alt="" width={190} height={190} style={{ width: 190, height: 190 }} />}
                <div style={{ display: "flex", marginTop: 10, fontSize: 34, fontWeight: 700, color: rank.color }}>{rankName}</div>
                <div style={{ display: "flex", marginTop: 14, fontSize: 21, fontWeight: 600, color: C.chalk500, lineHeight: 1.3, textAlign: "center" }}>{labels.statsLater}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 18, fontWeight: 600 }}>
            <div style={{ display: "flex", color: C.gold500, letterSpacing: 1 }}>mlbbdex.com</div>
            <div style={{ display: "flex", color: C.chalk500 }}>{labels.updated(format.date(options.updatedAt))}</div>
          </div>
        </div>
        {!snapshot.full && hasHeroes && (
          <div style={{ display: "flex", position: "absolute", left: 44, bottom: 66, fontSize: 16, fontWeight: 600, color: C.chalk500 }}>{labels.minimum}</div>
        )}
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: fontList },
  );
  return Buffer.from(await response.arrayBuffer());
}
