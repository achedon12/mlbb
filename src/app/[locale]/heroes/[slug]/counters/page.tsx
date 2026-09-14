import type { Metadata } from "next";
import { pathPair } from "@/lib/pairs";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronDown, TrendingDown, TrendingUp, Users } from "lucide-react";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { OpenAnchor } from "@/components/open-anchor";
import { HeroPortrait } from "@/components/hero-portrait";
import { Card, PageHeader } from "@/components/ui";
import statistics from "@/data/game/statistics.json";
import visuals from "@/data/game/visuals.json";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { heroLabel } from "@/i18n/hero-data";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import {
  aggregateCounters,
  countersByLane,
  frenchOf,
  formatGap,
  momentsMatch,
  itemsCounter,
  summarySentence,
  hasLifesteal,
  summaryRank,
  type AggregatedCounter,
  type ReasonItem,
} from "@/lib/counters";
import { buildsPlayed, teammates, counters, allHeroes, heroesBySlug, itemsFor, type CounterFigure } from "@/lib/data";
import { durationOf, type BucketDuration } from "@/lib/evolution";
import { longDate, dateMeasure, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { MEASURED_RANKS } from "@/lib/measured-ranks";
import { site } from "@/lib/site";
import { rankingFull, RANKS_CLASSES, statsByRank } from "@/lib/tier-list";
import type { Hero } from "@/lib/types";
import { cn } from "@/lib/utils";
import { visualItem } from "@/lib/build-visuals";

/**
 * Page « counters » d'un heros : qui prendre contre lui, rang par rang.
 *
 * La requete « {heros} counter » est la plus demandee apres le build, et
 * aucune page ne lui repondait : les contres vivaient dans un onglet de la
 * fiche. Tout est rendu cote serveur — chaque rang dans son `<details>`,
 * ouvert ou non —, si bien que la page porte toutes les mesures sans script.
 */

type Params = { params: Promise<{ locale: Locale; slug: string }> };

interface Relation {
  strongAgainst: string[];
  weakAgainst: string[];
  synergies: string[];
}
const relations = statistics.relations as unknown as Record<string, Relation>;
const iconsItems = (visuals as unknown as { items: Record<string, string> }).items;

/** Une page par heros ; un slug inconnu tombe sur la 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return allHeroes.map((h) => ({ slug: h.slug }));
}

const nameOf = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
const portraitOf = (slug: string) => {
  const x = heroesBySlug.get(slug);
  return x?.images.icon ?? x?.images.portrait ?? null;
};
/** Ecarte un adversaire que le catalogue ne connait pas (synchro partielle). */
const known = <E extends { slug: string }>(list: E[] = []) => list.filter((e) => heroesBySlug.has(e.slug));
const names = (name: string) => ({ nom: name, deNom: frenchOf(name) });

/** Phrase de synthese, commune a la description et au chapeau de la page. */
function summary(locale: Locale, h: Hero) {
  const t = createT(locale);
  const byRank = counters[h.slug] ?? {};
  const rank = summaryRank(byRank);
  const measure = rank ? byRank[rank] : undefined;
  const withNames = (list: CounterFigure[]) => known(list).map((e) => ({ ...e, name: nameOf(e.slug) }));
  const sentence =
    rank && measure
      ? summarySentence(locale, t, { name: h.name, rank, weak: withNames(measure.weak), strong: withNames(measure.strong) })
      : t("pages.heroCounters.noMeasure", { nom: h.name });
  return { rank, sentence };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return {};
  const t = createT(locale);
  const { rank, sentence } = summary(locale, h);
  // Patch dans le titre : les resultats qui menent sur « counter » portent
  // tous une date ou une version, et celle-ci suit les synchros. Un nom long
  // (« Yi Sun-shin ») pousserait le patch au-dela de la coupe des resultats :
  // le titre court le garde visible.
  const variables = { ...names(h.name), v: patchCurrent?.version ?? "" };
  const full = t(patchCurrent ? "pages.heroCounters.metaTitle" : "pages.heroCounters.metaTitleNoPatch", variables);
  const title = patchCurrent && full.length > TITLE_LONG ? t("pages.heroCounters.metaTitleShort", variables) : full;
  return {
    ...metaPage(locale, {
      title,
      description: `${sentence} ${t("pages.heroCounters.updatedOn", { date: longDate(locale) })}`,
      path: `/heroes/${slug}/counters`,
      type: "article",
      image: `/${locale}/heroes/${slug}/opengraph-image`,
    }),
    // Sans aucune mesure (heros tout juste sorti), la page n'a rien a dire :
    // elle reste accessible mais hors de l'index, comme une page mince.
    ...(rank ? {} : { robots: { index: false, follow: true } }),
  };
}

/** Au-dela, le titre complet est coupe dans les resultats avant le numero de patch. */
const TITLE_LONG = 62;

export default async function CountersPage({ params }: Params) {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) notFound();

  const t = createT(locale);
  const n = names(h.name);
  const gap = (v: number) => formatGap(locale, t, v);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const byRank = counters[slug] ?? {};
  const { rank: rankMain, sentence } = summary(locale, h);
  const stats = statsByRank(slug);
  const ranks = MEASURED_RANKS.filter((r) => byRank[r] || teammates[slug]?.[r]?.length);
  // Tranches lues pour l'agregat : `all` ne compte qu'a defaut de tranche.
  const bucketsMeasured = MEASURED_RANKS.filter((r) => r !== "all" && byRank[r]).length || (byRank.all ? 1 : 0);
  const aggregatedCounters = known(aggregateCounters(byRank, "weak"));
  const victims = known(aggregateCounters(byRank, "strong")).slice(0, 8);
  const best = aggregatedCounters.slice(0, 8);
  const first = best[0]?.slug;

  // Objets par regle : fiche du heros, et vol de vie lu sur son build le plus
  // joue (bonus du catalogue anglais, ou « Lifesteal » s'ecrit toujours pareil).
  const catalog = new Map(itemsFor(locale).map((o) => [o.slug, o]));
  const englishBonus = new Map(itemsFor("en").map((o) => [o.slug, o.bonus]));
  const byLane = buildsPlayed[slug] ?? {};
  const laneReference = h.lanes.find((l) => byLane[l]) ?? Object.keys(byLane)[0];
  const buildReference = laneReference ? byLane[laneReference]?.all?.[0] : undefined;
  const bonusPlayed = (buildReference?.items ?? []).map((o) => englishBonus.get(visualItem(o).slug ?? "") ?? null);
  const tips = itemsCounter(
    { typeDamage: h.damageType, roles: h.roles, specialties: h.specialties, lifesteal: hasLifesteal(bonusPlayed) },
    (s) => catalog.has(s),
  );
  const groupsItems = [...new Set(tips.map((c) => c.reason))].map((reason) => ({
    reason,
    items: tips.filter((c) => c.reason === reason).map((c) => catalog.get(c.slug)!),
  }));

  // Duree de partie, au rang de la synthese quand il est mesure.
  const durations = durationOf(slug);
  const rankDuration = rankMain && durations[rankMain] ? rankMain : durations.all ? "all" : null;
  const buckets = rankDuration ? durations[rankDuration] : undefined;
  const moments = momentsMatch(buckets);
  const nameBucket = (x: BucketDuration) =>
    x.to === null
      ? t("pages.heroDetail.statistics.minutesPlus", { de: x.from })
      : t("pages.heroDetail.statistics.minutes", { de: x.from, a: x.to });

  const lanesCounters = countersByLane(aggregatedCounters, (s) => heroesBySlug.get(s)?.lanes ?? [], h.lanes);
  const relation = relations[slug];
  const wiki = relation
    ? ([
        [t("pages.heroDetail.comfortable", n), relation.strongAgainst, "good"],
        [t("pages.heroDetail.difficulty2", n), relation.weakAgainst, "bad"],
        [t("pages.heroCounters.wiki.synergies", n), relation.synergies, "good"],
      ] as const).map(([title, slugs, tone]) => ({ title, tone, slugs: slugs.filter((s) => heroesBySlug.has(s)) }))
    : [];
  const hasWiki = wiki.some((w) => w.slugs.length > 0);

  // Pages counters des heros de la meme position, les mieux classes d'abord.
  const laneMain = h.lanes[0];
  const neighbours = laneMain
    ? rankingFull
        .filter((e) => e.hero.slug !== slug && e.hero.lanes.includes(laneMain))
        .slice(0, 12)
        .map((e) => e.hero)
    : [];

  const rankTierList = rankMain && rankMain !== "all" && RANKS_CLASSES.includes(rankMain) ? rankMain : null;
  const links = [
    { href: `/heroes/${slug}#contres`, label: t("pages.heroCounters.sheetLink", n) },
    { href: `/heroes/${slug}#builds`, label: t("pages.heroCounters.buildsLink", n) },
    ...(first
      ? [{ href: pathPair(slug, first), label: t("pages.heroCounters.compareLink", { nom: h.name, autre: nameOf(first) }) }]
      : []),
    rankTierList
      ? { href: `/tier-list/${rankTierList}`, label: t("pages.tierList.titleRank", { rang: t(`measuredRanks.${rankTierList}`) }) }
      : { href: "/tier-list", label: t("nav.tierList.label") },
  ];

  const title = t("pages.heroCounters.title", n);
  const address = `${site.url}/${locale}/heroes/${slug}/counters`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${address}#article`,
        headline: title,
        description: sentence,
        inLanguage: LOCALE_HTML[locale],
        dateModified: dateMeasure,
        image: `${site.url}/${locale}/heroes/${slug}/opengraph-image`,
        author: { "@type": "Person", name: site.author },
        publisher: { "@type": "Organization", name: site.name, url: site.url },
        mainEntityOfPage: address,
        about: {
          "@type": "VideoGame",
          name: "Mobile Legends: Bang Bang",
          publisher: { "@type": "Organization", name: "Moonton" },
        },
        ...(best.length > 0 ? { mainEntity: { "@id": `${address}#contres` } } : {}),
      },
      ...(best.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${address}#contres`,
              name: t("pages.heroCounters.bestCounters", n),
              itemListOrder: "https://schema.org/ItemListOrderDescending",
              numberOfItems: best.length,
              itemListElement: best.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: nameOf(c.slug),
                url: `${site.url}/${locale}/heroes/${c.slug}`,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

      <PageHeader
        title={title}
        lead={sentence}
        crumbs={[
          { name: t("nav.heroes.label"), href: "/heroes" },
          { name: h.name, href: `/heroes/${slug}` },
          // Pas de `freres` ici : 133 liens de plus dans la charge RSC de chaque
          // page, quand la section « autres pages » mene deja aux voisins.
          { name: t("pages.heroDetail.tab.counters") },
        ]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="bevel-sm inline-block border border-night-700 px-3 py-1.5 font-medium text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        {/* ── Synthese, rangs confondus ───────────────────────────────── */}
        {(best.length > 0 || victims.length > 0) && (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* min-w-0 : sans lui, la piste de grille s'elargit a la largeur du tableau et deborde a 390 px. */}
            {best.length > 0 && (
              <section aria-labelledby="meilleurs" className="min-w-0">
                <h2 id="meilleurs" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.heroCounters.bestCounters", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">
                  {t("pages.heroCounters.bestCountersIntro", n)}
                </p>
                <AggregatedTable t={t} rows={best} tone="bad" total={bucketsMeasured} slug={slug} gap={gap} />
              </section>
            )}
            {victims.length > 0 && (
              <section aria-labelledby="victimes" className="min-w-0">
                <h2 id="victimes" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.heroCounters.victims", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.heroCounters.victimsIntro", n)}</p>
                <AggregatedTable t={t} rows={victims} tone="good" total={bucketsMeasured} slug={slug} gap={gap} />
              </section>
            )}
          </div>
        )}

        {/* Deplie le rang vise par une ancre (« #rang-mythic ») : Chromium ne le fait pas seul. */}
        <OpenAnchor />

        {/* ── Rang par rang ───────────────────────────────────────────── */}
        {ranks.length > 0 && (
          <section aria-labelledby="par-rang">
            <h2 id="par-rang" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.heroCounters.byRank")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">
              {t("pages.heroDetail.countersIntro", n)} {t("pages.heroCounters.byRankIntro", n)}
            </p>
            <nav aria-label={t("pages.heroCounters.ranksNav")} className="mt-4">
              <ul className="flex flex-wrap gap-2 text-sm">
                {ranks.map((r) => (
                  <li key={r}>
                    <a
                      href={`#rang-${r}`}
                      className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 hover:border-gold-500/60 hover:text-gold-400"
                    >
                      {t(`measuredRanks.${r}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-5 space-y-3">
              {ranks.map((r) => {
                const measure = byRank[r];
                const s = stats[r];
                return (
                  <details
                    key={r}
                    id={`rang-${r}`}
                    open={r === rankMain}
                    className="bevel group scroll-mt-24 border border-night-700/70 bg-night-900/60"
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className="shrink-0 text-chalk-500 transition-transform group-open:rotate-180"
                      />
                      <h3 className="font-heading text-lg font-bold text-chalk-100">{t(`measuredRanks.${r}`)}</h3>
                      {s && (
                        <span className="text-sm text-chalk-500">
                          {t("pages.heroDetail.tier", { p: s.tier })} ·{" "}
                          {t("builds.win", { taux: decimal.format(s.winRate) })}
                        </span>
                      )}
                    </summary>
                    <div className="border-t border-night-800 p-4">
                      {measure?.winRate != null && (
                        <p className="mb-4 text-sm text-chalk-500">
                          {t("pages.heroDetail.countersRef", { taux: decimal.format(measure.winRate) })}
                        </p>
                      )}
                      <div className={cn("grid gap-6 md:grid-cols-3", STYLE_TABLES_RANK)}>
                        <TableRank
                          t={t}
                          title={t("counters.difficulty")}
                          icon={<TrendingDown size={16} aria-hidden />}
                          tone="bad"
                          rows={known(measure?.weak)}
                          gap={gap}
                        />
                        <TableRank
                          t={t}
                          title={t("counters.strong")}
                          icon={<TrendingUp size={16} aria-hidden />}
                          tone="good"
                          rows={known(measure?.strong)}
                          gap={gap}
                        />
                        <TableRank
                          t={t}
                          title={t("pages.heroDetail.teammates")}
                          icon={<Users size={16} aria-hidden />}
                          tone="good"
                          rows={known(teammates[slug]?.[r])}
                          gap={gap}
                          pageCounters={false}
                        />
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Comment le contrer ──────────────────────────────────────── */}
        <section aria-labelledby="contrer">
          <h2 id="contrer" className="font-heading text-2xl font-bold text-chalk-100">
            {t("pages.heroCounters.howToCounter", n)}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">
            {t("pages.heroCounters.howToCounterIntro", n)}
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <Card>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroCounters.items.title", n)}</h3>
              <p className="bevel-sm mt-2 inline-block border border-gold-500/40 px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-gold-400">
                {t("pages.heroCounters.items.rule")}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-chalk-500">
                {t("pages.heroCounters.items.intro", {
                  ...n,
                  degats: heroLabel(t, "damage", h.damageType)?.toLocaleLowerCase(locale) ?? "—",
                })}
              </p>
              {groupsItems.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {groupsItems.map((g) => (
                    <div key={g.reason}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-chalk-400">
                        {t(`pages.heroCounters.items.reason.${g.reason satisfies ReasonItem}`)}
                      </h4>
                      <ul className="mt-2 space-y-2">
                        {g.items.map((o) => (
                          <li key={o.slug}>
                            <Link href={`/items#${o.slug}`} className="group/objet flex items-center gap-2.5">
                              {iconsItems[o.slug] ? (
                                <Image
                                  src={iconsItems[o.slug]}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="bevel-sm size-8 shrink-0 bg-night-800"
                                />
                              ) : (
                                <span aria-hidden className="bevel-sm size-8 shrink-0 bg-night-800" />
                              )}
                              <span className="min-w-0">
                                <span className="block text-sm text-chalk-100 group-hover/objet:text-gold-400">{o.name}</span>
                                {o.summary && <span className="block text-xs text-chalk-500">{o.summary}</span>}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-chalk-400">{t("pages.heroCounters.items.none", n)}</p>
              )}
            </Card>

            <Card>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroCounters.duration.title", n)}</h3>
              {moments && buckets && rankDuration ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-chalk-300">
                    {t("pages.heroCounters.duration.sentence", {
                      nom: h.name,
                      faible: nameBucket(moments.weak),
                      tauxFaible: percentage(locale, moments.weak.winRate),
                      fort: nameBucket(moments.strong),
                      tauxFort: percentage(locale, moments.strong.winRate),
                    })}
                  </p>
                  <p className="mt-1 text-xs text-chalk-500">
                    {t(`pages.heroDetail.statistics.profile.${moments.profile}`)} ·{" "}
                    {t("pages.heroCounters.duration.rank", { rang: t(`measuredRanks.${rankDuration}`) })}
                  </p>
                  <DurationBars buckets={buckets} moments={moments} nameBucket={nameBucket} locale={locale} />
                </>
              ) : (
                <p className="mt-3 text-sm text-chalk-400">{t("pages.heroCounters.duration.none", n)}</p>
              )}
            </Card>

            <Card>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroCounters.lanes.title")}</h3>
              <p className="mt-3 text-xs leading-relaxed text-chalk-500">{t("pages.heroCounters.lanes.intro", n)}</p>
              {lanesCounters.length > 0 ? (
                <dl className="mt-4 space-y-3">
                  {lanesCounters.map((g) => (
                    <div key={g.lane}>
                      <dt className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-400">
                        {t(`lanes.${g.lane}`)}
                        {h.lanes.includes(g.lane) && (
                          <span className="bevel-sm border border-blood-500/40 px-1.5 py-px text-[0.65rem] text-blood-500">
                            {t("pages.heroCounters.lanes.direct")}
                          </span>
                        )}
                      </dt>
                      <dd className="mt-1.5">
                        <ul className="flex flex-wrap gap-1.5 text-sm">
                          {g.counters.map((c) => (
                            <li key={c.slug}>
                              <Link
                                href={`/heroes/${c.slug}`}
                                className="bevel-sm inline-flex gap-1.5 border border-night-700 px-2 py-0.5 text-chalk-300 hover:border-gold-500/60"
                              >
                                {nameOf(c.slug)}
                                <span className="tabular-nums text-blood-500">{gap(c.average)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-chalk-400">{t("pages.heroCounters.noMeasure", n)}</p>
              )}
            </Card>
          </div>
        </section>

        {/* ── Relations du wiki ───────────────────────────────────────── */}
        {hasWiki && (
          <section aria-labelledby="wiki">
            <h2 id="wiki" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.heroCounters.wiki.title")}
            </h2>
            <p className="mt-2 text-sm text-chalk-500">{t("pages.heroCounters.wiki.intro")}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {wiki
                .filter((w) => w.slugs.length > 0)
                .map((w) => (
                  <Card key={w.title}>
                    <h3 className="text-sm font-semibold text-chalk-100">{w.title}</h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {w.slugs.map((s) => (
                        <li key={s}>
                          <Link
                            href={`/heroes/${s}`}
                            className={cn(
                              "bevel-sm inline-block border px-2.5 py-1 text-sm transition-colors",
                              w.tone === "good"
                                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                : "border-blood-500/30 text-blood-500 hover:bg-blood-500/10",
                            )}
                          >
                            {nameOf(s)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
            </div>
          </section>
        )}

        {/* ── Autres pages counters, meme position ────────────────────── */}
        {neighbours.length > 0 && laneMain && (
          <section aria-labelledby="autres">
            <h2 id="autres" className="font-heading text-xl font-bold text-chalk-100">
              {t("pages.heroCounters.others.title", { lane: t(`lanes.${laneMain}`) })}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {neighbours.map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/heroes/${x.slug}/counters`}
                    className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {t("pages.heroCounters.title", names(x.name))}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * Contres rangs confondus : ecart moyen, nombre de rangs ou l'adversaire
 * figure, et les deux suites naturelles — le face-a-face au comparateur et sa
 * propre page counters.
 */
function AggregatedTable({
  t,
  rows,
  tone,
  total,
  slug,
  gap,
}: {
  t: T;
  rows: AggregatedCounter[];
  tone: "good" | "bad";
  total: number;
  slug: string;
  gap: (v: number) => string;
}) {
  return (
    // Le defilement vit sur un conteneur a part : `bevel` impose son propre
    // `overflow`, et le tableau debordait alors de la page a 390 px. Sur
    // mobile, la colonne des rangs se masque et les liens s'empilent : la
    // ligne tient sans defiler.
    <div className="bevel border border-night-700/70 bg-night-900/60 p-3">
      <div className="relative overflow-x-auto">
      {/*
        Le nom est l'en-tete de sa ligne : « Comparer » et « Counters » en
        tirent leur contexte, sans aria-label repete sur chaque lien.
      */}
      <table
        className={cn(
          "w-full text-sm [&_tbody_th]:py-1.5 [&_tbody_th]:text-left [&_tbody_th]:font-normal [&_td]:py-1.5 [&_td]:pl-3",
          "[&_td]:whitespace-nowrap [&_td]:text-right [&_td:last-child]:text-xs [&_td:last-child_a]:text-gold-400",
          "[&_td:last-child_a:hover]:text-gold-500",
        )}
      >
        <thead className="text-xs uppercase tracking-wide text-chalk-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
          <tr>
            <th scope="col" className="text-left">{t("pages.heroCounters.colHero")}</th>
            <th scope="col">{t("pages.heroCounters.colGap")}</th>
            <th scope="col" className="max-sm:hidden">{t("pages.heroCounters.colRanks")}</th>
            <th scope="col"><span className="sr-only">{t("pages.heroCounters.colLinks")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night-800">
          {rows.map((c) => (
            <tr key={c.slug}>
              <th scope="row">
                <Link href={`/heroes/${c.slug}`} className="flex min-w-0 items-center gap-2.5 text-chalk-100 hover:text-gold-400">
                  <HeroPortrait source={portraitOf(c.slug)} name={nameOf(c.slug)} size="small" decorative />
                  <span className="truncate">{nameOf(c.slug)}</span>
                </Link>
              </th>
              <td className={cn("font-semibold tabular-nums", tone === "good" ? "text-emerald-400" : "text-blood-500")}>
                {gap(c.average)}
              </td>
              <td className="tabular-nums text-chalk-400 max-sm:hidden">
                {t("pages.heroCounters.ranksListed", { n: c.ranks, total })}
              </td>
              <td>
                <Link href={pathPair(slug, c.slug)} className="max-sm:block">
                  {t("pages.heroDetail.compare")}
                </Link>
                <span aria-hidden className="max-sm:hidden"> · </span>
                <Link href={`/heroes/${c.slug}/counters`} className="max-sm:block">
                  {t("pages.heroCounters.shortLink")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/**
 * Style des listes de rang, pose une fois sur leur conteneur : cent lignes par
 * page, et pas une classe sur les cellules. La couleur du tableau donne celle
 * de l'ecart ; noms et liens reprennent la leur.
 */
const STYLE_TABLES_RANK = cn(
  "[&_table]:mt-2 [&_table]:w-full [&_table]:text-sm [&_tbody_th]:py-1 [&_tbody_th]:text-left [&_tbody_th]:font-normal",
  "[&_td]:py-1 [&_td]:pl-2 [&_td]:text-right [&_td]:whitespace-nowrap [&_td:nth-of-type(1)]:font-semibold",
  "[&_td:nth-of-type(1)]:tabular-nums [&_th_a]:text-chalk-100 [&_td:nth-of-type(2)_a]:text-xs",
  "[&_td:nth-of-type(2)_a]:text-gold-400 [&_a:hover]:text-gold-400",
);

/**
 * Une liste d'un rang : adversaires ou coequipiers, ecart en points. Sans
 * portrait : six rangs de dix-huit lignes en porteraient plus d'une centaine,
 * soit la moitie du poids de la page. Les portraits restent sur les tableaux
 * de synthese, en tete.
 */
function TableRank({
  t,
  title,
  icon,
  tone,
  rows,
  gap,
  pageCounters = true,
}: {
  t: T;
  title: string;
  icon: React.ReactNode;
  tone: "good" | "bad";
  rows: CounterFigure[];
  gap: (v: number) => string;
  /** Lien vers la page counters de chaque heros ; sans objet pour des coequipiers. */
  pageCounters?: boolean;
}) {
  if (rows.length === 0) return null;
  const color = tone === "good" ? "text-emerald-400" : "text-blood-500";
  return (
    <div>
      <h4 className={cn("flex items-center gap-2 font-heading font-bold", color)}>
        {icon}
        {title}
      </h4>
      <table className={color}>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t("pages.heroCounters.colHero")}</th>
            <th scope="col">{t("pages.heroCounters.colGap")}</th>
            {pageCounters && <th scope="col">{t("pages.heroCounters.colLinks")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const name = nameOf(e.slug);
            return (
              // Nom en en-tete de ligne : le lien « Counters » y prend son contexte.
              <tr key={e.slug}>
                <th scope="row">
                  <Link href={`/heroes/${e.slug}`}>{name}</Link>
                </th>
                <td>{gap(e.advantage)}</td>
                {pageCounters && (
                  <td>
                    <Link href={`/heroes/${e.slug}/counters`}>{t("pages.heroCounters.shortLink")}</Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Taux de victoire par duree de partie, en barres : la tranche la plus faible en rouge, la plus forte en vert. */
function DurationBars({
  buckets,
  moments,
  nameBucket,
  locale,
}: {
  buckets: BucketDuration[];
  moments: { weak: BucketDuration; strong: BucketDuration };
  nameBucket: (x: BucketDuration) => string;
  locale: Locale;
}) {
  // Echelle resserree sur l'etendue mesuree : quelques points d'ecart restent
  // visibles, ce qu'une echelle de 0 a 100 % ecraserait.
  const bottom = moments.weak.winRate - 0.5;
  const extent = moments.strong.winRate - bottom || 1;
  return (
    <ul className="mt-4 space-y-1.5 text-xs">
      {buckets.map((x) => (
        <li key={x.from} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2">
          <span className="text-chalk-400">{nameBucket(x)}</span>
          <span aria-hidden className="h-2 bg-night-800">
            <span
              className={cn(
                "block h-full",
                x === moments.weak ? "bg-blood-500" : x === moments.strong ? "bg-emerald-400" : "bg-azure-500",
              )}
              style={{ width: `${Math.round(15 + (85 * (x.winRate - bottom)) / extent)}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-chalk-300">{percentage(locale, x.winRate)}</span>
        </li>
      ))}
    </ul>
  );
}
