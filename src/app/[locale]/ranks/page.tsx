import type { Metadata } from "next";
import Image from "next/image";
import { Shield, Star, Swords } from "lucide-react";
import { FreshnessLine } from "@/components/freshness";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { classesChip } from "@/components/chip";
import { Card, PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import {
  SCALE,
  REWARDS_SEASON,
  RULES_FAMILY,
  SOURCES_RANKS,
  tierAppearance,
  tierOfFamily,
  type FamilyRank,
  type TierScale,
} from "@/lib/rank-scale";
import { longDate, dateMeasure, listNames, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { site } from "@/lib/site";
import { rankingOfRank, RANKS_CLASSES } from "@/lib/tier-list";

/**
 * Rank system: the ladder from Warrior to Mythical Immortal, its divisions,
 * its stars and its points, then what our measurements say about each rank
 * slice (the heroes that win the most there). The structure comes from
 * `rank-scale.ts`, the rates from the tier list: the page follows the
 * syncs without any touch-up.
 */
type Params = { params: Promise<{ locale: Locale }> };

const PATH = "/ranks";
const TOP = 5;
const FAMILIES: FamilyRank[] = ["warrior", "elite", "master", "grandmaster", "epic", "legend", "mythic"];
const SECTIONS = [
  ["echelle", "scaleTitle"],
  ["tableau", "tableTitle"],
  ["mythic", "mythicTitle"],
  ["heros", "heroesTitle"],
  ["saison", "seasonTitle"],
] as const;

/** Legend has no rank name in the catalog: we reuse that of its measurement slice. */
const nameTier = (t: T, key: string) => (key === "legend" ? t("measuredRanks.legend") : t(`rankNames.${key}`));

const pathTierList = (r: MeasuredRank) => (r === "all" ? "/tier-list" : `/tier-list/${r}`);

/** Points that open a mythic tier, read from the ladder rather than written in the labels. */
const thresholdMythic = (key: string) => SCALE.find((p) => p.key === key)?.points?.min ?? 0;

/** The heroes that win the most in a rank slice, excluding samples that are too thin. */
function best(rank: MeasuredRank) {
  return rankingOfRank(rank)
    .filter((e) => !e.lowSample)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, TOP);
}

function description(locale: Locale) {
  const t = createT(locale);
  const top = best("mythic").slice(0, 3).map((e) => e.hero.name);
  return top.length
    ? t("pages.seo.ranks.description", { n: SCALE.length, top: listNames(locale, top), date: longDate(locale) })
    : t("pages.seo.ranks.descriptionSimple", { n: SCALE.length });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.seo.ranks.title"),
    description: description(locale),
    path: PATH,
    keywords: ["rank system", "ranks", "Mythical Immortal", "Mythical Glory", "stars", "season rewards", "MLBB"],
  });
}

function Emblem({ tier, size = 56 }: { tier: TierScale; size?: number }) {
  const { image, color } = tierAppearance(tier);
  // The rank name is written next to it: the emblem is decorative.
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      />
    );
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center" style={{ width: size, height: size, color }}>
      <Shield size={Math.round(size * 0.8)} strokeWidth={1.5} />
    </span>
  );
}

function BlockTitle({ id, children, intro }: { id: string; children: React.ReactNode; intro?: string }) {
  return (
    <>
      <h2 id={`${id}-titre`} className="font-heading text-2xl font-bold text-chalk-100 sm:text-3xl">
        {children}
      </h2>
      <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
      {intro && <p className="mt-3 max-w-3xl leading-relaxed text-chalk-300">{intro}</p>}
    </>
  );
}

export default async function RanksPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const integer = new Intl.NumberFormat(locale);
  const title = t("pages.ranks.title");
  const heads = best("all").map((e) => e.hero.slug);
  const atTop = best("glory").filter((e) => !heads.includes(e.hero.slug)).map((e) => e.hero.name);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description: description(locale),
    url: `${site.url}/${locale}${PATH}`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: dateMeasure,
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
    mainEntity: {
      "@type": "ItemList",
      name: t("pages.ranks.scaleTitle"),
      numberOfItems: SCALE.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: SCALE.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: nameTier(t, p.key) })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <PageHeader title={title} lead={t("pages.ranks.lead")}>
        <FreshnessLine locale={locale} className="mt-6" />
        <nav aria-label={t("pages.ranks.contents")} className="mt-6 flex flex-wrap gap-2">
          {SECTIONS.map(([id, key]) => (
            <a key={id} href={`#${id}`} className={classesChip(false, true)}>
              {t(`pages.ranks.${key}`)}
            </a>
          ))}
        </nav>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="echelle" aria-labelledby="echelle-titre" className="scroll-mt-20">
          <BlockTitle id="echelle" intro={t("pages.ranks.scaleIntro", { n: SCALE.length })}>
            {t("pages.ranks.scaleTitle")}
          </BlockTitle>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCALE.map((p, i) => {
              const { color } = tierAppearance(p);
              const bans = RULES_FAMILY[p.family].bans;
              return (
                <li key={p.key}>
                  <Card className="flex h-full gap-4">
                    <Emblem tier={p} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-chalk-500">
                        {t("pages.ranks.position", { n: i + 1, total: SCALE.length })}
                      </p>
                      <h3 className="font-heading text-xl font-bold" style={{ color }}>
                        {nameTier(t, p.key)}
                      </h3>
                      <p className="mt-1 text-sm text-chalk-300">
                        {p.points === null
                          ? t("pages.ranks.divisions", { n: p.divisions.length, liste: p.divisions.join(" → ") })
                          : p.points.max === null
                            ? t("pages.ranks.pointsPlus", { min: p.points.min })
                            : t("pages.ranks.pointsBetween", { min: p.points.min, max: p.points.max })}
                      </p>
                      {p.starsMax !== null && (
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-chalk-400">
                          <Star size={12} aria-hidden className="fill-current text-gold-400" />
                          {t("pages.ranks.starsPerDivision", { n: p.starsMax })}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                        {bans !== null && (
                          <span className="bevel-sm bg-azure-500/15 px-2 py-0.5 text-azure-400">
                            {t("pages.ranks.draft", { n: bans })}
                          </span>
                        )}
                        {p.measure && (
                          <Link
                            href={pathTierList(p.measure)}
                            className="font-semibold text-gold-400 transition-colors hover:text-gold-500"
                          >
                            {t("pages.ranks.tierListLink", { rang: t(`measuredRanks.${p.measure}`) })} →
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.scaleNote")}</p>
        </section>

        <section id="tableau" aria-labelledby="tableau-titre" className="scroll-mt-20">
          <BlockTitle id="tableau" intro={t("pages.ranks.tableIntro")}>
            {t("pages.ranks.tableTitle")}
          </BlockTitle>
          <div className="mt-6 relative overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-night-700 text-xs uppercase tracking-wide text-chalk-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colRank")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colDivisions")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colStars")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colDraft")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colPromotion")}</th>
                  <th scope="col" className="py-2 font-medium">{t("pages.ranks.colProtection")}</th>
                </tr>
              </thead>
              <tbody>
                {FAMILIES.map((f) => {
                  const p = tierOfFamily(f);
                  const r = RULES_FAMILY[f];
                  return (
                    <tr key={f} className="border-b border-night-800">
                      <th scope="row" className="py-2.5 pr-4">
                        <span className="flex items-center gap-2">
                          <Emblem tier={p} size={28} />
                          <span className="font-semibold" style={{ color: tierAppearance(p).color }}>
                            {f === "mythic" ? t("pages.ranks.mythicFamily") : nameTier(t, p.key)}
                          </span>
                        </span>
                      </th>
                      <td className="py-2.5 pr-4 text-chalk-200">{p.divisions.length ? p.divisions.join(" · ") : "—"}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-chalk-200">
                        {p.starsMax ?? t("pages.ranks.pointsInstead")}
                      </td>
                      <td className="py-2.5 pr-4 text-chalk-200">
                        {r.bans === null ? t("pages.ranks.noDraft") : t("pages.ranks.bans", { n: r.bans })}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-chalk-200">
                        {r.climbPoints === null ? "—" : integer.format(r.climbPoints)}
                      </td>
                      <td className="py-2.5 tabular-nums text-chalk-200">{integer.format(r.pointsProtection)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.tableNote")}</p>
        </section>

        <section id="mythic" aria-labelledby="mythique-titre" className="scroll-mt-20">
          <BlockTitle
            id="mythic"
            intro={t("pages.ranks.mythicIntro", {
              honneur: thresholdMythic("mythic-honor"),
              gloire: thresholdMythic("mythic-glory"),
              immortel: thresholdMythic("mythic-immortal"),
            })}
          >
            {t("pages.ranks.mythicTitle")}
          </BlockTitle>
          <ol className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SCALE.filter((p) => p.points).map((p) => (
              <li key={p.key}>
                <Card className="flex h-full flex-col items-center text-center">
                  <Emblem tier={p} size={64} />
                  <h3 className="mt-2 font-heading text-lg font-bold" style={{ color: tierAppearance(p).color }}>
                    {nameTier(t, p.key)}
                  </h3>
                  <p className="text-sm tabular-nums text-chalk-300">
                    {p.points!.max === null
                      ? t("pages.ranks.pointsPlus", { min: p.points!.min })
                      : t("pages.ranks.pointsBetween", { min: p.points!.min, max: p.points!.max })}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-3xl text-sm text-chalk-400">{t("pages.ranks.mythicCoins")}</p>
        </section>

        <section id="heros" aria-labelledby="heros-titre" className="scroll-mt-20">
          <BlockTitle id="heros" intro={t("pages.ranks.heroesIntro", { n: TOP })}>
            {t("pages.ranks.heroesTitle")}
          </BlockTitle>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RANKS_CLASSES.map((r) => {
              const list = best(r);
              if (!list.length) return null;
              const tier = SCALE.find((p) => p.measure === r);
              return (
                <Card key={r} className="flex flex-col">
                  <div className="flex items-center gap-3">
                    {tier ? (
                      <Emblem tier={tier} size={36} />
                    ) : (
                      <span aria-hidden className="grid size-9 place-items-center text-gold-400">
                        <Swords size={24} />
                      </span>
                    )}
                    <h3 className="font-heading text-lg font-bold text-chalk-100">{t(`measuredRanks.${r}`)}</h3>
                  </div>
                  <ol className="mt-3 flex-1 space-y-1.5">
                    {list.map((e, i) => (
                      <li key={e.hero.slug}>
                        <Link href={`/heroes/${e.hero.slug}`} className="group flex items-center gap-3">
                          <span className="w-4 text-right text-xs tabular-nums text-chalk-500">{i + 1}</span>
                          <HeroPortrait
                            source={e.hero.images.icon ?? e.hero.images.portrait}
                            name={e.hero.name}
                            size="small"
                            decorative
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-chalk-200 transition-colors group-hover:text-gold-400">
                            {e.hero.name}
                          </span>
                          <span className="text-sm tabular-nums text-chalk-300">
                            <span className="sr-only">{t("pages.ranks.win")} </span>
                            {percentage(locale, e.winRate)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <Link
                    href={pathTierList(r)}
                    className="mt-4 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
                  >
                    {r === "all"
                      ? t("pages.ranks.tierListAllLink")
                      : t("pages.ranks.tierListLink", { rang: t(`measuredRanks.${r}`) })}{" "}
                    →
                  </Link>
                </Card>
              );
            })}
          </div>
          {atTop.length > 0 && (
            <p className="mt-4 max-w-3xl leading-relaxed text-chalk-300">
              {t("pages.ranks.heroesGap", { noms: listNames(locale, atTop), rang: t("measuredRanks.glory") })}
            </p>
          )}
          <p className="mt-3 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.heroesNote")}</p>
        </section>

        <section id="saison" aria-labelledby="saison-titre" className="scroll-mt-20">
          <BlockTitle id="saison">{t("pages.ranks.seasonTitle")}</BlockTitle>
          <div className="mt-4 max-w-3xl space-y-3 leading-relaxed text-chalk-300">
            <p>{t("pages.ranks.reset1")}</p>
            <p>{t("pages.ranks.reset2")}</p>
            <p>{t("pages.ranks.journey")}</p>
            <p>
              <Link href="/tools/server-time" className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
                {t("pages.ranks.serverTimeLink")} →
              </Link>
            </p>
          </div>

          <h3 className="mt-8 font-heading text-xl font-bold text-chalk-100">{t("pages.ranks.rewardsTitle")}</h3>
          <div className="mt-3 relative overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-night-700 text-xs uppercase tracking-wide text-chalk-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colFinalRank")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colBattlePoints")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colTickets")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("pages.ranks.colFragments")}</th>
                  <th scope="col" className="py-2 font-medium">{t("pages.ranks.colOthers")}</th>
                </tr>
              </thead>
              <tbody>
                {REWARDS_SEASON.map((r) => {
                  const p = tierOfFamily(r.family);
                  return (
                    <tr key={r.family} className="border-b border-night-800">
                      <th scope="row" className="py-2.5 pr-4">
                        <span className="flex items-center gap-2">
                          <Emblem tier={p} size={28} />
                          <span className="font-semibold" style={{ color: tierAppearance(p).color }}>
                            {r.family === "mythic" ? t("pages.ranks.mythicFamily") : nameTier(t, p.key)}
                          </span>
                        </span>
                      </th>
                      <td className="py-2.5 pr-4 tabular-nums text-chalk-200">{integer.format(r.battlePoints)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-chalk-200">{integer.format(r.tickets)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-chalk-200">
                        {r.fragments === null ? "—" : integer.format(r.fragments)}
                      </td>
                      <td className="py-2.5 text-chalk-200">{r.emblem ? t("pages.ranks.emote") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-chalk-500">{t("pages.ranks.rewardsNote")}</p>
        </section>

        <section aria-labelledby="sources-titre" className="border-t border-night-800 pt-6 text-sm text-chalk-500">
          <h2 id="sources-titre" className="font-semibold text-chalk-300">{t("pages.ranks.sourcesTitle")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <a href={SOURCES_RANKS.ranked} rel="noopener" className="underline transition-colors hover:text-gold-400">
                {t("pages.ranks.sourceRanked")}
              </a>
            </li>
            <li>
              <a href={SOURCES_RANKS.rewards} rel="noopener" className="underline transition-colors hover:text-gold-400">
                {t("pages.ranks.sourceRewards")}
              </a>
            </li>
            <li>
              <a href={SOURCES_RANKS.table} rel="noopener" className="underline transition-colors hover:text-gold-400">
                {t("pages.ranks.sourceTable")}
              </a>
            </li>
            <li>{t("pages.ranks.sourceMeasures", { date: longDate(locale) })}</li>
          </ul>
        </section>
      </div>
    </>
  );
}
