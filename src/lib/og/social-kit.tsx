import type { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { artOf } from "@/components/tool-art";
import { createT } from "@/i18n/translations";
import type { T } from "@/i18n/t";
import { heroesBySlug, patchDetails } from "@/lib/data";
import { countAdjustments, longDate, monthYear, patchCurrent, percentage } from "@/lib/freshness";
import { RARITIES } from "@/lib/rarities";
import { KIT_SIZES, STORY_SAFE, type AnnounceTitle, type KitFormat, type KitRequest } from "@/lib/social-kit";
import { kitCatalog, kitSkinById } from "@/lib/social-kit-catalog";
import { rankingOfRank, rateBySlug } from "@/lib/tier-list";
import type { Tier } from "@/lib/types";
import { FONT_DISPLAY, FONT_TEXT, ogPicture } from "./assets";
import { C, Crest, Eclat, Figure, Portrait, SLANT, bevel } from "./frame";
import { shorten } from "./layout";
import { portraitImage, type PortraitProps } from "./share-frame";

/**
 * The social kit's visuals, one per template, in its three formats (square,
 * portrait, story), from a request `parseKitRequest` already checked. All
 * drawn in the share images' portrait frame (`share-frame.tsx`), sized per
 * format; the story keeps its words out of the bands the apps cover
 * (`STORY_SAFE`). Artwork only through `artOf` and the kit's skins (official
 * artworks the site shows). Null when the data a visual needs is gone.
 */

/** Per format: the artwork band (taller for a hero or a skin, whose artwork is the subject), Dex's height, the title's largest size. */
const LAYOUT: Record<KitFormat, { art: number; artLarge: number; dex: number; titleMax: number; safeTop: number; safeBottom: number }> = {
  square: { art: 470, artLarge: 560, dex: 180, titleMax: 116, safeTop: 0, safeBottom: 0 },
  portrait: { art: 600, artLarge: 760, dex: 220, titleMax: 132, safeTop: 0, safeBottom: 0 },
  story: { art: STORY_SAFE.top + 580, artLarge: STORY_SAFE.top + 780, dex: 230, titleMax: 140, safeTop: STORY_SAFE.top, safeBottom: STORY_SAFE.bottom },
};

type Frame = Omit<PortraitProps, "size" | "safeTop" | "safeBottom" | "dexHeight" | "titleMax" | "artHeight"> & { large?: boolean };

function draw(format: KitFormat, { large, ...p }: Frame): Promise<ImageResponse> {
  const l = LAYOUT[format];
  return portraitImage({
    ...p,
    size: KIT_SIZES[format],
    safeTop: l.safeTop,
    safeBottom: l.safeBottom,
    dexHeight: l.dex,
    titleMax: l.titleMax,
    artHeight: large ? l.artLarge : l.art,
  });
}

/** A small label in the condensed face. */
function Label({ children, color = C.chalk400, size = 30 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <div style={{ display: "flex", fontFamily: FONT_TEXT, fontWeight: 700, fontSize: size, color, textTransform: "uppercase", letterSpacing: 1 }}>
      {children}
    </div>
  );
}

/** A bevelled night tag: a role, a lane, a rarity. */
function Tag({ children, color = C.chalk, size = 30 }: { children: ReactNode; color?: string; size?: number }) {
  const height = Math.round(size * 1.8);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height,
        padding: `0 ${Math.round(size * 0.7)}px`,
        background: C.night800,
        clipPath: "polygon(0% 0%, 94% 0%, 100% 30%, 100% 100%, 6% 100%, 0% 70%)",
        fontFamily: FONT_TEXT,
        fontWeight: 700,
        fontSize: size,
        color,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {children}
    </div>
  );
}

const portraitOf = (slug: string) => heroesBySlug.get(slug)?.images.portrait ?? null;

/** A row of bevelled portraits, each with a figure. */
async function heroRow(heroes: { slug: string; figure?: string; color?: string; tier?: Tier }[], width: number, height: number) {
  const pictures = await Promise.all(heroes.map((h) => ogPicture(portraitOf(h.slug), width, height, { position: "top" })));
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
      {heroes.map((h, i) => (
        <div key={h.slug} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {h.tier && <Crest tier={h.tier} size={Math.round(width * 0.3)} />}
          <Portrait
            src={pictures[i]}
            name={heroesBySlug.get(h.slug)?.name ?? h.slug}
            figure={h.figure}
            figureColor={h.color}
            figureSize={Math.round(width * 0.24)}
            width={width}
            height={height}
          />
        </div>
      ))}
    </div>
  );
}

// ── New patch ────────────────────────────────────────────────────────

async function patchVisual(r: KitRequest & { card: { template: "patch" } }, t: T) {
  const patch = Object.hasOwn(patchDetails, r.card.version) ? patchDetails[r.card.version] : undefined;
  if (!patch) return null;
  const { buffs, nerfs, others } = countAdjustments(patch.adjustments);
  const known = patch.adjustments.filter((a) => heroesBySlug.has(a.slug));
  const buffed = known.filter((a) => a.type === "buff").slice(0, 5);
  const figureSize = r.format === "square" ? 96 : 118;
  const figures = patch.adjustments.length ? (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
      <Figure value={String(buffs)} label={t("patchHeroes.plural.buff")} color={C.azure} size={figureSize} />
      <Figure value={String(nerfs)} label={t("patchHeroes.plural.nerf")} color={C.blood} size={figureSize} />
      {others > 0 ? <Figure value={String(others)} label={t("patchHeroes.plural.adjust")} size={figureSize} /> : null}
    </div>
  ) : (
    <Label size={34}>{t("socialKit.patch.soon")}</Label>
  );
  const row = r.format !== "square" && buffed.length ? await heroRow(buffed.map((a) => ({ slug: a.slug })), 176, 196) : null;
  return draw(r.format, {
    locale: r.locale,
    kicker: patch.date ? t("socialKit.patch.kickerDate", { date: longDate(r.locale, patch.date) }) : t("socialKit.patch.kicker"),
    title: t("og.patch", { v: patch.version }),
    art: artOf(known[0]?.slug ?? "") ?? null,
    dex: "saut",
    quote: t("socialKit.patch.dex"),
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {figures}
        {row && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Label color={C.azure}>{t("socialKit.patch.buffed")}</Label>
            {row}
          </div>
        )}
      </div>
    ),
  });
}

// ── Tier list of the patch ───────────────────────────────────────────

async function tierListVisual(r: KitRequest & { card: { template: "tier-list" } }, t: T) {
  const top = rankingOfRank(r.card.rank)
    .filter((e) => e.tier === "S+" || e.tier === "S")
    .slice(0, 5);
  if (top.length === 0) return null;
  const height = r.format === "square" ? 206 : 236;
  const row = await heroRow(
    top.map((e) => ({ slug: e.hero.slug, tier: e.tier, figure: percentage(r.locale, e.winRate) })),
    176,
    height,
  );
  return draw(r.format, {
    locale: r.locale,
    kicker: [t("socialKit.tierList.kicker", { v: patchCurrent?.version ?? "" }), r.card.rank === "all" ? null : t(`measuredRanks.${r.card.rank}`)]
      .filter(Boolean)
      .join(" · "),
    title: t("socialKit.tierList.title"),
    subtitle: t("socialKit.tierList.measured", { month: monthYear(r.locale) }),
    art: artOf(top[0]!.hero.slug),
    dex: "bravo",
    quote: t("socialKit.tierList.dex"),
    body: row,
  });
}

// ── New hero, hero of the moment ─────────────────────────────────────

async function heroVisual(r: KitRequest & { card: { template: "hero" } }, t: T) {
  const h = heroesBySlug.get(r.card.hero);
  const art = h ? artOf(h.slug) : null;
  if (!h || !art || !kitCatalog.heroes.has(h.slug)) return null;
  const rate = rateBySlug.get(h.slug);
  const isNew = r.card.mode === "new";
  const tag = r.format === "square" ? 26 : 30;
  return draw(r.format, {
    locale: r.locale,
    kicker: t(`socialKit.hero.${r.card.mode}`),
    title: h.name,
    subtitle: h.title,
    art,
    large: true,
    dex: isNew ? "surpris" : "idee",
    quote: isNew ? t("socialKit.hero.dexNew", { hero: h.name }) : t("socialKit.hero.dexSpotlight", { hero: h.name }),
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {h.roles.map((role) => (
            <Tag key={role} color={C.gold400} size={tag}>
              {t(`roles.${role}`)}
            </Tag>
          ))}
          {h.lanes.map((lane) => (
            <Tag key={lane} size={tag}>
              {t(`lanes.${lane}`)}
            </Tag>
          ))}
        </div>
        {rate && !isNew && (
          <div style={{ display: "flex", gap: 30, alignItems: "flex-end" }}>
            <Crest tier={rate.tier} size={r.format === "square" ? 60 : 72} />
            <Figure value={percentage(r.locale, rate.win)} label={t("pages.heroDetail.stat.winRate")} size={r.format === "square" ? 76 : 92} />
          </div>
        )}
      </div>
    ),
  });
}

// ── New skin ─────────────────────────────────────────────────────────

async function skinVisual(r: KitRequest & { card: { template: "skin" } }, t: T) {
  const entry = kitSkinById.get(r.card.skin);
  if (!entry) return null;
  const { hero, skin } = entry;
  const rarity = skin.rarity && Object.hasOwn(RARITIES, skin.rarity) ? t(`skinRarity.${RARITIES[skin.rarity]!.key}`) : null;
  const released = t("socialKit.skin.released", { date: monthYear(r.locale, `${skin.release.slice(0, 7)}-01`) });
  const size = r.format === "square" ? 120 : 150;
  const portrait = await ogPicture(hero.images.portrait, size, Math.round(size * 1.2), { position: "top" });
  return draw(r.format, {
    locale: r.locale,
    kicker: t("socialKit.skin.kicker", { hero: hero.name }),
    title: skin.name,
    art: skin.illustration,
    large: true,
    dex: "joie",
    quote: t("socialKit.skin.dex", { hero: hero.name }),
    body: (
      <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
        <Portrait src={portrait} name={hero.name} width={size} height={Math.round(size * 1.2)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rarity && (
            <Tag color={C.gold400} size={r.format === "square" ? 26 : 30}>
              {rarity}
            </Tag>
          )}
          <Label size={r.format === "square" ? 28 : 32}>{released}</Label>
        </div>
      </div>
    ),
  });
}

// ── Announcement ─────────────────────────────────────────────────────

/** Each announcement's artwork: a hero fixed per title, so a kind of post is recognised from one to the next. */
const ANNOUNCE_ART: Record<AnnounceTitle, string> = {
  discord: "gusion",
  event: "miya",
  tournament: "chou",
  live: "harley",
  update: "alucard",
};

async function announceVisual(r: KitRequest & { card: { template: "announce" } }, t: T) {
  const key = r.card.title;
  const width = KIT_SIZES[r.format].width - 128;
  const height = r.format === "square" ? 190 : 240;
  return draw(r.format, {
    locale: r.locale,
    kicker: t("socialKit.announce.kicker"),
    title: t(`socialKit.announce.${key}.title`),
    art: artOf(ANNOUNCE_ART[key]),
    dex: "pointe",
    quote: t(`socialKit.announce.${key}.dex`),
    body: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          width,
          height,
          padding: "0 44px",
          background: `linear-gradient(160deg, ${C.night800} 0%, ${C.night900} 100%)`,
          clipPath: bevel(width, height, 28),
          boxShadow: `inset 0 4px 0 ${C.gold400}`,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: r.format === "square" ? 46 : 54,
            lineHeight: 1.05,
            color: C.chalk,
            textTransform: "uppercase",
            transform: SLANT,
          }}
        >
          {shorten(t(`socialKit.announce.${key}.lead`), 64)}
        </div>
        <Eclat width={300} height={6} />
      </div>
    ),
  });
}

/** The visual of a checked request, or null when its data is gone. */
export function kitImage(r: KitRequest): Promise<ImageResponse | null> {
  const t = createT(r.locale);
  switch (r.card.template) {
    case "patch":
      return patchVisual(r as KitRequest & { card: { template: "patch" } }, t);
    case "tier-list":
      return tierListVisual(r as KitRequest & { card: { template: "tier-list" } }, t);
    case "hero":
      return heroVisual(r as KitRequest & { card: { template: "hero" } }, t);
    case "skin":
      return skinVisual(r as KitRequest & { card: { template: "skin" } }, t);
    case "announce":
      return announceVisual(r as KitRequest & { card: { template: "announce" } }, t);
  }
}
