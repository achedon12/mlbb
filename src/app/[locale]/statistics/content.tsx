import type { Metadata } from "next";
import Link from "@/components/link";
import { FreshnessLine } from "@/components/freshness";
import { StatisticsTable } from "@/components/statistics-table";
import { PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT, type T } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { trendsOf } from "@/lib/evolution";
import { longDate, dateMeasure, patchCurrent, percentage } from "@/lib/freshness";
import { serializeJsonLd } from "@/lib/html";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { site } from "@/lib/site";
import { pathStatistics, encodeRow, scaleCurve, type RowStat } from "@/lib/statistics-table";
import {
  shiftDate,
  describeGap,
  formatGap,
  movesWeek,
  THRESHOLD_NOTABLE,
  variationWeek,
  type Motion,
} from "@/lib/trends";
import { rankingOfRank, RANKS_CLASSES } from "@/lib/tier-list";
import { cn } from "@/lib/utils";

/**
 * Statistiques des heros d'une tranche de rang : le tableau complet des taux
 * (victoire, ban, selection), leur ecart sur sept jours et leur courbe sur
 * trente. Comme la tier list, chaque rang a sa propre adresse ; la page
 * principale montre tous rangs confondus.
 */

const isMeasured = (v: number | null): v is number => typeof v === "number";

const rowsByRank = new Map<MeasuredRank, RowStat[]>();

/** Lignes du tableau, dans l'ordre du classement ; memorisees, la page et ses metadonnees les partagent. */
function rowsOfRank(rank: MeasuredRank): RowStat[] {
  const already = rowsByRank.get(rank);
  if (already) return already;
  const rows = rankingOfRank(rank).map((e): RowStat => {
    const series = trendsOf(e.hero.slug)[rank];
    const variation = variationWeek(series);
    const measures = series?.winRate.filter(isMeasured) ?? [];
    const curve = series ? scaleCurve(series.winRate) : null;
    return {
      slug: e.hero.slug,
      name: e.hero.name,
      roles: e.hero.roles,
      lanes: e.hero.lanes,
      tier: e.tier,
      score: e.score,
      win: e.winRate,
      ban: e.banRate,
      pick: e.pickRate,
      // Champs absents plutot que nuls : 132 lignes partent au navigateur.
      ...(variation ? { gap: variation.gap, days: variation.days } : {}),
      ...(e.lowSample ? { weak: true as const } : {}),
      ...(curve ? { curve, start: measures[0], end: measures.at(-1) } : {}),
    };
  });
  rowsByRank.set(rank, rows);
  return rows;
}

const firstBy = (rows: RowStat[], key: "win" | "ban" | "pick") =>
  rows.reduce((a, b) => (b[key] > a[key] ? b : a));

/** Jours couverts par les courbes du rang, pour la couverture temporelle du jeu de donnees. */
function period(rank: MeasuredRank, rows: RowStat[]): string | null {
  let start: string | null = null;
  let end: string | null = null;
  for (const l of rows) {
    const s = trendsOf(l.slug)[rank];
    if (!s?.winRate.length) continue;
    const last = shiftDate(s.start, s.winRate.length - 1);
    if (!start || s.start < start) start = s.start;
    if (!end || last > end) end = last;
  }
  return start && end ? `${start}/${end}` : null;
}

function variables(locale: Locale, t: T, rank: MeasuredRank, rows: RowStat[]) {
  const best = firstBy(rows, "win");
  return {
    v: patchCurrent?.version ?? "",
    rang: t(`measuredRanks.${rank}`),
    n: rows.length,
    nom: best.name,
    taux: percentage(locale, best.win),
    date: longDate(locale),
  };
}

export function metaStatistics(locale: Locale, rank: MeasuredRank): Metadata {
  const t = createT(locale);
  const all = rank === "all";
  const v = variables(locale, t, rank, rowsOfRank(rank));
  return metaPage(locale, {
    title: t(all ? "pages.statistics.metaTitle" : "pages.statistics.metaTitleRank", v),
    description: t(all ? "pages.statistics.metaDescription" : "pages.statistics.metaDescriptionRank", v),
    path: pathStatistics(rank),
  });
}

export function Statistics({ locale, rank }: { locale: Locale; rank: MeasuredRank }) {
  const t = createT(locale);
  const all = rank === "all";
  const rows = rowsOfRank(rank);
  const nameRank = t(`measuredRanks.${rank}`);
  const title = all ? t("pages.statistics.title") : t("pages.statistics.titleRank", { rang: nameRank });
  const win = firstBy(rows, "win");
  const ban = firstBy(rows, "ban");
  const pick = firstBy(rows, "pick");
  const { rises, drops } = movesWeek(
    rows.map((l) => ({ slug: l.slug, series: trendsOf(l.slug)[rank] })),
    5,
  );
  const threshold = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(THRESHOLD_NOTABLE);
  const coverage = period(rank, rows);

  // Jeu de donnees plutot que liste : c'est ce que la page publie, et Google
  // Dataset Search l'indexe. La liste ordonnee des heros existe deja sur la
  // tier list du meme rang.
  const data = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: t("pages.statistics.ldName", { rang: nameRank }),
    description: t(all ? "pages.statistics.metaDescription" : "pages.statistics.metaDescriptionRank", variables(locale, t, rank, rows)),
    url: `${site.url}/${locale}${pathStatistics(rank)}`,
    inLanguage: LOCALE_HTML[locale],
    isAccessibleForFree: true,
    dateModified: dateMeasure,
    ...(patchCurrent ? { version: patchCurrent.version } : {}),
    ...(coverage ? { temporalCoverage: coverage } : {}),
    keywords: ["Mobile Legends: Bang Bang", "MLBB", nameRank],
    creator: { "@type": "Organization", name: site.name, url: site.url },
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: { "@type": "Organization", name: "Moonton" } },
    variableMeasured: (["win", "ban", "pick"] as const).map((c) => ({
      "@type": "PropertyValue",
      name: t(`pages.statisticsTable.${c}`),
      unitText: "%",
    })),
    // L'API publique ne sert que le classement tous rangs.
    ...(all
      ? {
          distribution: [
            { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${site.url}/api/v1/rankings` },
          ],
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      <PageHeader
        title={title}
        lead={all ? t("pages.statistics.lead") : t("pages.statistics.leadRank", { rang: nameRank })}
        crumbs={
          all
            ? undefined
            : [
                { name: t("pages.statistics.title"), href: "/statistics" },
                {
                  name: nameRank,
                  siblings: RANKS_CLASSES.map((r) => ({ name: t(`measuredRanks.${r}`), href: pathStatistics(r) })),
                },
              ]
        }
      >
        <FreshnessLine locale={locale} before={t("pages.statistics.measures", { n: rows.length })} className="mt-6" />
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Phrase de donnees : ce que les resultats de recherche reprennent en extrait. */}
        <p className="mb-8 max-w-3xl leading-relaxed text-chalk-300">
          {t("pages.statistics.summary", {
            contexte: all ? t("pages.statistics.contextAll") : t("pages.statistics.contextRank", { rang: nameRank }),
            victoire: win.name,
            tauxVictoire: percentage(locale, win.win),
            ban: ban.name,
            tauxBan: percentage(locale, ban.ban),
            pick: pick.name,
            tauxPick: percentage(locale, pick.pick),
          })}
        </p>

        <StatisticsTable compactes={rows.map(encodeRow)} rank={rank} ranks={RANKS_CLASSES} />

        <section className="mt-12">
          <div className="grid gap-6 md:grid-cols-2">
            <Moves locale={locale} t={t} title={t("pages.statistics.rises")} list={rises} />
            <Moves locale={locale} t={t} title={t("pages.statistics.falls")} list={drops} />
          </div>
          <p className="mt-3 text-xs text-chalk-500">{t("pages.statistics.movementsIntro", { seuil: threshold })}</p>
        </section>

        <details className="bevel mt-10 border border-night-700/70 bg-night-900/60 p-5">
          <summary className="cursor-pointer font-heading font-bold text-gold-400">{t("pages.statistics.reading.title")}</summary>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-chalk-300">
            {(["win", "ban", "pick", "trend", "curve", "tier", "weak"] as const).map((c) => (
              <li key={c}>{t(`pages.statistics.reading.${c}`, { seuil: threshold })}</li>
            ))}
          </ul>
        </details>

        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            href={all ? "/tier-list" : `/tier-list/${rank}`}
            className="font-semibold text-gold-400 underline-offset-4 hover:underline"
          >
            {all ? t("pages.tierList.title") : t("pages.tierList.titleRank", { rang: nameRank })} →
          </Link>
          <span className="text-chalk-500">
            {t("pages.statistics.api")}{" "}
            <Link href="/api-doc" className="font-semibold text-gold-400 underline-offset-4 hover:underline">
              {t("pages.statistics.apiLink")}
            </Link>
          </span>
        </p>
      </div>
    </>
  );
}

function Moves({ locale, t, title, list }: { locale: Locale; t: T; title: string; list: Motion[] }) {
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-5">
      <h2 className="font-heading text-lg font-bold text-chalk-100">{title}</h2>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-chalk-500">{t("pages.statistics.noMovement")}</p>
      ) : (
        <ol className="mt-3 space-y-1.5 text-sm">
          {list.map(({ slug, variation }) => (
            <li key={slug} className="flex items-baseline justify-between gap-3">
              <Link href={`/heroes/${slug}`} className="font-medium text-chalk-100 hover:text-gold-400">
                {heroesBySlug.get(slug)?.name ?? slug}
              </Link>
              <span className="tabular-nums text-chalk-500">
                <span
                  aria-hidden
                  className={cn("font-semibold", variation.gap > 0 ? "text-emerald-400" : "text-blood-500")}
                >
                  {formatGap(variation.gap, locale)}
                </span>
                <span className="sr-only">{describeGap(t, locale, variation.gap, variation.days)}</span>
                {" · "}
                {percentage(locale, variation.current)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
