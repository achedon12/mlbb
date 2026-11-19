/* eslint-disable @next/next/no-img-element -- drawn by the image engine (satori), not a page: next/image has no place here. */
import { readFile } from "node:fs/promises";
import { celestialLevel } from "@/lib/account-level";
import { join } from "node:path";
import { ImageResponse } from "next/og";
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
}

/** The card's texts in one of the site's languages, from the site's own catalogue. */
export function cardLabels(locale: Locale): CardLabels {
  const t = createT(locale);
  return {
    locale,
    matches: t("pages.accountProfile.games"),
    wins: t("pages.discordCard.card.wins"),
    winRate: t("pages.accountProfile.colWin"),
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

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: 9,
          background: C.gold400,
          color: C.night950,
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        ML
      </div>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.gold400, letterSpacing: 0.5 }}>MLBBDex</div>
    </div>
  );
}

function Pill({ children, gold = false }: { children: string; gold?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 34,
        padding: "0 16px",
        borderRadius: 17,
        border: `2px solid ${gold ? C.gold500 : C.night600}`,
        background: gold ? "rgba(224,169,46,0.12)" : C.night800,
        color: gold ? C.gold400 : C.chalk300,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 1,
      }}
    >
      {children}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 120 }}>
      <div style={{ display: "flex", fontSize: 19, fontWeight: 600, color: C.chalk500, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: C.chalk100, lineHeight: 1.05 }}>{value}</div>
    </div>
  );
}

function HeroStrip({ hero, art, labels, format }: { hero: CardHero; art: string | null; labels: CardLabels; format: Formats }) {
  const rate = winRate(hero.wins, hero.matches) ?? 0;
  const color = rate >= 55 ? C.green : rate < 45 ? C.blood : C.gold400;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: 430,
        height: 128,
        borderRadius: 12,
        overflow: "hidden",
        border: `2px solid ${C.night700}`,
        background: C.night800,
      }}
    >
      {art && <img src={art} alt="" width={256} height={128} style={{ position: "absolute", right: 0, top: 0, width: 256, height: 128, objectFit: "cover" }} />}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: 430,
          height: 128,
          backgroundImage: `linear-gradient(90deg, ${C.night850} 0%, ${C.night850} 42%, rgba(14,20,36,0.55) 72%, rgba(14,20,36,0.15) 100%)`,
        }}
      />
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 5, height: 128, background: C.gold500 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 22px", width: 430, height: 128, position: "relative" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.chalk100, lineHeight: 1.1 }}>{hero.name}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 4 }}>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: C.chalk300 }}>{labels.heroMatches(format.count(hero.matches))}</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color }}>{format.percent(rate)}</div>
        </div>
        <div style={{ display: "flex", marginTop: 10, width: 200, height: 8, borderRadius: 4, background: C.night600 }}>
          <div style={{ display: "flex", width: Math.round((rate / 100) * 200), height: 8, borderRadius: 4, background: color }} />
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

/** The card, as PNG bytes. */
export async function renderCard(snapshot: ProfileSnapshot, labels: CardLabels, options: CardOptions): Promise<Buffer> {
  const format = formats(labels.locale);
  const rank = readableRank(snapshot.rankLevel);
  const best = readableRank(snapshot.rankMaxLevel);
  const rate = winRate(snapshot.wins, snapshot.matches);
  const region = regionOf(snapshot.country);

  const [fontList, avatar, countryFlag, emblem, ...arts] = await Promise.all([
    fonts(),
    remoteImage(snapshot.avatar, 240, 240),
    flag(snapshot.country),
    rank.image ? siteImage(rank.image, 240, 240, "centre") : Promise.resolve(null),
    ...snapshot.heroes.map(heroArt),
  ]);

  const rankName = `${labels.rank(rank.key)}${rank.division ? ` ${rank.division}` : ""}`;
  const bestName = `${labels.rank(best.key)}${best.division ? ` ${best.division}` : ""}`;
  const seasonLabel = snapshot.season !== null ? labels.season(snapshot.season) : labels.allSeasons;
  const initials = [...snapshot.name].slice(0, 2).join("").toUpperCase();
  const country = snapshot.country ? countryName(snapshot.country, labels.locale) : "";

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          padding: "34px 40px 26px",
          fontFamily: "Rajdhani",
          color: C.chalk100,
          backgroundColor: C.night950,
          backgroundImage: `linear-gradient(135deg, ${C.night900} 0%, ${C.night850} 55%, #141d36 100%)`,
        }}
      >
        {/* Gold rails: the site's section rule, top and bottom. */}
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: CARD_WIDTH, height: 6, backgroundImage: `linear-gradient(90deg, ${C.gold500}, rgba(224,169,46,0))` }} />
        <div style={{ display: "flex", position: "absolute", right: -160, top: -160, width: 520, height: 520, borderRadius: 260, border: `2px solid rgba(224,169,46,0.10)` }} />
        <div style={{ display: "flex", position: "absolute", right: -100, top: -100, width: 400, height: 400, borderRadius: 200, border: `2px solid rgba(224,169,46,0.07)` }} />

        {/* Header: brand, season, region. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo />
          <div style={{ display: "flex", gap: 10 }}>
            {region && <Pill>{region}</Pill>}
            <Pill gold>{seasonLabel.toUpperCase()}</Pill>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, marginTop: 24, gap: 40 }}>
          {/* Left: the player. */}
          <div style={{ display: "flex", flexDirection: "column", width: 650 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ display: "flex", padding: 4, borderRadius: 22, backgroundImage: `linear-gradient(135deg, ${C.gold400}, ${C.gold600})` }}>
                <div style={{ display: "flex", padding: 4, borderRadius: 18, background: C.night900 }}>
                  {avatar ? (
                    <img src={avatar} alt="" width={116} height={116} style={{ width: 116, height: 116, borderRadius: 14 }} />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 116,
                        height: 116,
                        borderRadius: 14,
                        background: C.night700,
                        color: C.chalk300,
                        fontSize: 44,
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", fontSize: snapshot.name.length > 14 ? 44 : 56, fontWeight: 700, lineHeight: 1.05, color: C.chalk100 }}>{snapshot.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 22, fontWeight: 600, color: C.chalk300 }}>
                  {countryFlag ? (
                    <img src={countryFlag} alt="" width={34} height={34} style={{ width: 34, height: 34 }} />
                  ) : snapshot.country ? (
                    <div style={{ display: "flex", padding: "0 8px", borderRadius: 6, background: C.night700, color: C.chalk100, fontSize: 18 }}>{snapshot.country}</div>
                  ) : null}
                  {country && <div style={{ display: "flex" }}>{country}</div>}
                  {snapshot.level > 0 && <div style={{ display: "flex", color: C.chalk500 }}>{`· ${labels.level(snapshot.level)}`}</div>}
                </div>
                {options.showId && (
                  <div style={{ display: "flex", marginTop: 6, fontSize: 22, fontWeight: 600, color: C.chalk500, letterSpacing: 1 }}>
                    {`ID ${snapshot.roleId} (${snapshot.zoneId})`}
                  </div>
                )}
              </div>
            </div>

            {/* Win rate and figures. */}
            <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 28 }}>
              <div style={{ display: "flex", position: "relative", width: 150, height: 150 }}>
                <img src={gauge(rate, 150)} alt="" width={150} height={150} style={{ position: "absolute", left: 0, top: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 150, height: 150 }}>
                  <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: C.gold400, lineHeight: 1 }}>{rate === null ? "—" : format.percent(rate)}</div>
                  <div style={{ display: "flex", fontSize: 16, fontWeight: 600, color: C.chalk500, textTransform: "uppercase", letterSpacing: 1 }}>{labels.winRate}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 34 }}>
                  <Figure label={labels.matches} value={format.count(snapshot.matches)} />
                  <Figure label={labels.wins} value={format.count(snapshot.wins)} />
                  {snapshot.mvp !== null && snapshot.season === null && <Figure label={labels.mvp} value={format.count(snapshot.mvp)} />}
                </div>
                {!snapshot.full && <div style={{ display: "flex", fontSize: 17, fontWeight: 600, color: C.chalk500 }}>{labels.minimum}</div>}
              </div>
            </div>

            {/* Rank. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: 26,
                padding: "10px 22px 10px 12px",
                borderRadius: 14,
                border: `2px solid ${C.night700}`,
                background: "rgba(19,27,48,0.7)",
              }}
            >
              {emblem ? (
                <img src={emblem} alt="" width={84} height={84} style={{ width: 84, height: 84 }} />
              ) : (
                <div style={{ display: "flex", width: 84, height: 84 }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: rank.color }}>{rankName}</div>
                  {snapshot.rankLevel > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <img src={STAR} alt="" width={26} height={26} style={{ width: 26, height: 26 }} />
                      <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: C.gold400 }}>{String(rank.stars)}</div>
                    </div>
                  )}
                </div>
                {snapshot.rankMaxLevel > snapshot.rankLevel && (
                  <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: C.chalk500 }}>{`${labels.highest} · ${bestName}`}</div>
                )}
              </div>
            </div>
          </div>

          {/* Right: most played heroes. */}
          <div style={{ display: "flex", flexDirection: "column", width: 430 }}>
            <div style={{ display: "flex", fontSize: 21, fontWeight: 700, color: C.gold400, textTransform: "uppercase", letterSpacing: 2 }}>{labels.heroesTitle}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
              {snapshot.heroes.length ? (
                snapshot.heroes.map((hero, i) => <HeroStrip key={`${hero.name}-${i}`} hero={hero} art={arts[i] ?? null} labels={labels} format={format} />)
              ) : (
                <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: C.chalk500 }}>{labels.noHeroes}</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 19, fontWeight: 600 }}>
          <div style={{ display: "flex", color: C.gold500, letterSpacing: 1 }}>mlbbdex.com</div>
          <div style={{ display: "flex", color: C.chalk500 }}>{labels.updated(format.date(options.updatedAt))}</div>
        </div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: fontList },
  );
  return Buffer.from(await response.arrayBuffer());
}
