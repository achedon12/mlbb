/* eslint-disable @next/next/no-img-element -- drawn by the image engine (satori), not a page: next/image has no place here. */
import { artOf, toolArt } from "@/components/tool-art";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import type { T } from "@/i18n/t";
import { article, articles } from "@/lib/content";
import { allHeroes, heroesBySlug, illustrations, itemsFor, patchDetails } from "@/lib/data";
import { emblemsSheets, spellSheets, textChoice, usage } from "@/lib/usage-sheets";
import { proMeta, tournamentBySlug } from "@/lib/esports";
import { countAdjustments, longDate, monthYear, patchCurrent, percentage } from "@/lib/freshness";
import { guide, readingMinutes } from "@/lib/guides";
import { lastSkins, gallerySkinCount } from "@/lib/hero-skins";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { leaderOf, rankingOfRank, rateBySlug } from "@/lib/tier-list";
import { filterRanking, type FilterTier } from "@/lib/tier-list-filters";
import { groupByDate, readRelease } from "@/lib/skin-catalog";
import { calendarYears, releasedSkins } from "@/lib/skin-catalog-server";
import visuals from "@/data/game/visuals.json";
import { C, Crest, Eclat, Figure, bevel, ogImage, portraitRow, type OgFrameProps } from "./frame";
import { ogPicture } from "./assets";
import { nameInText, ogPose } from "./layout";

/**
 * The share image of each kind of page, in the page's language and with its
 * real data: the same readers as the pages (`src/lib/*`), never a copy.
 * Each function returns the image, or null when the page does not exist
 * (the route then answers 404 rather than caching a blank card).
 */

const ITEM_IMAGES = visuals.items as Record<string, string>;
const heroName = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
const portraitOf = (slug: string) => heroesBySlug.get(slug)?.images.portrait ?? null;
const patchLine = (t: T) => t("og.patch", { v: patchCurrent?.version ?? "" });

/** The pictures a page's figures stand on: a hero's first artwork, or the tool's. */
const heroArt = (slug: string | undefined | null) => (slug ? artOf(slug) : null);

/** Heroes by name, for `nameInText`. */
const HEROES_BY_NAME = new Map(allHeroes.map((h) => [h.name, h]));
const NAMES = [...HEROES_BY_NAME.keys()];

/** An icon (item, emblem, spell) on a bevelled night tile, the éclat under it. */
async function IconTile({ path, size = 132 }: { path: string | null; size?: number }) {
  const inner = Math.round(size * 0.8);
  const src = await ogPicture(path, inner, inner, { fit: "contain" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
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
      <Eclat width={size} height={5} />
    </div>
  );
}

/** A row of icons (the most used items, the emblems). */
async function iconRow(paths: (string | null)[], size = 112) {
  const tiles = await Promise.all(paths.map((path) => IconTile({ path, size })));
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {tiles.map((tile, i) => (
        <div key={i} style={{ display: "flex" }}>
          {tile}
        </div>
      ))}
    </div>
  );
}

/** Several figures side by side. */
function Figures({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 36, alignItems: "flex-end" }}>{children}</div>;
}

const card = (p: OgFrameProps) => ogImage(p);

// ── Home and default ─────────────────────────────────────────────────

/** The site's own card: Dex greets, the baseline in the page's language. */
export function homeCard(locale: Locale) {
  const t = createT(locale);
  return card({
    locale,
    title: t("common.subtitle"),
    titleLines: 3,
    titleMax: 104,
    subtitle: t("og.homeLine"),
    art: toolArt("/tools").art,
    dex: ogPose("home"),
    dexHeight: 340,
  });
}

// ── Heroes ───────────────────────────────────────────────────────────

/** A hero page: artwork, roles, tier and win rate. */
export function heroCard(locale: Locale, slug: string) {
  const h = heroesBySlug.get(slug);
  if (!h) return null;
  const t = createT(locale);
  const rate = rateBySlug.get(slug);
  return card({
    locale,
    kicker: h.roles.map((r) => t(`roles.${r}`)).join(" · "),
    title: h.name,
    titleMax: 140,
    subtitle: h.title,
    art: heroArt(slug) ?? h.images.portrait,
    dex: ogPose("hero"),
    dexHeight: 220,
    data: rate ? (
      <Figures>
        <Crest tier={rate.tier} />
        <Figure value={percentage(locale, rate.win)} label={t("pages.heroDetail.stat.winRate")} />
      </Figures>
    ) : undefined,
    footer: t("pages.heroDetail.ogTagline"),
  });
}

// ── Tier list and statistics ─────────────────────────────────────────

const rankLabel = (t: T, rank: MeasuredRank) => t(`measuredRanks.${rank}`);

/** Title of a tier list card: "Tier list Mythic", "Tier list gold lane", "Tier list tanks". */
function tierListTitle(t: T, rank: MeasuredRank, filter: FilterTier | null): string {
  const label = t("nav.tierList.label");
  if (filter) {
    return `${label} ${t(filter.type === "lane" ? `pages.tierList.laneSeo.${filter.value}` : `pages.tierList.rolePlural.${filter.value}`)}`;
  }
  return rank === "all" ? label : `${label} ${rankLabel(t, rank)}`;
}

/**
 * The tier list of a rank, or of a lane or role (all ranks combined): the
 * S+ heroes in portraits, with their win rate.
 */
export async function tierListCard(locale: Locale, rank: MeasuredRank, filter: FilterTier | null = null) {
  const t = createT(locale);
  const ranking = filterRanking(rankingOfRank(rank), filter);
  const top = ranking.filter((e) => e.tier === "S+");
  const shown = (top.length >= 3 ? top : ranking).slice(0, 4);
  const aside = await portraitRow(
    shown.map((e) => ({ portrait: e.hero.images.portrait, name: e.hero.name, figure: percentage(locale, e.winRate) })),
    { width: 128, height: 330 },
  );
  return card({
    locale,
    kicker: `${patchLine(t)} · ${monthYear(locale)}`,
    title: tierListTitle(t, rank, filter),
    titleWidth: 470,
    titleLines: 3,
    titleMax: 112,
    aside,
    dex: ogPose("ranking"),
    dexHeight: 170,
    dexPlace: "cut",
    data: top.length ? (
      <Figures>
        <Crest tier="S+" size={64} />
        <Figure value={String(top.length)} label={t("og.splusHeroes")} size={80} />
      </Figures>
    ) : undefined,
  });
}

/** Statistics of a rank: the best win rate among the heroes played enough, in a big figure. */
export function statisticsCard(locale: Locale, rank: MeasuredRank) {
  const t = createT(locale);
  const ranking = rankingOfRank(rank).filter((e) => !e.lowSample);
  const best = [...ranking].sort((a, b) => b.winRate - a.winRate)[0];
  return card({
    locale,
    kicker: `${rankLabel(t, rank)} · ${patchLine(t)}`,
    title: t("nav.statistics.label"),
    subtitle: t("nav.statistics.desc"),
    art: heroArt(best?.hero.slug),
    dex: ogPose("statistics"),
    dexHeight: 220,
    data: best ? (
      <Figure value={percentage(locale, best.winRate)} label={t("og.bestWin", { hero: best.hero.name })} />
    ) : undefined,
  });
}

// ── Items, emblems, spells ───────────────────────────────────────────

/** Number of heroes whose most played builds hold a choice. */
const usageCount = (type: "item" | "emblem" | "spell", key: string) => usage(type, key).length;

export async function itemsCard(locale: Locale) {
  const t = createT(locale);
  const items = itemsFor(locale).filter((o) => !o.removed);
  const most = [...items].sort((a, b) => usageCount("item", b.slug) - usageCount("item", a.slug)).slice(0, 4);
  return card({
    locale,
    kicker: patchLine(t),
    title: t("nav.items.label"),
    subtitle: t("nav.items.desc"),
    art: heroArt(usage("item", most[0]?.slug ?? "")[0]?.slug),
    dex: ogPose("sheet"),
    dexHeight: 230,
    data: (
      <Figures>
        <Figure value={String(items.length)} label={t("og.itemsInGame")} size={84} />
        {await iconRow(most.map((o) => ITEM_IMAGES[o.slug] ?? null), 96)}
      </Figures>
    ),
  });
}

export async function itemCard(locale: Locale, slug: string) {
  const o = itemsFor(locale).find((x) => x.slug === slug);
  if (!o) return null;
  const t = createT(locale);
  const heroes = usage("item", slug).slice(0, 3);
  const price = o.price === null ? null : `${o.price.toLocaleString(LOCALE_INTL[locale])} ${t("pages.itemsList.gold")}`;
  return card({
    locale,
    kicker: [t(`categories.${o.category}`), price].filter(Boolean).join(" · "),
    title: o.name,
    subtitle: heroes.length ? t("og.builtBy", { heroes: heroes.map((h) => heroName(h.slug)).join(", ") }) : o.summary,
    art: heroArt(heroes[0]?.slug),
    dex: ogPose("sheet"),
    dexHeight: 220,
    data: (
      <Figures>
        {await IconTile({ path: ITEM_IMAGES[slug] ?? null, size: 132 })}
        {heroes[0]?.win != null ? <Figure value={percentage(locale, heroes[0].win)} label={heroName(heroes[0].slug)} size={72} /> : null}
      </Figures>
    ),
  });
}

const emblemName = (t: T, e: (typeof emblemsSheets)[number]) => textChoice(t, e.emblem.key, "name", e.emblem.name)!;

export async function emblemsCard(locale: Locale) {
  const t = createT(locale);
  return card({
    locale,
    kicker: patchLine(t),
    title: t("nav.emblems.label"),
    subtitle: t("nav.emblems.desc"),
    art: heroArt(usage("emblem", emblemsSheets[0]?.slug ?? "")[0]?.slug),
    dex: ogPose("sheet"),
    dexHeight: 230,
    data: await iconRow(emblemsSheets.slice(0, 5).map((e) => e.image), 96),
  });
}

export async function emblemCard(locale: Locale, slug: string) {
  const e = emblemsSheets.find((x) => x.slug === slug);
  if (!e) return null;
  const t = createT(locale);
  const heroes = usage("emblem", slug).slice(0, 3);
  return card({
    locale,
    kicker: `${t("nav.emblems.label")} · ${patchLine(t)}`,
    title: emblemName(t, e),
    subtitle: heroes.length
      ? t("og.builtBy", { heroes: heroes.map((h) => heroName(h.slug)).join(", ") })
      : textChoice(t, e.emblem.key, "bestFor", e.emblem.bestFor),
    art: heroArt(heroes[0]?.slug),
    dex: ogPose("sheet"),
    dexHeight: 220,
    data: (
      <Figures>
        {await IconTile({ path: e.image, size: 132 })}
        {heroes.length ? <Figure value={String(usageCount("emblem", slug))} label={t("og.heroesUsing")} size={72} /> : null}
      </Figures>
    ),
  });
}

export async function spellsCard(locale: Locale) {
  const t = createT(locale);
  const most = [...spellSheets].sort((a, b) => usageCount("spell", b.slug) - usageCount("spell", a.slug));
  return card({
    locale,
    kicker: patchLine(t),
    title: t("nav.spells.label"),
    subtitle: t("nav.spells.desc"),
    art: heroArt(usage("spell", most[0]?.slug ?? "")[0]?.slug),
    dex: ogPose("sheet"),
    dexHeight: 230,
    data: await iconRow(most.slice(0, 5).map((s) => s.image), 96),
  });
}

export async function spellCard(locale: Locale, slug: string) {
  const s = spellSheets.find((x) => x.slug === slug);
  if (!s) return null;
  const t = createT(locale);
  const heroes = usage("spell", slug).slice(0, 3);
  return card({
    locale,
    kicker: `${t("nav.spells.label")} · ${patchLine(t)}`,
    title: textChoice(t, slug, "name", s.name)!,
    subtitle: heroes.length
      ? t("og.builtBy", { heroes: heroes.map((h) => heroName(h.slug)).join(", ") })
      : textChoice(t, slug, "description"),
    art: heroArt(heroes[0]?.slug),
    dex: ogPose("sheet"),
    dexHeight: 220,
    data: (
      <Figures>
        {await IconTile({ path: s.image, size: 132 })}
        {heroes.length ? <Figure value={String(usageCount("spell", slug))} label={t("og.heroesUsing")} size={72} /> : null}
      </Figures>
    ),
  });
}

// ── Guides, news, patch notes ────────────────────────────────────────

export function guidesCard(locale: Locale) {
  const t = createT(locale);
  return card({
    locale,
    kicker: t("nav.guides.label"),
    title: t("pages.guides.metaTitle"),
    titleLines: 3,
    subtitle: t("nav.guides.desc"),
    art: toolArt("/tools/strategy-planner").art,
    dex: ogPose("guide"),
  });
}

export function guideCard(locale: Locale, slug: string) {
  const g = guide(slug, locale);
  if (!g) return null;
  const t = createT(locale);
  // A lane's guide stands on the artwork of that lane's strongest hero right now.
  const lead = g.lane ? leaderOf(filterRanking(rankingOfRank("all"), { type: "lane", value: g.lane }))?.hero.slug : null;
  return card({
    locale,
    kicker: `${t("nav.guides.label")} · ${t("og.minutes", { n: readingMinutes(g.content) })}`,
    title: g.title,
    titleLines: 3,
    subtitle: g.summary,
    art: heroArt(lead) ?? toolArt("/tools/strategy-planner").art,
    dex: ogPose("guide"),
    dexHeight: 240,
  });
}

/** A post's artwork: the hero its title names, or the latest skin's. */
function postArt(title: string): string | null {
  const named = nameInText(title, NAMES);
  if (named) return heroArt(HEROES_BY_NAME.get(named)?.slug);
  const last = lastSkins(1)[0];
  return last ? (illustrations[last.hero.slug]?.[last.skin.name] ?? heroArt(last.hero.slug)) : null;
}

export function newsCard(locale: Locale) {
  const t = createT(locale);
  const latest = articles("news", locale)[0];
  return card({
    locale,
    kicker: t("nav.news.label"),
    title: latest ? latest.title : t("nav.news.label"),
    titleLines: 3,
    titleMax: 96,
    subtitle: latest ? longDate(locale, latest.date) : t("nav.news.desc"),
    art: latest ? postArt(latest.title) : null,
    dex: ogPose("article"),
    dexHeight: 240,
  });
}

export function articleCard(locale: Locale, section: "news" | "patch-notes", slug: string) {
  const a = article(section, slug, locale);
  if (!a) return null;
  const t = createT(locale);
  return card({
    locale,
    kicker: `${t(section === "news" ? "nav.news.label" : "nav.patchNotes.label")} · ${longDate(locale, a.date)}`,
    title: a.title,
    titleLines: 3,
    titleMax: 96,
    subtitle: a.summary,
    art: postArt(a.title),
    dex: ogPose("article"),
    dexHeight: 240,
  });
}

/** A patch: its version in giant, buffs in blue and nerfs in red, on the first adjusted hero's artwork. */
export function patchCard(locale: Locale, slug: string | null) {
  const patch = slug === null ? patchCurrent : Object.hasOwn(patchDetails, slug) ? patchDetails[slug] : undefined;
  if (!patch) return null;
  const t = createT(locale);
  const { buffs, nerfs, others } = countAdjustments(patch.adjustments);
  const first = patch.adjustments.find((a) => heroesBySlug.has(a.slug))?.slug;
  return card({
    locale,
    kicker: [t("nav.patchNotes.label"), patch.date ? longDate(locale, patch.date) : null].filter(Boolean).join(" · "),
    title: t("og.patch", { v: patch.version }),
    titleMax: 128,
    art: heroArt(first),
    dex: ogPose("patch"),
    dexHeight: 220,
    data: patch.adjustments.length ? (
      <Figures>
        <Figure value={String(buffs)} label={t("patchHeroes.plural.buff")} color={C.azure} size={84} />
        <Figure value={String(nerfs)} label={t("patchHeroes.plural.nerf")} color={C.blood} size={84} />
        {others > 0 ? <Figure value={String(others)} label={t("patchHeroes.plural.adjust")} size={84} /> : null}
      </Figures>
    ) : undefined,
  });
}

// ── Skins, events ────────────────────────────────────────────────────

export function skinsCard(locale: Locale) {
  const t = createT(locale);
  const last = lastSkins(1)[0];
  return card({
    locale,
    kicker: t("nav.skins.label"),
    title: t("nav.skins.desc"),
    titleLines: 3,
    titleMax: 104,
    subtitle: last ? t("og.latestSkin", { skin: last.skin.name, hero: last.hero.name }) : null,
    art: last ? (illustrations[last.hero.slug]?.[last.skin.name] ?? heroArt(last.hero.slug)) : null,
    dex: ogPose("skins"),
    dexHeight: 220,
    data: <Figure value={new Intl.NumberFormat(LOCALE_INTL[locale]).format(gallerySkinCount)} label={t("og.skinsCount")} />,
  });
}

export async function eventsCard(locale: Locale) {
  const t = createT(locale);
  // Read only here: the events catalogue is large and server side.
  const { eventMonths, referenceDate } = await import("@/lib/events-server");
  const month = referenceDate.slice(0, 7);
  const current = eventMonths().find((m) => m.month <= month && m.starlight.length > 0);
  const star = current?.starlight[0];
  return card({
    locale,
    kicker: t("nav.events.label"),
    title: t("nav.events.desc"),
    titleLines: 3,
    titleMax: 100,
    subtitle: star ? t("og.starlight", { skin: star.name, hero: heroName(star.hero) }) : null,
    art: star ? (illustrations[star.hero]?.[star.name] ?? heroArt(star.hero)) : null,
    dex: ogPose("events"),
    dexHeight: 230,
  });
}

/**
 * The poster of a list of skins: the artwork of the first one that has
 * one, in the list's order (the caller puts the headline skins first).
 */
export function skinPoster(skins: readonly { hero: string; name: string }[]): { hero: string; name: string; art: string } | null {
  for (const s of skins) {
    const art = illustrations[s.hero]?.[s.name];
    if (art) return { hero: s.hero, name: s.name, art };
  }
  return null;
}

const count = (locale: Locale, n: number) => new Intl.NumberFormat(LOCALE_INTL[locale]).format(n);
const capitalized = (locale: Locale, text: string) => text.charAt(0).toLocaleUpperCase(LOCALE_INTL[locale]) + text.slice(1);

/** A month of events: the month in giant, its StarLight skin's artwork, its count of skins. */
export async function eventMonthCard(locale: Locale, key: string) {
  // Read only here: the events catalogue is large and server side.
  const { monthByKey } = await import("@/lib/events-server");
  const { OTHER_MODES } = await import("@/lib/events");
  const m = monthByKey(key);
  if (!m) return null;
  const t = createT(locale);
  const headline = [...m.starlight, ...m.collector];
  const skins = [...headline, ...OTHER_MODES.flatMap((k) => m.others[k])];
  const star = m.starlight[0];
  const poster = skinPoster(headline) ?? skinPoster(skins);
  return card({
    locale,
    kicker: t("nav.events.label"),
    title: capitalized(locale, monthYear(locale, `${m.month}-01`)),
    titleMax: 128,
    subtitle: star ? t("og.starlight", { skin: star.name, hero: heroName(star.hero) }) : null,
    art: poster?.art ?? heroArt(headline[0]?.hero ?? skins[0]?.hero),
    dex: ogPose("events"),
    dexHeight: 220,
    data: skins.length ? <Figure value={count(locale, skins.length)} label={t("og.skinsCount")} /> : undefined,
  });
}

/**
 * The skins calendar, or one of its years: the latest (or the year's
 * rarest) skin's artwork and the count of skins released.
 */
export function calendarCard(locale: Locale, year: number | null) {
  const t = createT(locale);
  const released = releasedSkins();
  if (year === null) {
    const years = calendarYears();
    const last = lastSkins(1)[0];
    return card({
      locale,
      kicker: [t("nav.skins.label"), years.length ? `${years.at(-1)} – ${years[0]}` : null].filter(Boolean).join(" · "),
      title: t("nav.skinsCalendar.label"),
      titleLines: 3,
      titleMax: 112,
      subtitle: last ? t("og.latestSkin", { skin: last.skin.name, hero: last.hero.name }) : null,
      art: last ? (illustrations[last.hero.slug]?.[last.skin.name] ?? heroArt(last.hero.slug)) : null,
      dex: ogPose("skins"),
      dexHeight: 220,
      data: <Figure value={count(locale, released.length)} label={t("og.skinsCount")} />,
    });
  }
  const y = groupByDate(released.filter((s) => readRelease(s.release)?.year === year), "chronological")[0];
  if (!y) return null;
  // The year's rarest skins first, as on its page's poster.
  const rarest = y.month.flatMap((m) => m.skins).sort((a, b) => b.rarity - a.rarity);
  return card({
    locale,
    kicker: t("nav.skinsCalendar.label"),
    title: t("pages.skinsCalendar.year.title", { year: y.year }),
    titleLines: 3,
    titleMax: 112,
    art: skinPoster(rarest)?.art ?? heroArt(rarest[0]?.hero),
    dex: ogPose("skins"),
    dexHeight: 220,
    data: <Figure value={count(locale, y.total)} label={t("og.skinsCount")} />,
  });
}

// ── Community builds ─────────────────────────────────────────────────

/** Heroes by number of builds, most first, ties by name; unknown heroes left out. */
export function heroesByBuilds(builds: readonly { build: { hero: string } }[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const b of builds) if (heroesBySlug.has(b.build.hero)) counts.set(b.build.hero, (counts.get(b.build.hero) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || heroName(a[0]).localeCompare(heroName(b[0]), "en"));
}

/** The community builds hub: the heroes with the most builds in portraits, the count of builds. */
export async function buildsCard(locale: Locale) {
  const t = createT(locale);
  // Read only here: the store is a server file, read the same way as the hub's page.
  const { listBuilds } = await import("@/lib/community-builds-store");
  const builds = await listBuilds().catch(() => []);
  const heroes = heroesByBuilds(builds).slice(0, 4);
  const aside =
    heroes.length >= 3
      ? await portraitRow(
          heroes.map(([slug, n]) => ({ portrait: portraitOf(slug), name: heroName(slug), figure: String(n) })),
          { width: 128, height: 330 },
        )
      : undefined;
  return card({
    locale,
    kicker: patchLine(t),
    title: t("nav.communityBuilds.label"),
    titleWidth: aside ? 470 : undefined,
    titleLines: 3,
    titleMax: 112,
    subtitle: aside ? null : t("nav.communityBuilds.desc"),
    aside,
    // Before enough heroes have builds: the artwork of the one with the most, else the build tool's.
    art: aside ? null : (heroArt(heroes[0]?.[0]) ?? toolArt("/tools/build").art),
    dex: ogPose("tool"),
    dexHeight: aside ? 170 : 240,
    dexPlace: aside ? "cut" : "right",
    data: builds.length ? <Figure value={count(locale, builds.length)} label={t("og.buildsCount")} size={80} /> : undefined,
  });
}

// ── Esports ──────────────────────────────────────────────────────────

export async function esportsCard(locale: Locale) {
  const t = createT(locale);
  const meta = proMeta();
  const picked = meta.picked[0];
  const banned = meta.banned[0];
  const shown = [picked, banned].filter(Boolean);
  const aside = shown.length
    ? await portraitRow(
        shown.map((h, i) => ({
          portrait: portraitOf(h.slug),
          name: heroName(h.slug),
          figure: i === 0 ? t("og.picked") : t("og.banned"),
        })),
        { width: 200, height: 370 },
      )
    : undefined;
  return card({
    locale,
    kicker: t("nav.esports.label"),
    title: t("pages.esports.seo.hubTitle"),
    titleLines: 3,
    titleWidth: aside ? 560 : 660,
    titleMax: 100,
    aside,
    // Without heroes yet (a tournament to come), the artwork of the pros' favourite hero.
    art: aside ? null : heroArt(proMeta().picked[0]?.slug),
    dex: ogPose("esports"),
    dexHeight: aside ? 170 : 260,
    dexPlace: aside ? "cut" : "right",
    data: meta.games ? <Figure value={new Intl.NumberFormat(LOCALE_INTL[locale]).format(meta.games)} label={t("og.games")} size={80} /> : undefined,
  });
}

export async function tournamentCard(locale: Locale, slug: string) {
  const turn = tournamentBySlug.get(slug);
  if (!turn) return null;
  const t = createT(locale);
  const top = [...turn.heroes].sort((a, b) => b.picks - a.picks).slice(0, 3);
  const aside = top.length
    ? await portraitRow(
        top.map((h) => ({
          portrait: portraitOf(h.slug),
          name: heroName(h.slug),
          figure: turn.games ? `${Math.round((h.picks / turn.games) * 100)} %` : undefined,
        })),
        { width: 132, height: 300 },
      )
    : undefined;
  return card({
    locale,
    kicker: [t("nav.esports.label"), turn.city, turn.patch ? t("og.patch", { v: turn.patch }) : null].filter(Boolean).join(" · "),
    title: turn.name,
    titleLines: 3,
    titleWidth: aside ? 520 : 660,
    titleMax: 104,
    subtitle: turn.champion ? t("og.champion", { team: turn.champion }) : null,
    aside,
    // Without heroes yet (a tournament to come), the artwork of the pros' favourite hero.
    art: aside ? null : heroArt(proMeta().picked[0]?.slug),
    dex: ogPose("esports"),
    dexHeight: aside ? 170 : 260,
    dexPlace: aside ? "cut" : "right",
    data: turn.games ? <Figure value={String(turn.games)} label={t("og.games")} size={80} /> : undefined,
  });
}

// ── Tools, games, community ──────────────────────────────────────────

/** A tool or a game: its artwork and Dex's pose are the tool's own (`TOOL_ART`). */
export function toolCard(locale: Locale, path: string, key: string, kind: "tool" | "game" = "tool") {
  const t = createT(locale);
  const { art, dex } = toolArt(path);
  return card({
    locale,
    kicker: path === "/tools" ? t("og.toolsKicker") : t(kind === "game" ? "og.game" : "og.tool"),
    title: t(`nav.${key}.label`),
    titleMax: 128,
    subtitle: t(`nav.${key}.desc`),
    art,
    dex,
    dexHeight: 260,
  });
}

export function communityCard(locale: Locale) {
  const t = createT(locale);
  return card({
    locale,
    kicker: t("nav.community.label"),
    title: t("pages.community.seo.title"),
    titleLines: 3,
    subtitle: t("nav.community.desc"),
    art: artOf("layla"),
    dex: ogPose("community"),
    dexHeight: 280,
  });
}
