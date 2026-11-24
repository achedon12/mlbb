/* eslint-disable @next/next/no-img-element -- drawn by the image engine (satori), not a page: next/image has no place here. */
import type { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { artOf, toolArt } from "@/components/tool-art";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import type { T } from "@/i18n/t";
import { emblemImage, emblemName, itemImage, spellImage, spellName, talentImage } from "@/lib/build-catalog";
import { heroesBySlug } from "@/lib/data";
import { monthYear, patchCurrent, percentage } from "@/lib/freshness";
import { recapOf } from "@/lib/patch-recap-server";
import type { RecapEntry } from "@/lib/patch-recap";
import type { ShareRequest } from "@/lib/share-card";
import { rankingOfRank } from "@/lib/tier-list";
import { formatGap } from "@/lib/trends";
import type { Tier } from "@/lib/types";
import { FONT_TEXT, ogPicture } from "./assets";
import { tierListCard } from "./cards";
import { C, Crest, Eclat, Figure, Portrait, bevel, ogImage, portraitRow } from "./frame";
import { CellGrid, portraitImage } from "./share-frame";

/**
 * The share images of "Partager en image", one per kind, in both formats,
 * from a request `parseShareRequest` already checked. Same readers as the
 * pages; the artwork only through `artOf` (official artworks the site shows,
 * `illustrations`). Null when the data the image needs is gone.
 */

const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
const portraitOf = (slug: string) => heroesBySlug.get(slug)?.images.portrait ?? null;
const plural = (locale: Locale, n: number) => (new Intl.PluralRules(LOCALE_INTL[locale]).select(n) === "one" ? "one" : "other");

/** A bevelled night tile with an icon (item, emblem, talent, spell). */
async function iconTiles(paths: (string | null)[], size: number, gap = 14): Promise<ReactNode> {
  const inner = Math.round(size * 0.8);
  const pictures = await Promise.all(paths.map((p) => ogPicture(p, inner, inner, { fit: "contain" })));
  return (
    <div style={{ display: "flex", gap }}>
      {pictures.map((src, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: size,
            height: size,
            background: `linear-gradient(160deg, ${C.night700} 0%, ${C.night900} 100%)`,
            clipPath: bevel(size, size, Math.round(size * 0.2)),
          }}
        >
          {src && <img src={src} alt="" width={inner} height={inner} style={{ width: inner, height: inner }} />}
        </div>
      ))}
    </div>
  );
}

/** A small label in the condensed face, over a block of the body. */
function Label({ children, color = C.chalk400, size = 30 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <div style={{ display: "flex", fontFamily: FONT_TEXT, fontWeight: 700, fontSize: size, color, textTransform: "uppercase", letterSpacing: 1 }}>
      {children}
    </div>
  );
}

// ── Build ────────────────────────────────────────────────────────────

async function buildImage(r: ShareRequest & { card: { kind: "build" } }, t: T) {
  const { build } = r.card;
  const h = heroesBySlug.get(build.hero);
  if (!h) return null;
  const roles = h.roles.map((role) => t(`roles.${role}`)).join(" · ");
  const extras = [build.emblem ? emblemImage(build.emblem) : null, ...build.talents.map((k) => (k ? talentImage(k) : null)), build.spell ? spellImage(build.spell) : null];
  const facts = [
    t("shareCard.build.level", { n: build.level }),
    build.emblem ? emblemName(t, build.emblem) : null,
    build.spell ? spellName(t, build.spell) : null,
  ].filter(Boolean).join(" · ");
  const items = build.items.map(itemImage);
  const common = { locale: r.locale, kicker: t("shareCard.build.kicker", { roles }), title: t("shareCard.build.title", { hero: h.name }), art: artOf(h.slug) };

  if (r.format === "landscape") {
    return ogImage({ ...common, subtitle: facts, dex: "idee", dexHeight: 200, data: await iconTiles(items, 84, 12), titleLines: 2, titleMax: 112 });
  }
  const [itemRow, extraRow] = await Promise.all([iconTiles(items, 136), iconTiles(extras.filter((x) => x !== null), 104)]);
  return portraitImage({
    ...common,
    subtitle: facts,
    artHeight: 600,
    dex: "idee",
    quote: t("shareCard.build.dex"),
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {itemRow}
        <Eclat width={420} height={6} />
        {extraRow}
      </div>
    ),
  });
}

// ── Draft ────────────────────────────────────────────────────────────

async function draftImage(r: ShareRequest & { card: { kind: "draft" } }, t: T) {
  const { blue, red, win, rank } = r.card;
  const rankName = t(`measuredRanks.${rank}`);
  const quote =
    win === null ? t("shareCard.draft.dexNone") : win >= 53 ? t("shareCard.draft.dexBlue") : win <= 47 ? t("shareCard.draft.dexRed") : t("shareCard.draft.dexEven");
  const team = (slugs: string[]) => slugs.map((s) => ({ portrait: portraitOf(s), name: heroName(s) }));
  const estimate =
    win === null ? null : (
      <div style={{ display: "flex", gap: 30, alignItems: "flex-end" }}>
        <Figure value={`${win} %`} color={C.azure} size={84} />
        <Figure value={`${100 - win} %`} label={t("shareCard.draft.estimate")} color={C.blood} size={84} />
      </div>
    );
  const common = { locale: r.locale, kicker: t("shareCard.draft.kicker", { rank: rankName }), title: t("shareCard.draft.title") };

  if (r.format === "landscape") {
    const [rowBlue, rowRed] = await Promise.all([portraitRow(team(blue), { width: 92, height: 128 }), portraitRow(team(red), { width: 92, height: 128 })]);
    return ogImage({
      ...common,
      titleWidth: 420,
      aside: (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Label color={C.azure} size={24}>{t("shareCard.draft.blue")}</Label>
          {rowBlue}
          <Label color={C.blood} size={24}>{t("shareCard.draft.red")}</Label>
          {rowRed}
        </div>
      ),
      dex: null,
      data: estimate ?? undefined,
    });
  }
  const size = { width: 172, height: 190 };
  // A side's name, and its estimated chance in its colour.
  const head = (label: string, color: string, value: number | null) => (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: 950 }}>
      <Label color={color}>{label}</Label>
      {value !== null && <Figure value={`${value} %`} color={color} size={72} />}
    </div>
  );
  const [rowBlue, rowRed] = await Promise.all([portraitRow(team(blue), size), portraitRow(team(red), size)]);
  return portraitImage({
    ...common,
    art: artOf(blue[0]!),
    artHeight: 420,
    dex: "idee",
    quote,
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {head(t("shareCard.draft.blue"), C.azure, win)}
        {rowBlue}
        <div style={{ display: "flex", height: 18 }} />
        {head(t("shareCard.draft.red"), C.blood, win === null ? null : 100 - win)}
        {rowRed}
        {win !== null && <Label size={24}>{t("shareCard.draft.estimate")}</Label>}
      </div>
    ),
  });
}

// ── Tier list ────────────────────────────────────────────────────────

async function tierListImage(r: ShareRequest & { card: { kind: "tier-list" } }, t: T) {
  const { rank } = r.card;
  if (r.format === "landscape") return tierListCard(r.locale, rank);
  const ranking = rankingOfRank(rank);
  if (ranking.length === 0) return null;
  const rows = await Promise.all(
    (["S+", "S"] as Tier[]).map(async (tier) => {
      const list = ranking.filter((e) => e.tier === tier).slice(0, 5);
      if (list.length === 0) return null;
      const row = await portraitRow(
        list.map((e) => ({ portrait: e.hero.images.portrait, name: e.hero.name, figure: percentage(r.locale, e.winRate) })),
        { width: 150, height: 200 },
      );
      return (
        <div key={tier} style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Crest tier={tier} size={72} />
          {row}
        </div>
      );
    }),
  );
  return portraitImage({
    locale: r.locale,
    kicker: t("shareCard.tierList.kicker", { v: patchCurrent?.version ?? "", month: monthYear(r.locale) }),
    title: rank === "all" ? t("nav.tierList.label") : `${t("nav.tierList.label")} ${t(`measuredRanks.${rank}`)}`,
    art: artOf(ranking[0]!.hero.slug),
    artHeight: 520,
    dex: "victoire",
    quote: t("shareCard.tierList.dex"),
    body: <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>{rows.filter(Boolean)}</div>,
  });
}

// ── MLBBdle ──────────────────────────────────────────────────────────

async function mlbbdleImage(r: ShareRequest & { card: { kind: "mlbbdle" } }, t: T) {
  const { mode, number, guesses, rows, streak } = r.card;
  // The answer is never drawn: the tool's own artwork, not the day's hero.
  const { art } = toolArt("/mlbbdle");
  const found = t(`shareCard.mlbbdle.found.${plural(r.locale, guesses)}`, { n: guesses });
  const quote = guesses === 1 ? t("shareCard.mlbbdle.dexPerfect") : guesses <= 5 ? t("shareCard.mlbbdle.dexGood") : t("shareCard.mlbbdle.dexLong");
  const hidden = guesses - rows.length;
  // Skill mode: a red square per miss and the green one.
  const skillRow = Array.from({ length: Math.min(guesses, 12) }, (_, i) => (i === Math.min(guesses, 12) - 1 ? "m" : "x") as "m" | "x");
  const common = {
    locale: r.locale,
    kicker: t("shareCard.mlbbdle.kicker", { mode: t(`pages.mlbbdleUI.modes.${mode}`) }),
    title: t("shareCard.mlbbdle.title", { n: number }),
    subtitle: found,
  };
  const figures = (size: number) => (
    <div style={{ display: "flex", gap: 34, alignItems: "flex-end" }}>
      <Figure value={String(guesses)} label={t(`shareCard.mlbbdle.guesses.${plural(r.locale, guesses)}`)} size={size} />
      {streak >= 2 ? <Figure value={String(streak)} label={t("shareCard.mlbbdle.streak")} color={C.azure} size={size} /> : null}
    </div>
  );
  const grid = (cell: number, gap: number) =>
    mode === "classic" ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <CellGrid rows={rows} cell={cell} gap={gap} />
        {hidden > 0 && <Label size={Math.round(cell * 0.5)}>{t("shareCard.mlbbdle.more", { n: hidden })}</Label>}
      </div>
    ) : (
      <CellGrid rows={[skillRow]} cell={cell} gap={gap} />
    );

  if (r.format === "landscape") {
    return ogImage({ ...common, titleWidth: 480, aside: grid(mode === "classic" ? 38 : 30, 6), dex: "victoire", dexHeight: 160, data: figures(80) });
  }
  return portraitImage({
    ...common,
    art,
    artHeight: 400,
    dex: guesses <= 5 ? "victoire" : "surpris",
    quote,
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {figures(110)}
        {grid(mode === "classic" ? 60 : 58, 8)}
      </div>
    ),
  });
}

// ── Patch recap ──────────────────────────────────────────────────────

/** Share image of a patch recap: the winners in blue, the losers in red, their measured gaps. */
export async function recapImage(locale: Locale, version: string, format: ShareRequest["format"]): Promise<ImageResponse | null> {
  const found = recapOf(version);
  if (!found) return null;
  const { recap } = found;
  const t = createT(locale);
  const intl = LOCALE_INTL[locale];
  const people = (list: RecapEntry[]) =>
    list.map((e) => ({ portrait: portraitOf(e.slug), name: heroName(e.slug), figure: formatGap(e.gap, intl), figureColor: e.gap > 0 ? C.azure : C.blood }));
  const lead = recap.winners[0] ?? recap.losers[0];
  const note =
    recap.sample === "none"
      ? t("shareCard.recap.none")
      : recap.sample === "small"
        ? t("shareCard.recap.small", { n: recap.measured })
        : null;
  const common = {
    locale,
    kicker: t("pages.patchRecap.kicker"),
    title: t("og.patch", { v: found.patch.version }),
    art: lead ? artOf(lead.slug) : null,
  };

  if (format === "landscape") {
    const shown = [...recap.winners.slice(0, 2), ...recap.losers.slice(0, 2)];
    const aside = shown.length ? await portraitRow(people(shown), { width: 118, height: 300 }) : undefined;
    return ogImage({
      ...common,
      art: aside ? null : common.art,
      aside,
      titleWidth: aside ? 470 : undefined,
      subtitle: note,
      dex: aside ? null : "reflexion",
      data:
        recap.measured > 0 ? <Figure value={String(recap.measured)} label={t("shareCard.recap.measured")} size={80} /> : undefined,
    });
  }

  const row = async (list: RecapEntry[], label: string, color: string) => {
    if (!list.length) return null;
    const portraits = await Promise.all(
      people(list).map(async (p) => ({ ...p, src: await ogPicture(p.portrait, 190, 230, { position: "top" }) })),
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Label color={color}>{label}</Label>
        <div style={{ display: "flex", gap: 14 }}>
          {portraits.map((p) => (
            <Portrait key={p.name} src={p.src} name={p.name} figure={p.figure} figureColor={color} figureSize={48} width={190} height={230} />
          ))}
        </div>
      </div>
    );
  };
  const [winners, losers] = await Promise.all([
    row(recap.winners, t("shareCard.recap.winners"), C.azure),
    row(recap.losers, t("shareCard.recap.losers"), C.blood),
  ]);
  return portraitImage({
    ...common,
    artHeight: 460,
    dex: recap.sample === "ok" ? "reflexion" : "surpris",
    quote: note ?? t("shareCard.recap.dex"),
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {winners}
        {losers}
      </div>
    ),
  });
}

/** The image of a checked request, or null when its data is gone. */
export function shareImage(r: ShareRequest): Promise<ImageResponse | null> {
  const t = createT(r.locale);
  switch (r.card.kind) {
    case "build":
      return buildImage(r as ShareRequest & { card: { kind: "build" } }, t);
    case "draft":
      return draftImage(r as ShareRequest & { card: { kind: "draft" } }, t);
    case "tier-list":
      return tierListImage(r as ShareRequest & { card: { kind: "tier-list" } }, t);
    case "mlbbdle":
      return mlbbdleImage(r as ShareRequest & { card: { kind: "mlbbdle" } }, t);
    case "recap":
      return recapImage(r.locale, r.card.version, r.format);
  }
}
