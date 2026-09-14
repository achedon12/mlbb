import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { HeroPortrait } from "@/components/hero-portrait";
import { SERIES_STYLES, TraitLegend } from "@/components/hero-radar";
import { Card, PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { formatGap, itemsCounter, hasLifesteal } from "@/lib/counters";
import { buildsPlayed, teammates, counters, heroesBySlug, itemsFor } from "@/lib/data";
import { duos } from "@/lib/duos";
import { durationOf } from "@/lib/evolution";
import { longDate, dateMeasure, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { measuredOpponents, pathPair, duelOfReference, duelByRank, readPhases, linksTeam, readPair, phasesDuel, ranksWon, THRESHOLD_BALANCE, type DuelRank } from "@/lib/pairs";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { site } from "@/lib/site";
import { statsByRank } from "@/lib/tier-list";
import type { Hero } from "@/lib/types";
import { cn } from "@/lib/utils";
import { visualItem } from "@/lib/build-visuals";

/**
 * Head-to-head page "{a} vs {b}": who wins the duel, rank by rank.
 *
 * Only pairs with a measured duel get a page — b among a's most marked
 * gaps, or the reverse, at one rank at least —, in alphabetical order
 * of the slugs: the reverse order is not generated and falls on the 404. A
 * plain page, all server components: a few thousand addresses per language.
 */

type Params = { params: Promise<{ locale: Locale; pair: string }> };

// Nearly 3,000 pairs in four languages: generating them at build time would add
// gigabytes for pages visited one at a time. Each one is rendered on its
// first request, then served from the cache for a day; an unmeasured pair
// or one in reverse order still falls on the 404 (`resolve`).
export const dynamicParams = true;
export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

const nameOf = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;

/** The two heroes of a canonical segment, or null. */
function resolve(pair: string): { a: Hero; b: Hero } | null {
  const p = readPair(pair);
  const a = p?.canonical ? heroesBySlug.get(p.a) : undefined;
  const b = p?.canonical ? heroesBySlug.get(p.b) : undefined;
  return a && b ? { a, b } : null;
}

const contextOf = (t: T, rank: MeasuredRank) =>
  rank === "all" ? t("pages.duos.allRanks") : t("pages.duos.atRank", { rang: t(`measuredRanks.${rank}`) });

/** Duel verdict, shared by the description, the standfirst and the FAQ answer. */
function verdict(locale: Locale, a: Hero, b: Hero) {
  const t = createT(locale);
  const duels = duelByRank(counters, a.slug, b.slug);
  const ref = duelOfReference(duels);
  if (!ref) return { duels, ref, sentence: t("pages.versus.noMeasure", { a: a.name, b: b.name }) };
  const points = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const [winner, loser] = ref.advantage >= 0 ? [a, b] : [b, a];
  const context = contextOf(t, ref.rank);
  const head =
    Math.abs(ref.advantage) < THRESHOLD_BALANCE
      ? t("pages.versus.balanced", { contexte: context, a: a.name, b: b.name })
      : t("pages.versus.verdict", {
          contexte: context,
          gagnant: winner.name,
          perdant: loser.name,
          ecart: `${points.format(Math.abs(ref.advantage))} ${t("counters.pts")}`,
        });
  const g = ranksWon(duels);
  const run = g.total > 1 ? ` ${t("pages.versus.ranks", { a: a.name, na: g.a, b: b.name, nb: g.b, total: g.total })}` : "";
  return { duels, ref, sentence: `${head}${run}` };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, pair } = await params;
  const p = resolve(pair);
  if (!p) return {};
  const t = createT(locale);
  const names = { a: p.a.name, b: p.b.name };
  return metaPage(locale, {
    title: patchCurrent ? t("pages.versus.metaTitle", { ...names, v: patchCurrent.version }) : t("pages.versus.metaTitleNoPatch", names),
    description: `${verdict(locale, p.a, p.b).sentence} ${t("pages.duos.updatedOn", { date: longDate(locale) })}`,
    path: pathPair(p.a.slug, p.b.slug),
    type: "article",
  });
}

/** A hero's most played build on its main lane, at the requested rank or all ranks. */
function buildOf(h: Hero, rank: MeasuredRank) {
  const byLane = buildsPlayed[h.slug] ?? {};
  const lane = h.lanes.find((l) => byLane[l]) ?? Object.keys(byLane)[0];
  const build = lane ? (byLane[lane]?.[rank]?.[0] ?? byLane[lane]?.all?.[0]) : undefined;
  return lane && build ? { lane, build } : null;
}

export default async function VersusPage({ params }: Params) {
  const { locale, pair } = await params;
  const p = resolve(pair);
  if (!p) notFound();
  const { a, b } = p;

  const t = createT(locale);
  const gap = (v: number) => formatGap(locale, t, v);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const { duels, ref, sentence } = verdict(locale, a, b);
  const rankRef: MeasuredRank = ref?.rank ?? "all";

  // Win rate by game length: at the verdict's rank when both are measured there.
  const [da, db] = [durationOf(a.slug), durationOf(b.slug)];
  const rankDuration: MeasuredRank | null = da[rankRef] && db[rankRef] ? rankRef : da.all && db.all ? "all" : null;
  const byPhase = rankDuration ? phasesDuel(da[rankDuration], db[rankDuration]) : [];
  const read = readPhases(byPhase);
  const gaps = byPhase.flatMap((x) => (x.gap === null ? [] : [x.gap]));
  const sentenceDuration =
    gaps.length === 0
      ? null
      : gaps.every((e) => e > 0)
        ? t("pages.versus.duration.always", { nom: a.name })
        : gaps.every((e) => e < 0)
          ? t("pages.versus.duration.always", { nom: b.name })
          : read.a && read.b
            ? t("pages.versus.duration.sentence", {
                a: a.name,
                phaseA: t(`pages.versus.phaseIn.${read.a}`),
                b: b.name,
                phaseB: t(`pages.versus.phaseIn.${read.b}`),
              })
            : t("pages.versus.duration.equal", { a: a.name, b: b.name });

  // Profiles at the verdict's rank: tier list rates and in-game ratings.
  const [sa, sb] = [statsByRank(a.slug)[rankRef], statsByRank(b.slug)[rankRef]];

  // Builds: each one's most played, and the items a rule sets against the other.
  const catalog = new Map(itemsFor(locale).map((o) => [o.slug, o]));
  const englishBonus = new Map(itemsFor("en").map((o) => [o.slug, o.bonus]));
  const counterOf = (h: Hero) => {
    const bonus = (buildOf(h, "all")?.build.items ?? []).map((o) => englishBonus.get(visualItem(o).slug ?? "") ?? null);
    return itemsCounter(
      { typeDamage: h.damageType, roles: h.roles, specialties: h.specialties, lifesteal: hasLifesteal(bonus) },
      (s) => catalog.has(s),
    )
      .slice(0, 4)
      .map((c) => catalog.get(c.slug)!);
  };
  const builds = [
    { h: a, other: b, played: buildOf(a, rankRef), counter: counterOf(b) },
    { h: b, other: a, played: buildOf(b, rankRef), counter: counterOf(a) },
  ];

  const team = linksTeam(duos, teammates, a.slug, b.slug);
  const othersOf = (x: Hero, except: Hero) =>
    measuredOpponents(counters, x.slug)
      .filter((e) => e.slug !== except.slug && heroesBySlug.has(e.slug))
      .slice(0, 6);

  const title = t("pages.versus.title", { a: a.name, b: b.name });
  const question = t("pages.versus.question", { a: a.name, b: b.name });
  const path = pathPair(a.slug, b.slug);
  const address = `${site.url}/${locale}${path}`;
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
        author: { "@type": "Person", name: site.author },
        publisher: { "@type": "Organization", name: site.name, url: site.url },
        mainEntityOfPage: address,
        about: [a, b].map((h) => ({ "@type": "Thing", name: h.name, url: `${site.url}/${locale}/heroes/${h.slug}` })),
        isPartOf: {
          "@type": "VideoGame",
          name: "Mobile Legends: Bang Bang",
          publisher: { "@type": "Organization", name: "Moonton" },
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${address}#faq`,
        inLanguage: LOCALE_HTML[locale],
        mainEntity: [{ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: sentence } }],
      },
    ],
  };

  const chip = "bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 hover:text-gold-400";
  const h2 = "font-heading text-2xl font-bold text-chalk-100";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

      <PageHeader
        title={title}
        lead={t("pages.versus.lead", { a: a.name, b: b.name })}
        crumbs={[
          { name: t("pages.compare.title"), href: "/compare" },
          {
            name: title,
            // Sibling pages: the first hero's other measured duels.
            siblings: measuredOpponents(counters, a.slug)
              .filter((e) => heroesBySlug.has(e.slug))
              .slice(0, 20)
              .map((e) => ({ name: t("pages.versus.title", { a: a.name, b: nameOf(e.slug) }), href: pathPair(a.slug, e.slug) }))
              .sort((x, y) => x.name.localeCompare(y.name)),
          },
        ]}
      >
        <FreshnessLine locale={locale} className="mt-4" />
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
        {/* ── The two heroes ─────────────────────────────────────────── */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[
            { h: a, s: sa },
            { h: b, s: sb },
          ].map(({ h, s }, i) => (
            <Link
              key={h.slug}
              href={`/heroes/${h.slug}`}
              className={cn(
                "bevel flex min-w-0 flex-col items-center gap-2 border border-night-700/70 bg-night-900/60 p-3 text-center transition-colors hover:border-gold-500/60",
                i === 1 && "order-3",
              )}
            >
              <HeroPortrait source={h.images.icon ?? h.images.portrait} name={h.name} size="thumb" decorative />
              <span className="font-heading text-lg font-bold text-chalk-100">{h.name}</span>
              {s && (
                <span className="text-xs text-chalk-500">
                  {t("pages.heroDetail.tier", { p: s.tier })} · {percentage(locale, s.winRate)}
                </span>
              )}
              <TraitLegend {...SERIES_STYLES[i]} />
            </Link>
          ))}
          <span aria-hidden className="order-2 font-heading text-xl font-bold text-gold-400">
            VS
          </span>
        </div>

        {/* ── Verdict, rank by rank ─────────────────────────────────── */}
        <section aria-labelledby="verdict">
          <h2 id="verdict" className={h2}>
            {question}
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-chalk-300">{sentence}</p>
          {duels.length > 0 && (
            <div className="bevel mt-5 relative overflow-x-auto border border-night-700/70 bg-night-900/60 p-3">
              <TableDuel t={t} duels={duels} a={a} b={b} gap={gap} />
            </div>
          )}
          <p className="mt-2 text-xs leading-relaxed text-chalk-500">{t("pages.versus.gapsNote", { a: a.name, b: b.name })}</p>
        </section>

        {/* ── Early or late game ───────────────────────────────────── */}
        {rankDuration && sentenceDuration && (
          <section aria-labelledby="duree">
            <h2 id="duree" className={h2}>
              {t("pages.versus.duration.title")}
            </h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-chalk-300">{sentenceDuration}</p>
            <div className="bevel mt-4 relative overflow-x-auto border border-night-700/70 bg-night-900/60 p-3">
              <table className="w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-3 [&_td+td]:text-right [&_td+td]:tabular-nums [&_th+th]:pl-3 [&_th+th]:text-right">
                <thead className="text-xs uppercase tracking-wide text-chalk-500 [&_th]:pb-2 [&_th]:font-medium">
                  <tr>
                    <th scope="col" className="text-left">{t("pages.versus.duration.colPhase")}</th>
                    <th scope="col">{a.name}</th>
                    <th scope="col">{b.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-night-800">
                  {byPhase.map((x) => (
                    <tr key={x.phase}>
                      <th scope="row" className="py-1.5 text-left font-normal text-chalk-300">
                        {t(`pages.duos.phase.${x.phase}`)}{" "}
                        <span className="text-xs text-chalk-500">({t(`pages.duos.phaseMinutes.${x.phase}`)})</span>
                      </th>
                      {[x.a, x.b].map((v, k) => {
                        const head = x.gap !== null && (k === 0 ? x.gap > 0 : x.gap < 0);
                        return (
                          <td key={k} className={cn("font-semibold", head ? "text-gold-400" : "text-chalk-300")}>
                            {v === null ? "—" : percentage(locale, v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-chalk-500">
              {t("pages.versus.duration.rating", { rang: t(`measuredRanks.${rankDuration}`) })}
            </p>
          </section>
        )}

        {/* ── Profiles ─────────────────────────────────────────────── */}
        {/* Table only, no radar: the page stays light, and the radar lives in the comparator. */}
        <section aria-labelledby="profils">
          <h2 id="profils" className={h2}>
            {t("pages.versus.profiles", { rang: t(`measuredRanks.${rankRef}`) })}
          </h2>
          <div className="mt-4 max-w-xl">
            <div className="bevel relative overflow-x-auto border border-night-700/70 bg-night-900/60 p-3">
              <table className="w-full text-sm [&_td]:py-1.5 [&_td]:pl-3 [&_td]:text-right [&_td]:tabular-nums [&_td]:text-chalk-200">
                <thead className="text-xs uppercase tracking-wide text-chalk-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
                  <tr>
                    <th scope="col" className="text-left">
                      <span className="sr-only">{t("compareUI.criterion")}</span>
                    </th>
                    <th scope="col">{a.name}</th>
                    <th scope="col">{b.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-night-800 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-chalk-500">
                  <tr>
                    <th scope="row">{t("compareUI.winRate")}</th>
                    <td>{sa ? percentage(locale, sa.winRate) : "—"}</td>
                    <td>{sb ? percentage(locale, sb.winRate) : "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compareUI.banRate")}</th>
                    <td>{sa ? percentage(locale, sa.banRate) : "—"}</td>
                    <td>{sb ? percentage(locale, sb.banRate) : "—"}</td>
                  </tr>
                  {(
                    [
                      ["offense", "offense"],
                      ["durability", "durability"],
                      ["abilityEffects", "abilityEffects"],
                      ["difficulty", "difficulty"],
                    ] as const
                  ).map(([label, field]) => (
                    <tr key={field}>
                      <th scope="row">{t(`compareUI.${label}`)}</th>
                      <td>{a.ratings[field] ?? "—"}</td>
                      <td>{b.ratings[field] ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Builds ───────────────────────────────────────────────── */}
        {builds.some((x) => x.played || x.counter.length > 0) && (
          <section aria-labelledby="builds">
            <h2 id="builds" className={h2}>
              {t("pages.versus.builds.title")}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {builds.map(({ h, other, played, counter }) => (
                <Card key={h.slug} className="p-4">
                  <h3 className="font-heading text-lg font-bold text-chalk-100">{h.name}</h3>
                  {played && (
                    <>
                      <p className="mt-2 text-xs uppercase tracking-wide text-chalk-500">
                        {t("pages.versus.builds.played", { lane: t(`lanes.${played.lane}`) })}
                      </p>
                      <ItemList
                        items={played.build.items.map((name) => {
                          const slugItem = visualItem(name).slug;
                          return { name: (slugItem && catalog.get(slugItem)?.name) || name, slug: slugItem };
                        })}
                      />
                      {(played.build.emblem || played.build.spell) && (
                        <p className="mt-2 text-xs text-chalk-400">
                          {[played.build.emblem, played.build.spell].filter(Boolean).join(" · ")}
                          {played.build.winRate != null && ` · ${t("builds.win", { taux: decimal.format(played.build.winRate) })}`}
                        </p>
                      )}
                    </>
                  )}
                  {counter.length > 0 && (
                    <>
                      <p className="mt-4 text-xs uppercase tracking-wide text-chalk-500">
                        {t("pages.versus.builds.against", { nom: other.name })}{" "}
                        <span className="normal-case tracking-normal">· {t("pages.versus.builds.rule")}</span>
                      </p>
                      <ItemList items={counter.map((o) => ({ name: o.name, slug: o.slug }))} />
                    </>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── On the same team ─────────────────────────────────────── */}
        {team.length > 0 && (
          <section aria-labelledby="equipe">
            <h2 id="equipe" className={h2}>
              {t("pages.versus.team.title", { a: a.name, b: b.name })}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-chalk-300">
              {team.map((e) => (
                <li key={`${e.rank}-${e.de}`}>
                  {t("pages.versus.team.row", {
                    contexte: contextOf(t, e.rank),
                    de: nameOf(e.de),
                    avec: nameOf(e.partner),
                    ecart: gap(e.advantage),
                  })}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-chalk-500">{t("pages.versus.team.rating")}</p>
          </section>
        )}

        {/* ── Going further ────────────────────────────────────────── */}
        <section aria-labelledby="liens">
          <h2 id="liens" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.versus.links.title")}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            <li>
              <Link href={`/compare?a=${a.slug}&b=${b.slug}`} className={chip}>
                {t("pages.versus.links.comparator")}
              </Link>
            </li>
            {[a, b].flatMap((h) => [
              <li key={`${h.slug}-fiche`}>
                <Link href={`/heroes/${h.slug}`} className={chip}>
                  {t("pages.duos.sheetLink", { nom: h.name })}
                </Link>
              </li>,
              <li key={`${h.slug}-contres`}>
                <Link href={`/heroes/${h.slug}/counters`} className={chip}>
                  {t("pages.duos.countersLink", { nom: h.name })}
                </Link>
              </li>,
              <li key={`${h.slug}-duos`}>
                <Link href={`/heroes/${h.slug}/duos`} className={chip}>
                  {t("pages.duos.title", { nom: h.name })}
                </Link>
              </li>,
            ])}
          </ul>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {[
              { h: a, others: othersOf(a, b) },
              { h: b, others: othersOf(b, a) },
            ].map(({ h, others }) =>
              others.length > 0 ? (
                <div key={h.slug}>
                  <h3 className="text-sm font-semibold text-chalk-100">{t("pages.versus.links.others", { nom: h.name })}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                    {others.map((e) => (
                      <li key={e.slug}>
                        <Link href={pathPair(h.slug, e.slug)} className={chip}>
                          {t("pages.versus.title", { a: h.name, b: nameOf(e.slug) })}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </section>
      </div>
    </>
  );
}

/** Duel gaps by rank: the net advantage, then what each one loses or gains against the other. */
function TableDuel({
  t,
  duels,
  a,
  b,
  gap,
}: {
  t: T;
  duels: DuelRank[];
  a: Hero;
  b: Hero;
  gap: (v: number) => string;
}) {
  const value = (v: number | null) =>
    v === null ? "—" : <span className={v >= 0 ? "text-emerald-400" : "text-blood-500"}>{gap(v)}</span>;
  return (
    <table className="w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-3 [&_td+td]:text-right [&_td+td]:whitespace-nowrap [&_td+td]:tabular-nums">
      <thead className="text-xs uppercase tracking-wide text-chalk-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
        <tr>
          <th scope="col" className="text-left">{t("pages.versus.colRank")}</th>
          <th scope="col">{t("pages.versus.colAdvantage")}</th>
          <th scope="col">{t("pages.versus.colAgainst", { de: a.name, face: b.name })}</th>
          <th scope="col">{t("pages.versus.colAgainst", { de: b.name, face: a.name })}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-night-800">
        {duels.map((d) => {
          const balance = Math.abs(d.advantage) < THRESHOLD_BALANCE;
          return (
            <tr key={d.rank}>
              <td className="text-chalk-300">{t(`measuredRanks.${d.rank}`)}</td>
              <td className="font-semibold">
                {balance ? (
                  <span className="text-chalk-400">{t("pages.versus.balancedShort")}</span>
                ) : (
                  <span className="text-gold-400">
                    {(d.advantage > 0 ? a : b).name} {gap(Math.abs(d.advantage))}
                  </span>
                )}
              </td>
              <td>{value(d.aAgainstB)}</td>
              <td>{value(d.bAgainstA)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Items inline, by name, linked to the catalog when the item is listed.
 * No icon: thousands of head-to-head pages, each one must stay light.
 */
function ItemList({ items: list }: { items: { name: string; slug: string | null }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5 text-sm text-chalk-100 [&_a]:hover:text-gold-400 [&_li]:border [&_li]:border-night-700 [&_li]:px-2 [&_li]:py-0.5">
      {list.map((o, i) => (
        <li key={`${o.name}-${i}`} className="bevel-sm">
          {o.slug ? <Link href={`/items#${o.slug}`}>{o.name}</Link> : o.name}
        </li>
      ))}
    </ul>
  );
}
