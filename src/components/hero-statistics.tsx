"use client";

import { useState } from "react";
import { DurationBars } from "@/components/duration-bars";
import { RateCurve, type PointCurve, type Marker } from "@/components/rate-curve";
import { FilterGroup, Chip } from "@/components/chip";
import { useRank } from "@/components/rank-picker";
import { useLocale, useT } from "@/i18n/provider";
import { profileDuration } from "@/lib/composition";
import type { SeriesRate, BucketDuration } from "@/lib/evolution";
import { MEASURED_RANKS, type MeasuredRank } from "@/lib/measured-ranks";
import {
  formatGap,
  heroImpacts,
  DAYS_IMPACT,
  MEASURES_MIN_IMPACT,
  pointsOf as pointsDates,
  THRESHOLD_IMPACT,
} from "@/lib/trends";
import type { AdjustmentType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Measure = "win" | "ban" | "pick";
const MEASURES: Measure[] = ["win", "ban", "pick"];
/** Champ de la serie correspondant a chaque mesure affichee. */
const FIELD: Record<Measure, "winRate" | "banRate" | "pickRate"> = {
  win: "winRate",
  ban: "banRate",
  pick: "pickRate",
};
const PERIODS = [7, 15, 30];

/** Une serie alignee, jour par jour. */
const pointsOf = (series: SeriesRate, measure: Measure): PointCurve[] => pointsDates(series.start, series[FIELD[measure]]);

const measured = (points: PointCurve[]) => points.flatMap((p) => (p.value === null ? [] : [p.value]));

/**
 * Statistiques d'un heros dans le temps : taux quotidiens sur trente jours,
 * taux de victoire selon la duree de partie, comparaison des rangs et
 * historique long. Tout suit le rang choisi en haut de la fiche ; les donnees
 * arrivent avec la page, sans requete au changement de rang.
 */
export function HeroStatistics({
  name,
  trends,
  duration,
  history,
  patches,
  byRank,
  adjustments = [],
}: {
  name: string;
  trends: Partial<Record<MeasuredRank, SeriesRate>>;
  duration: Partial<Record<MeasuredRank, BucketDuration[]>>;
  history: SeriesRate | null;
  patches: { version: string; date: string }[];
  byRank: Partial<Record<MeasuredRank, { winRate: number; banRate: number }>>;
  /** Patchs qui ont touche le heros, pour en mesurer l'effet. */
  adjustments?: { version: string; type: AdjustmentType | null }[];
}) {
  const t = useT();
  const locale = useLocale();
  const rank = useRank();
  const [measure, setMeasure] = useState<Measure>("win");
  const [period, setPeriod] = useState(30);

  const series = trends[rank] ?? trends.all;
  const buckets = duration[rank] ?? duration.all;
  const ranks = MEASURED_RANKS.filter((r) => byRank[r]);
  const markers: Marker[] = patches.map((p) => ({ date: p.date, label: p.version }));
  const decimals = measure === "pick" ? 2 : 1;
  const count = (v: number, d = 1) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

  if (!series && !buckets && ranks.length < 2) {
    return <p className="text-sm text-chalk-500">{t("pages.heroDetail.statistics.noData")}</p>;
  }

  const points = series ? pointsOf(series, measure).slice(-period) : [];
  const values = measured(points);
  const start = values[0];
  const end = values.at(-1);
  const long = history && history.winRate.length > 31 ? pointsOf(history, "win") : null;

  return (
    <div className="space-y-12">
      {series && values.length > 1 && (
        <section>
          <h3 className="font-heading text-lg font-bold text-chalk-100">
            {t("pages.heroDetail.statistics.trend", { n: period })}
          </h3>
          <p className="mt-1 text-sm text-chalk-500">{t("pages.heroDetail.statistics.trendIntro")}</p>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            <FilterGroup legend={t("pages.heroDetail.statistics.measure")} widthLegend="">
              {MEASURES.map((m) => (
                <Chip key={m} dense active={m === measure} onClick={() => setMeasure(m)}>
                  {t(`pages.heroDetail.statistics.measures.${m}`)}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup legend={t("pages.heroDetail.statistics.period")} widthLegend="">
              {PERIODS.map((p) => (
                <Chip key={p} dense active={p === period} onClick={() => setPeriod(p)}>
                  {t("pages.heroDetail.statistics.days", { n: p })}
                </Chip>
              ))}
            </FilterGroup>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t("pages.heroDetail.statistics.current"), `${count(end!, decimals)} %`, null],
              [
                t("pages.heroDetail.statistics.change"),
                `${end! - start! > 0 ? "+" : ""}${count(end! - start!, decimals)} ${t("counters.pts")}`,
                measure === "win" ? Math.sign(end! - start!) : 0,
              ],
              [t("pages.heroDetail.statistics.min"), `${count(Math.min(...values), decimals)} %`, null],
              [t("pages.heroDetail.statistics.max"), `${count(Math.max(...values), decimals)} %`, null],
            ].map(([label, value, sign]) => (
              <div key={String(label)} className="bevel-sm border border-night-700/70 bg-night-900/60 px-3 py-2">
                <dt className="text-[0.7rem] uppercase tracking-wide text-chalk-500">{label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 font-semibold tabular-nums text-chalk-100",
                    sign === 1 && "text-emerald-400",
                    sign === -1 && "text-blood-500",
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="bevel mt-4 border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
            <RateCurve
              points={points}
              markers={markers}
              decimals={decimals}
              label={t("pages.heroDetail.statistics.curveSummary", {
                mesure: t(`pages.heroDetail.statistics.measures.${measure}`),
                debut: count(start!, decimals),
                fin: count(end!, decimals),
              })}
            />
          </div>
          {!long && <p className="mt-2 text-xs leading-relaxed text-chalk-500">{t("pages.heroDetail.statistics.historyShort")}</p>}
        </section>
      )}

      {buckets && buckets.length > 1 && <Duration name={name} buckets={buckets} count={count} />}

      {ranks.length > 1 && (
        <section>
          <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroDetail.statistics.byRank")}</h3>
          <p className="mt-1 text-sm text-chalk-500">{t("pages.heroDetail.statistics.byRankIntro")}</p>
          <ul className="mt-4 space-y-2.5">
            {(() => {
              const rate = ranks.map((r) => byRank[r]!.winRate);
              const bottom = Math.min(...rate) - 1;
              const top = Math.max(...rate) + 0.5;
              return ranks.map((r) => {
                const s = byRank[r]!;
                return (
                  <li key={r} className="flex items-center gap-3 text-sm">
                    <span className={cn("w-28 shrink-0", r === rank ? "font-semibold text-gold-400" : "text-chalk-300")}>
                      {t(`measuredRanks.${r}`)}
                    </span>
                    <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-night-800">
                      <span
                        className={cn("block h-full rounded-full", r === rank ? "bg-gold-500" : "bg-chalk-500/50")}
                        style={{ width: `${((s.winRate - bottom) / (top - bottom)) * 100}%` }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right tabular-nums text-chalk-100">{count(s.winRate)} %</span>
                    <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-chalk-500 sm:block">
                      {t("pages.heroDetail.statistics.banShort", { v: count(s.banRate) })}
                    </span>
                  </li>
                );
              });
            })()}
          </ul>
        </section>
      )}

      {long && history && (
        <section>
          <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroDetail.statistics.history")}</h3>
          <p className="mt-1 text-sm text-chalk-500">
            {t("pages.heroDetail.statistics.historyIntro", {
              date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
                new Date(`${history.start}T00:00:00Z`),
              ),
            })}
          </p>
          <div className="bevel mt-4 border border-night-700/70 bg-night-900/60 p-3 sm:p-4">
            <RateCurve
              points={long}
              markers={markers}
              label={t("pages.heroDetail.statistics.history")}
            />
          </div>
        </section>
      )}

      <EffectPatchs name={name} history={history} adjustments={adjustments} patches={patches} count={count} />
    </div>
  );
}

const COLOR_TYPE: Record<AdjustmentType, string> = {
  buff: "border-emerald-500/30 text-emerald-400",
  nerf: "border-blood-500/30 text-blood-500",
  adjust: "border-azure-500/30 text-azure-400",
};

/**
 * Effet de chaque patch sur le taux de victoire : moyenne des sept jours
 * d'avant contre celle des sept jours d'apres, et verdict (« le nerf a-t-il
 * porte ? »). Tant que l'historique ne couvre pas un patch des deux cotes, un
 * message le dit plutot qu'un bloc vide ; sans patch date, rien.
 */
function EffectPatchs({
  name,
  history,
  adjustments,
  patches,
  count,
}: {
  name: string;
  history: SeriesRate | null;
  adjustments: { version: string; type: AdjustmentType | null }[];
  patches: { version: string; date: string }[];
  count: (v: number) => string;
}) {
  const t = useT();
  const locale = useLocale();
  const dateOf = new Map(patches.map((p) => [p.version, p.date]));
  const dates = adjustments.flatMap((a) => (dateOf.has(a.version) ? [{ ...a, date: dateOf.get(a.version)! }] : []));
  if (dates.length === 0) return null;
  const impacts = heroImpacts(history, dates);

  return (
    <section>
      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroDetail.statistics.impact.title")}</h3>
      <p className="mt-1 text-sm text-chalk-500">
        {t("pages.heroDetail.statistics.impact.intro", { nom: name, n: DAYS_IMPACT })}
      </p>

      {impacts.length === 0 ? (
        <p className="bevel-sm mt-4 border border-dashed border-night-700 px-4 py-3 text-sm leading-relaxed text-chalk-500">
          {history
            ? t("pages.heroDetail.statistics.impact.empty", {
                n: MEASURES_MIN_IMPACT,
                date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
                  new Date(`${history.start}T00:00:00Z`),
                ),
              })
            : t("pages.heroDetail.statistics.impact.emptyNoHistory", { nom: name })}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {impacts.map((i, k) => {
            const sign = Math.abs(i.gap) < THRESHOLD_IMPACT - 1e-9 ? 0 : Math.sign(i.gap);
            return (
              <li
                key={`${i.version}-${k}`}
                className="bevel-sm flex flex-wrap items-center gap-x-4 gap-y-1 border border-night-700/70 bg-night-900/60 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-chalk-100">
                  {t("pages.heroDetail.statistics.impact.patch", { version: i.version })}
                </span>
                {i.type && (
                  <span className={cn("bevel-sm border px-1.5 py-0.5 text-[0.7rem]", COLOR_TYPE[i.type])}>
                    {t(`patchHeroes.${i.type}`)}
                  </span>
                )}
                <span className="tabular-nums text-chalk-300">
                  <span aria-hidden>
                    {count(i.before)} % → {count(i.after)} %
                  </span>
                  <span className="sr-only">
                    {t("pages.heroDetail.statistics.impact.beforeAfter", {
                      avant: count(i.before),
                      apres: count(i.after),
                    })}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    sign === 1 ? "text-emerald-400" : sign === -1 ? "text-blood-500" : "text-chalk-100",
                  )}
                >
                  {formatGap(i.gap, locale)} {t("counters.pts")}
                </span>
                {i.verdict && (
                  <span className="text-xs text-chalk-500">
                    {t(`pages.heroDetail.statistics.impact.verdict.${i.verdict}`)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Taux de victoire par duree de partie : dit si le heros pese en debut ou en
 * fin de partie, mieux qu'une etiquette « early » ou « late » posee a la main.
 */
function Duration({
  name,
  buckets,
  count,
}: {
  name: string;
  buckets: BucketDuration[];
  count: (v: number) => string;
}) {
  const t = useT();
  const rate = buckets.map((x) => x.winRate);
  const best = rate.indexOf(Math.max(...rate));
  const label = (x: Pick<BucketDuration, "from" | "to">) =>
    x.to === null
      ? t("pages.heroDetail.statistics.minutesPlus", { de: x.from })
      : t("pages.heroDetail.statistics.minutes", { de: x.from, a: x.to });

  return (
    <section>
      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroDetail.statistics.duration")}</h3>
      <p className="mt-1 text-sm text-chalk-500">{t("pages.heroDetail.statistics.durationIntro", { nom: name })}</p>
      <p className="mt-3 text-sm text-chalk-300">
        <span className="font-semibold text-gold-400">
          {t(`pages.heroDetail.statistics.profile.${profileDuration(rate)}`)}
        </span>
        {" · "}
        {t("pages.heroDetail.statistics.peak", { tranche: label(buckets[best]) })}
      </p>

      <DurationBars buckets={buckets} count={count} label={label} className="mt-4" />
    </section>
  );
}
