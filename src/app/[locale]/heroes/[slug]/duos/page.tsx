import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown, ThumbsDown, Users } from "lucide-react";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { HeroPortrait } from "@/components/hero-portrait";
import { Card, PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { aggregateCounters, frenchOf, formatGap, listNames, summaryRank, type AggregatedCounter } from "@/lib/counters";
import { teammates, allHeroes, heroesBySlug } from "@/lib/data";
import { duosOf, DAYS_DUOS, type Duo } from "@/lib/duos";
import { durationOf, type BucketDuration } from "@/lib/evolution";
import { longDate, dateMeasure, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import { duosAsCounters, bestByPhase, PHASES, phasesDuo, type PhaseDuo } from "@/lib/pairs";
import { MEASURED_RANKS, type MeasuredRank } from "@/lib/measured-ranks";
import { site } from "@/lib/site";
import { rankingFull, statsByRank } from "@/lib/tier-list";
import type { Hero } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Page « duos » d'un heros : avec qui il gagne, rang par rang et selon la
 * duree de partie.
 *
 * Les mesures viennent de la compatibilite publiee par le jeu : la variation
 * de son taux de victoire avec chaque partenaire, et le taux du duo par
 * tranche de duree, rapporte au taux du heros seul a la meme duree. Tout est
 * rendu cote serveur, chaque rang dans son `<details>`.
 */

type Params = { params: Promise<{ locale: Locale; slug: string }> };

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
/** Ecarte un partenaire que le catalogue ne connait pas (synchro partielle). */
const known = <E extends { slug: string }>(list: E[] = []) => list.filter((e) => heroesBySlug.has(e.slug));
const names = (name: string) => ({ nom: name, deNom: frenchOf(name) });
const contextOf = (t: T, rank: MeasuredRank) =>
  rank === "all" ? t("pages.duos.allRanks") : t("pages.duos.atRank", { rang: t(`measuredRanks.${rank}`) });

/** « Marcel (+1,1 pts), Grock et Akai » : le premier porte son ecart, les suivants leur nom. */
function head(locale: Locale, t: T, list: Duo[]) {
  const [first, ...run] = list;
  return listNames(locale, [
    `${nameOf(first.slug)} (${formatGap(locale, t, first.advantage)})`,
    ...run.map((e) => nameOf(e.slug)),
  ]);
}

/** Phrase de synthese, commune a la description et au chapeau de la page. */
function summary(locale: Locale, h: Hero) {
  const t = createT(locale);
  const byRank = duosOf(h.slug);
  const rank = summaryRank(duosAsCounters(byRank));
  const best = known(rank ? byRank[rank]?.best : []).slice(0, 3);
  if (!rank || best.length === 0) return { rank, sentence: t("pages.duos.noMeasure", { nom: h.name }) };
  const worst = known(byRank[rank]?.worst).slice(0, 2);
  const variables = { contexte: contextOf(t, rank), nom: h.name, meilleurs: head(locale, t, best) };
  return {
    rank,
    sentence:
      worst.length > 0
        ? t("pages.duos.overview", { ...variables, pires: head(locale, t, worst) })
        : t("pages.duos.overviewNoWorst", variables),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) return {};
  const t = createT(locale);
  const meta = metaPage(locale, {
    // Patch dans le titre, comme les pages counters : les resultats qui menent
    // sur « best duo » portent une date ou une version.
    title: patchCurrent
      ? t("pages.duos.metaTitle", { ...names(h.name), v: patchCurrent.version })
      : t("pages.duos.metaTitleNoPatch", names(h.name)),
    description: `${summary(locale, h).sentence} ${t("pages.duos.updatedOn", { date: longDate(locale) })}`,
    path: `/heroes/${slug}/duos`,
    type: "article",
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
  // Sans duo ni coequipier mesure, la page n'apprend rien : hors de l'index, liens suivis.
  const measure = Object.keys(duosOf(slug)).length > 0 || Object.keys(teammates[slug] ?? {}).length > 0;
  return measure ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function DuosPage({ params }: Params) {
  const { locale, slug } = await params;
  const h = heroesBySlug.get(slug);
  if (!h) notFound();

  const t = createT(locale);
  const n = names(h.name);
  const gap = (v: number) => formatGap(locale, t, v);

  const byRank = duosOf(slug);
  const { rank: rankMain, sentence } = summary(locale, h);
  const asCounters = duosAsCounters(byRank);
  const ranks = MEASURED_RANKS.filter((r) => byRank[r]);
  // Tranches lues pour l'agregat : `all` ne compte qu'a defaut de tranche.
  const bucketsMeasured = MEASURED_RANKS.filter((r) => r !== "all" && byRank[r]).length || (byRank.all ? 1 : 0);
  const best = known(aggregateCounters(asCounters, "strong")).slice(0, 8);
  const worst = known(aggregateCounters(asCounters, "weak")).slice(0, 6);
  const first = best[0]?.slug;
  const stats = statsByRank(slug);

  // Phases : au rang de la synthese, contre la courbe de duree du heros seul au meme rang.
  const durations = durationOf(slug);
  const bucketsAlone = rankMain ? durations[rankMain] : undefined;
  const mainDuos = rankMain ? known(byRank[rankMain]?.best) : [];
  const byPhase = bestByPhase(mainDuos, bucketsAlone);
  const withGain = byPhase.some((p) => p.gain !== null);

  // Repli : sans duo mesure, les coequipiers releves par l'academie.
  const academy = ranks.length === 0 ? MEASURED_RANKS.filter((r) => known(teammates[slug]?.[r]).length > 0) : [];

  // Pages duos des heros de la meme position, les mieux classes d'abord.
  const laneMain = h.lanes[0];
  const neighbours = laneMain
    ? rankingFull
        .filter((e) => e.hero.slug !== slug && e.hero.lanes.includes(laneMain))
        .slice(0, 12)
        .map((e) => e.hero)
    : [];

  const links = [
    { href: `/heroes/${slug}`, label: t("pages.duos.sheetLink", n) },
    { href: `/heroes/${slug}/counters`, label: t("pages.duos.countersLink", n) },
    ...(first
      ? [
          { href: `/compare?a=${slug}&b=${first}`, label: t("pages.duos.compareLink", { nom: h.name, autre: nameOf(first) }) },
          { href: `/heroes/${first}/duos`, label: t("pages.duos.title", names(nameOf(first))) },
        ]
      : []),
  ];

  const title = t("pages.duos.title", n);
  const address = `${site.url}/${locale}/heroes/${slug}/duos`;
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
        ...(best.length > 0 ? { mainEntity: { "@id": `${address}#duos` } } : {}),
      },
      ...(best.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${address}#duos`,
              name: t("pages.duos.best", n),
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

  const chip =
    "bevel-sm inline-block border border-night-700 px-3 py-1.5 font-medium text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

      <PageHeader
        title={title}
        lead={sentence}
        crumbs={[
          { name: t("nav.heroes.label"), href: "/heroes" },
          { name: h.name, href: `/heroes/${slug}` },
          {
            name: t("pages.duos.crumb"),
            siblings: [...allHeroes]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((x) => ({ name: x.name, href: `/heroes/${x.slug}/duos` })),
          },
        ]}
      >
        <FreshnessLine locale={locale} before={t("pages.duos.window", { n: DAYS_DUOS })} className="mt-4" />
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={chip}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        {/* ── Synthese, rangs confondus ───────────────────────────────── */}
        {(best.length > 0 || worst.length > 0) && (
          <div className="grid gap-8 lg:grid-cols-2">
            {best.length > 0 && (
              <section aria-labelledby="meilleurs" className="min-w-0">
                <h2 id="meilleurs" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.duos.best", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.duos.bestIntro", n)}</p>
                <AggregatedTable t={t} rows={best} tone="good" total={bucketsMeasured} slug={slug} gap={gap} />
              </section>
            )}
            {worst.length > 0 && (
              <section aria-labelledby="pires" className="min-w-0">
                <h2 id="pires" className="font-heading text-2xl font-bold text-chalk-100">
                  {t("pages.duos.worst", n)}
                </h2>
                <p className="mt-2 mb-4 text-sm leading-relaxed text-chalk-500">{t("pages.duos.worstIntro", n)}</p>
                <AggregatedTable t={t} rows={worst} tone="bad" total={bucketsMeasured} slug={slug} gap={gap} />
              </section>
            )}
          </div>
        )}

        {/* ── Selon la duree de partie ────────────────────────────────── */}
        {rankMain && byPhase.length > 0 && (
          <section aria-labelledby="phases">
            <h2 id="phases" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.duos.phases.title", n)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">
              {t(withGain ? "pages.duos.phases.intro" : "pages.duos.phases.introNoGain", {
                ...n,
                rang: t(`measuredRanks.${rankMain}`),
              })}
            </p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {byPhase.map((p) => (
                <li key={p.phase}>
                  <Card className="h-full p-4">
                    <p className="text-xs uppercase tracking-wide text-chalk-500">
                      {t(`pages.duos.phase.${p.phase}`)} · {t(`pages.duos.phaseMinutes.${p.phase}`)}
                    </p>
                    <Link href={`/heroes/${p.slug}`} className="mt-3 flex items-center gap-3 text-chalk-100 hover:text-gold-400">
                      <HeroPortrait source={portraitOf(p.slug)} name={nameOf(p.slug)} size="icon" decorative />
                      <span className="font-heading text-lg font-bold">{nameOf(p.slug)}</span>
                    </Link>
                    <p className="mt-2 text-sm text-chalk-300">
                      {t("pages.duos.phases.duoRate", { taux: percentage(locale, p.win) })}
                      {p.gain !== null && (
                        <>
                          {" · "}
                          <span className={cn("font-semibold tabular-nums", p.gain >= 0 ? "text-emerald-400" : "text-blood-500")}>
                            {t("pages.duos.phases.gainAlone", { ecart: gap(p.gain), nom: h.name })}
                          </span>
                        </>
                      )}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
            <div className="bevel mt-4 relative overflow-x-auto border border-night-700/70 bg-night-900/60 p-3">
              <TablePhases t={t} locale={locale} duos={mainDuos} buckets={bucketsAlone} gap={gap} />
            </div>
          </section>
        )}

        {/* ── Rang par rang ───────────────────────────────────────────── */}
        {ranks.length > 0 && (
          <section aria-labelledby="par-rang">
            <h2 id="par-rang" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.duos.byRank")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">{t("pages.duos.byRankIntro", n)}</p>
            <div className="mt-5 space-y-3">
              {ranks.map((r) => {
                const d = byRank[r]!;
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
                      {(d.winRate ?? s?.winRate) != null && (
                        <span className="text-sm text-chalk-500">
                          {t("pages.duos.rateAlone", { taux: percentage(locale, d.winRate ?? s!.winRate) })}
                        </span>
                      )}
                    </summary>
                    <div className="grid gap-6 border-t border-night-800 p-4 md:grid-cols-[3fr_2fr]">
                      <div className="min-w-0">
                        <h4 className="flex items-center gap-2 font-heading font-bold text-emerald-400">
                          <Users size={16} aria-hidden />
                          {t("pages.duos.bestShort")}
                        </h4>
                        <div className="relative overflow-x-auto">
                          <TablePhases
                            t={t}
                            locale={locale}
                            duos={known(d.best)}
                            buckets={durations[r]}
                            gap={gap}
                            compact
                          />
                        </div>
                      </div>
                      {known(d.worst).length > 0 && (
                        <div className="min-w-0 relative overflow-x-auto">
                          <h4 className="flex items-center gap-2 font-heading font-bold text-blood-500">
                            <ThumbsDown size={16} aria-hidden />
                            {t("pages.duos.worstShort")}
                          </h4>
                          <ListGaps t={t} rows={known(d.worst)} gap={gap} />
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-chalk-500">{t("pages.duos.source", { n: DAYS_DUOS })}</p>
          </section>
        )}

        {/* ── Repli : coequipiers de l'academie ───────────────────────── */}
        {academy.length > 0 && (
          <section aria-labelledby="academie">
            <h2 id="academie" className="font-heading text-2xl font-bold text-chalk-100">
              {t("pages.duos.academy.title", n)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-500">{t("pages.duos.academy.intro", n)}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {academy.map((r) => (
                <Card key={r} className="min-w-0 relative overflow-x-auto p-4">
                  <h3 className="font-heading font-bold text-chalk-100">{t(`measuredRanks.${r}`)}</h3>
                  <ListGaps t={t} rows={known(teammates[slug]?.[r])} gap={gap} />
                </Card>
              ))}
            </div>
          </section>
        )}

        {ranks.length === 0 && academy.length === 0 && (
          <p className="text-sm text-chalk-400">{t("pages.duos.noMeasure", n)}</p>
        )}

        {/* ── Autres pages duos, meme position ────────────────────────── */}
        {neighbours.length > 0 && laneMain && (
          <section aria-labelledby="autres">
            <h2 id="autres" className="font-heading text-xl font-bold text-chalk-100">
              {t("pages.duos.others", { lane: t(`lanes.${laneMain}`) })}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {neighbours.map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/heroes/${x.slug}/duos`}
                    className="bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {t("pages.duos.title", names(x.name))}
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
 * Partenaires rangs confondus : ecart moyen, nombre de rangs ou ils figurent,
 * et les deux suites naturelles — le comparateur et leur propre page duos.
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
  const name = nameOf(slug);
  return (
    <div className="bevel relative overflow-x-auto border border-night-700/70 bg-night-900/60 p-3">
      <table className="w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-3 [&_td+td]:whitespace-nowrap [&_td+td]:text-right">
        <thead className="text-xs uppercase tracking-wide text-chalk-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
          <tr>
            <th scope="col" className="text-left">{t("pages.duos.colPartner")}</th>
            <th scope="col">{t("pages.duos.colGain")}</th>
            <th scope="col">{t("pages.duos.colRanks")}</th>
            <th scope="col"><span className="sr-only">{t("pages.duos.colLinks")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night-800">
          {rows.map((c) => (
            <tr key={c.slug}>
              <td>
                <Link href={`/heroes/${c.slug}`} className="flex min-w-0 items-center gap-2.5 text-chalk-100 hover:text-gold-400">
                  <HeroPortrait source={portraitOf(c.slug)} name={nameOf(c.slug)} size="small" decorative />
                  <span className="truncate">{nameOf(c.slug)}</span>
                </Link>
              </td>
              <td className={cn("font-semibold tabular-nums", tone === "good" ? "text-emerald-400" : "text-blood-500")}>
                {gap(c.average)}
              </td>
              <td className="tabular-nums text-chalk-400">{t("pages.duos.ranksListed", { n: c.ranks, total })}</td>
              <td className="text-xs">
                <Link
                  href={`/compare?a=${slug}&b=${c.slug}`}
                  aria-label={t("pages.duos.compareLink", { nom: name, autre: nameOf(c.slug) })}
                  className="text-gold-400 hover:text-gold-500"
                >
                  {t("pages.duos.compare")}
                </Link>
                {" · "}
                <Link
                  href={`/heroes/${c.slug}/duos`}
                  aria-label={t("pages.duos.title", names(nameOf(c.slug)))}
                  className="text-gold-400 hover:text-gold-500"
                >
                  {t("pages.duos.shortLink")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Partenaires d'un rang et leur effet selon la duree de partie : gain sur le
 * heros seul a la meme duree quand sa courbe est mesuree, sinon le taux du
 * duo. Le style des cellules est pose sur le tableau : moins de classes a
 * repeter dans le HTML.
 */
function TablePhases({
  t,
  locale,
  duos,
  buckets,
  gap,
  compact = false,
}: {
  t: T;
  locale: Locale;
  duos: Duo[];
  buckets: BucketDuration[] | undefined;
  gap: (v: number) => string;
  /** Dans un rang : le gain global en tete, sans portrait. */
  compact?: boolean;
}) {
  if (duos.length === 0) return null;
  const rows = duos.map((d) => ({ d, phases: new Map(phasesDuo(d.phases, buckets).map((p) => [p.phase, p])) }));
  const cell = (p: PhaseDuo | undefined) => {
    if (!p) return "—";
    if (p.gain === null) return percentage(locale, p.win);
    return <span className={p.gain >= 0 ? "text-emerald-400" : "text-blood-500"}>{gap(p.gain)}</span>;
  };
  return (
    <table
      className={cn(
        "mt-2 w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-2 [&_td+td]:text-right [&_td+td]:whitespace-nowrap [&_td+td]:tabular-nums",
        "[&_th]:pb-1.5 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-chalk-500 [&_th+th]:pl-2 [&_th+th]:text-right",
      )}
    >
      <thead>
        <tr>
          <th scope="col" className="text-left">{t("pages.duos.colPartner")}</th>
          {compact && <th scope="col">{t("pages.duos.colGain")}</th>}
          {PHASES.map((p) => (
            <th scope="col" key={p}>
              <abbr title={`${t(`pages.duos.phase.${p}`)} (${t(`pages.duos.phaseMinutes.${p}`)})`} className="no-underline">
                {t(`pages.duos.phaseShort.${p}`)}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-night-800">
        {rows.map(({ d, phases }) => (
          <tr key={d.slug}>
            <td>
              <Link href={`/heroes/${d.slug}`} className="flex min-w-0 items-center gap-2 text-chalk-100 hover:text-gold-400">
                {!compact && <HeroPortrait source={portraitOf(d.slug)} name={nameOf(d.slug)} size="mini" decorative />}
                <span className="truncate">{nameOf(d.slug)}</span>
              </Link>
            </td>
            {compact && <td className="font-semibold text-emerald-400">{gap(d.advantage)}</td>}
            {PHASES.map((p) => (
              <td key={p}>{cell(phases.get(p))}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Liste courte : partenaire et ecart en points, sans phases. */
function ListGaps({ t, rows, gap }: { t: T; rows: { slug: string; advantage: number }[]; gap: (v: number) => string }) {
  if (rows.length === 0) return null;
  return (
    <table className="mt-2 w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-2 [&_td+td]:text-right [&_td+td]:tabular-nums">
      <thead className="sr-only">
        <tr>
          <th scope="col">{t("pages.duos.colPartner")}</th>
          <th scope="col">{t("pages.duos.colGain")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-night-800">
        {rows.map((e) => (
          <tr key={e.slug}>
            <td>
              <Link href={`/heroes/${e.slug}`} className="text-chalk-100 hover:text-gold-400">
                {nameOf(e.slug)}
              </Link>
            </td>
            <td className={cn("font-semibold", e.advantage >= 0 ? "text-emerald-400" : "text-blood-500")}>{gap(e.advantage)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
