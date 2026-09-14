"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Link2, Plus, RotateCcw, X } from "lucide-react";
import { DurationBars } from "@/components/duration-bars";
import { CardSuggestion, HeroSelector, HeroThumb } from "@/components/hero-picker";
import Link from "@/components/link";
import { ChoiceRank } from "@/components/rank-picker";
import { Card, Gauge } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import type { T } from "@/i18n/t";
import {
  analyzeTeam,
  writeSettings,
  readSettings,
  MIN_ALERTS,
  NOTES,
  SIZE_TEAM,
  type Alert,
  type Analysis,
  type TeamHero,
  type MeasuresRank,
  type Bucket,
  type TypeDamage,
} from "@/lib/composition";
import { LANES, ROLES } from "@/lib/draft";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { formatGap } from "@/lib/trends";
import type { Lane, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Team composition analysis.
 *
 * Up to five heroes, with no fixed position; all computation comes from
 * `lib/composition`. The catalogue ships with the page, the chosen rank's
 * measures separately (`/composition/<rang>.json`), once per visit. Team and
 * rank go through the URL (`?h=…&rang=…`), read after mount: the page stays
 * static, and a composition is shared by its link.
 */

/** Requests already started, per rank: coming back to a rank reloads nothing. */
const requests = new Map<MeasuredRank, Promise<MeasuresRank>>();

function loadMeasures(rank: MeasuredRank): Promise<MeasuresRank> {
  let request = requests.get(rank);
  if (!request) {
    request = fetch(`/composition/${rank}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<MeasuresRank>;
    });
    // A failure is not cached: coming back to the rank retries.
    request.catch(() => requests.delete(rank));
    requests.set(rank, request);
  }
  return request;
}

/** Numbers in the page's language. */
interface Formats {
  /** One decimal: rates, averages. */
  count: (v: number) => string;
  integer: (v: number) => string;
  /** Signed gap, in points. */
  gap: (v: number) => string;
}

const heading3 = "font-heading text-lg font-bold text-chalk-100";
const heading = "text-xs uppercase tracking-wide text-chalk-500";

export function TeamAnalysis({
  heroes,
  ranks,
  labelsDamage,
}: {
  heroes: TeamHero[];
  ranks: MeasuredRank[];
  /** Damage type labels, resolved by the server (`heroData` is not sent to the browser). */
  labelsDamage: Record<TypeDamage, string>;
}) {
  const t = useT();
  const siteLocale = useLocale();
  const [slugs, setSlugs] = useState<string[]>([]);
  const [rank, setRank] = useState<MeasuredRank>("all");
  const [open, setOpen] = useState(false);
  const [charges, setCharges] = useState<Partial<Record<MeasuredRank, MeasuresRank | "error">>>({});
  const [copy, setCopy] = useState<"ok" | "error" | null>(null);

  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);

  // Server and first hydration start from an empty team (identical, so no
  // mismatch); only after mount do we adopt ?h= and ?rang=, then every change
  // is written back to the URL.
  const rise = useRef(false);
  useEffect(() => {
    if (!rise.current) {
      rise.current = true;
      const lu = readSettings(window.location.search, new Set(bySlug.keys()), ranks);
      if (lu.slugs.length || lu.rank) {
        /* eslint-disable react-hooks/set-state-in-effect -- reading the URL after mount */
        if (lu.slugs.length) setSlugs(lu.slugs);
        if (lu.rank) setRank(lu.rank);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    const suffix = writeSettings(window.location.search, slugs, rank);
    window.history.replaceState(null, "", suffix ? `?${suffix}` : window.location.pathname);
  }, [slugs, rank, bySlug, ranks]);

  useEffect(() => {
    loadMeasures(rank).then(
      (m) => setCharges((c) => ({ ...c, [rank]: m })),
      () => setCharges((c) => ({ ...c, [rank]: "error" })),
    );
  }, [rank]);

  const state = charges[rank];
  const measures = state && state !== "error" ? state : null;
  const analysis = useMemo(() => analyzeTeam({ catalog: heroes, slugs, measures }), [heroes, slugs, measures]);

  const formats = useMemo<Formats>(() => {
    const locale = LOCALE_HTML[siteLocale];
    const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    return { count: (v) => decimal.format(v), integer: (v) => integer.format(v), gap: (v) => formatGap(v, locale) };
  }, [siteLocale]);

  function add(slug: string) {
    setSlugs((l) => (l.includes(slug) || l.length >= SIZE_TEAM ? l : [...l, slug]));
    setOpen(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopy("ok");
    } catch {
      setCopy("error");
    }
    setTimeout(() => setCopy(null), 3000);
  }

  const { team, assignment } = analysis;
  const laneOf = new Map(Object.entries(assignment.lanes).map(([lane, slug]) => [slug, lane as Lane]));
  const full = team.length >= SIZE_TEAM;

  return (
    <div className="space-y-12">
      <section aria-labelledby="equipe-titre">
        <h2 id="equipe-titre" className="font-heading text-2xl font-bold text-chalk-100">
          {t("teamUI.yourTeam")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <p className="mt-3 text-sm text-chalk-500">
          {t("teamUI.yourTeamDesc", { n: team.length, max: SIZE_TEAM })}
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-5">
          {team.map((h) => (
            <li key={h.slug}>
              <Slot
                hero={h}
                lane={laneOf.get(h.slug) ?? null}
                stats={measures?.stats[h.slug] ?? null}
                formats={formats}
                onRemove={() => setSlugs((l) => l.filter((s) => s !== h.slug))}
              />
            </li>
          ))}
          {!full && (
            <li>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="bevel-sm flex h-full min-h-14 w-full items-center justify-center gap-2 border border-dashed border-night-600 px-3 py-3 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400 sm:min-h-32 sm:flex-col"
              >
                <Plus size={18} aria-hidden />
                {t("teamUI.add")}
              </button>
            </li>
          )}
          {/* Remaining slots, to see at a glance what is missing; on mobile, the button is enough. */}
          {Array.from({ length: Math.max(0, SIZE_TEAM - team.length - 1) }, (_, i) => (
            <li key={`vide-${i}`} aria-hidden className="hidden sm:block">
              <span className="bevel-sm block h-full min-h-32 border border-dashed border-night-800" />
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <ChoiceRank ranks={ranks} rank={rank} onChange={setRank} />
          {team.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="bevel-sm inline-flex items-center gap-2 border border-night-700 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <Link2 size={14} aria-hidden />
                {t("teamUI.copy")}
              </button>
              <button
                type="button"
                onClick={() => setSlugs([])}
                className="bevel-sm inline-flex items-center gap-2 border border-night-700 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <RotateCcw size={14} aria-hidden />
                {t("draftUI.clearAll")}
              </button>
              <span role="status" className="text-xs text-chalk-300">
                {copy === "ok" && t("teamUI.linkCopied")}
                {copy === "error" && t("teamUI.copyFailed")}
              </span>
            </div>
          )}
        </div>
      </section>

      {team.length === 0 ? (
        <p className="max-w-2xl leading-relaxed text-chalk-500">{t("teamUI.intro")}</p>
      ) : (
        <Results
          analysis={analysis}
          measures={measures}
          error={state === "error"}
          rank={rank}
          bySlug={bySlug}
          labelsDamage={labelsDamage}
          formats={formats}
          onAdd={add}
        />
      )}

      {open && (
        <HeroSelector
          heroes={heroes}
          excluded={new Set(slugs)}
          lane={team.length ? (assignment.missing[0] ?? null) : null}
          title={t("teamUI.choose")}
          onChoose={add}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** A team hero: its assigned lane, its tier and its rate at the rank. */
function Slot({
  hero: h,
  lane,
  stats,
  formats,
  onRemove,
}: {
  hero: TeamHero;
  lane: Lane | null;
  stats: [number, Tier] | null;
  formats: Formats;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <div className="bevel-sm relative flex h-full items-center gap-3 border border-azure-500/40 bg-night-900/60 p-2 pr-9 sm:min-h-32 sm:flex-col sm:gap-1.5 sm:px-2 sm:pb-2.5 sm:pt-3 sm:text-center">
      <HeroThumb hero={h} />
      <div className="min-w-0 flex-1 sm:w-full">
        <Link
          href={`/heroes/${h.slug}`}
          className="block truncate font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400"
        >
          {h.name}
        </Link>
        <p className={cn("truncate text-xs", lane ? "text-chalk-300" : "text-blood-500")}>
          {lane ? t(`lanes.${lane}`) : t("teamUI.offLane")}
        </p>
        {stats && (
          <p className="text-xs tabular-nums text-chalk-500">
            <span className="font-semibold text-gold-400">{stats[1]}</span> · {formats.count(stats[0])} %
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("draftUI.remove", { nom: h.name })}
        className="absolute right-1 top-1 grid size-7 place-items-center text-chalk-500 transition-colors hover:text-blood-500"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

function textAlert(a: Alert, t: T, formats: Formats, nameOf: (slug: string) => string): string {
  switch (a.type) {
    case "lanes":
      return t("teamUI.alerts.lanes", {
        lanes: a.lanes.map((l) => t(`lanes.${l}`)).join(", "),
        noms: a.extra.map(nameOf).join(", "),
      });
    case "tank":
      return t("teamUI.alerts.tank");
    case "damage":
      return t(`teamUI.alerts.damage.${a.dominant}`);
    default:
      return t(`teamUI.alerts.${a.type}`, { v: formats.count(a.value) });
  }
}

function Results({
  analysis,
  measures,
  error,
  rank,
  bySlug,
  labelsDamage,
  formats,
  onAdd,
}: {
  analysis: Analysis;
  measures: MeasuresRank | null;
  error: boolean;
  rank: MeasuredRank;
  bySlug: Map<string, TeamHero>;
  labelsDamage: Record<TypeDamage, string>;
  formats: Formats;
  onAdd: (slug: string) => void;
}) {
  const t = useT();
  const nameOf = (slug: string) => bySlug.get(slug)?.name ?? slug;
  const { team, assignment, alerts, damage, notes, curve } = analysis;
  const pts = t("counters.pts");
  const v = analysis.win;
  const bucket = (x: Bucket) =>
    x.to === null ? t("teamUI.minutesPlus", { de: x.from }) : t("teamUI.minutes", { de: x.from, a: x.to });

  const tiles: [string, string, number][] = [
    [t("teamUI.averageRate"), v === null ? "—" : `${formats.count(v)} %`, v === null ? 0 : v >= 50.5 ? 1 : v <= 49.5 ? -1 : 0],
    [t("teamUI.lanesCovered"), `${LANES.length - assignment.missing.length} / ${LANES.length}`, 0],
    [t("teamUI.synergyCount"), measures ? formats.integer(analysis.synergies.length) : "—", 0],
    [t("teamUI.threatCount"), measures ? formats.integer(analysis.threats.length) : "—", 0],
  ];

  return (
    <>
      <section aria-labelledby="analyse-titre" className="space-y-10">
        <div>
          <h2 id="analyse-titre" className="font-heading text-2xl font-bold text-chalk-100">
            {t("teamUI.analysis")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map(([label, value, sign]) => (
              <div key={label} className="bevel-sm border border-night-700/70 bg-night-900/60 px-3 py-2">
                <dt className="text-[0.7rem] uppercase tracking-wide text-chalk-500">{label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-lg font-semibold tabular-nums text-chalk-100",
                    sign === 1 && "text-emerald-400",
                    sign === -1 && "text-blood-500",
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Warnings ───────────────────────────────────────────────── */}
        <div>
          <h3 className={heading3}>{t("teamUI.alerts.title")}</h3>
          {alerts.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.type}
                  className="bevel-sm flex gap-2.5 border border-blood-500/30 bg-night-900/60 px-3 py-2 text-sm leading-relaxed text-chalk-100"
                >
                  <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-blood-500" />
                  {textAlert(a, t, formats, nameOf)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex gap-2.5 text-sm leading-relaxed text-chalk-300">
              <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-emerald-400" />
              {team.length >= SIZE_TEAM
                ? t("teamUI.alerts.none")
                : team.length < MIN_ALERTS
                  ? t("teamUI.alerts.tooFew", { n: MIN_ALERTS })
                  : t("teamUI.alerts.nonePartial")}
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Lanes and roles ──────────────────────────────────────── */}
          <Card>
            <h3 className={heading3}>{t("teamUI.lanesRoles")}</h3>
            <ul className="mt-3 space-y-1.5">
              {LANES.map((lane) => {
                const slug = assignment.lanes[lane];
                const h = slug ? bySlug.get(slug) : null;
                return (
                  <li key={lane} className="flex min-h-7 items-center gap-2 text-sm">
                    <span className={cn("w-24 shrink-0", heading)}>{t(`lanes.${lane}`)}</span>
                    {h ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <HeroThumb hero={h} small />
                        <span className="truncate text-chalk-100">{h.name}</span>
                      </span>
                    ) : (
                      <span className="italic text-chalk-500">{t("teamUI.toFill")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {assignment.extra.length > 0 && (
              <p className="mt-2 text-xs text-blood-500">
                {t("teamUI.noLane", { noms: assignment.extra.map(nameOf).join(", ") })}
              </p>
            )}

            <p className={cn("mt-5", heading)}>{t("teamUI.roles")}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <li
                  key={r}
                  className={cn(
                    "bevel-sm border px-2 py-1 text-xs",
                    analysis.roles[r] ? "border-night-600 text-chalk-100" : "border-night-800 text-chalk-500",
                  )}
                >
                  {t(`roles.${r}`)} <span className="font-semibold tabular-nums">{formats.integer(analysis.roles[r])}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* ── Profile: damage and in-game ratings ──────────────────── */}
          <Card>
            <h3 className={heading3}>{t("teamUI.profile")}</h3>
            {damage.partPhysique !== null && (
              <>
                <p className={cn("mt-3", heading)}>{t("teamUI.damage")}</p>
                <div
                  role="img"
                  aria-label={t("teamUI.damageShare", {
                    physique: formats.integer(damage.partPhysique * 100),
                    magique: formats.integer((1 - damage.partPhysique) * 100),
                  })}
                  className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-night-800"
                >
                  <span className="h-full bg-gold-500" style={{ width: `${damage.partPhysique * 100}%` }} />
                  <span className="h-full bg-azure-500" style={{ width: `${(1 - damage.partPhysique) * 100}%` }} />
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-300">
                  {(["physical", "magic", "mixed"] as const).map(
                    (d) =>
                      damage[d] > 0 && (
                        <li key={d} className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className={cn(
                              "size-2 rounded-full",
                              d === "physical" ? "bg-gold-500" : d === "magic" ? "bg-azure-500" : "bg-chalk-500",
                            )}
                          />
                          {labelsDamage[d]}
                          <span className="font-semibold tabular-nums text-chalk-100">{formats.integer(damage[d])}</span>
                        </li>
                      ),
                  )}
                </ul>
              </>
            )}

            <p className={cn("mt-5", heading)}>{t("teamUI.ratings")}</p>
            <dl className="mt-2 space-y-2">
              {NOTES.map((n) => {
                const value = notes[n];
                if (value === null) return null;
                return (
                  <div key={n} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm">
                    <dt className="text-chalk-300">{t(`compareUI.${n}`)}</dt>
                    <dd>
                      <Gauge value={value} text={formats.count(value)} />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        </div>

        {measures ? (
          <>
            {/* ── Match duration ─────────────────────────────────────── */}
            <div>
              <h3 className={heading3}>{t("teamUI.duration")}</h3>
              {curve ? (
                <>
                  <p className="mt-1 text-sm text-chalk-500">
                    {t("teamUI.durationIntro", { rang: t(`measuredRanks.${rank}`) })}
                  </p>
                  <p className="mt-3 text-sm text-chalk-300">
                    <span className="font-semibold text-gold-400">{t(`teamUI.durationProfile.${curve.profile}`)}</span>
                    {" · "}
                    {t("teamUI.peak", { tranche: bucket(curve.buckets[curve.pic]) })}
                  </p>
                  <DurationBars
                    buckets={curve.buckets.map((x, i) => ({ ...x, winRate: curve.win[i] }))}
                    count={formats.count}
                    label={bucket}
                    className="mt-4"
                  />
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-chalk-500">
                    {curve.byHero.map(({ slug, profile }) => (
                      <li key={slug}>
                        <span className="text-chalk-100">{nameOf(slug)}</span> · {t(`teamUI.profileShort.${profile}`)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-chalk-500">{t("teamUI.noDuration")}</p>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* ── Synergies ─────────────────────────────────────────── */}
              <div>
                <h3 className={heading3}>{t("teamUI.synergies")}</h3>
                <p className="mt-1 text-sm text-chalk-500">{t("teamUI.synergiesIntro")}</p>
                {analysis.synergies.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {analysis.synergies.map((p) => {
                      const a = bySlug.get(p.a);
                      const b = bySlug.get(p.b);
                      return (
                        <li
                          key={`${p.a}-${p.b}`}
                          className="bevel-sm flex items-center gap-2 border border-night-700/70 bg-night-900/60 px-3 py-2 text-sm"
                        >
                          {a && <HeroThumb hero={a} small />}
                          {b && <HeroThumb hero={b} small />}
                          <span className="min-w-0 flex-1 text-chalk-100">
                            {nameOf(p.a)} + {nameOf(p.b)}
                          </span>
                          {p.points !== null ? (
                            <span className="shrink-0 font-semibold tabular-nums text-emerald-400">
                              {formats.gap(p.points)} {pts}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-chalk-500">{t("teamUI.knownSynergy")}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-chalk-500">{t("teamUI.noSynergy")}</p>
                )}
              </div>

              {/* ── Threats ───────────────────────────────────────────── */}
              <div>
                <h3 className={heading3}>{t("teamUI.threats")}</h3>
                <p className="mt-1 text-sm text-chalk-500">{t("teamUI.threatsIntro")}</p>
                {analysis.threats.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {analysis.threats.map((m) => {
                      const h = bySlug.get(m.slug);
                      return (
                        <li
                          key={m.slug}
                          className="bevel-sm flex items-start gap-3 border border-blood-500/30 bg-night-900/60 px-3 py-2"
                        >
                          {h && <HeroThumb hero={h} />}
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/heroes/${m.slug}`}
                              className="font-heading font-bold text-chalk-100 transition-colors hover:text-gold-400"
                            >
                              {nameOf(m.slug)}
                            </Link>
                            <p className="text-xs leading-snug text-chalk-300">
                              {t("teamUI.bothers", { n: m.targets.length })}{" "}
                              {m.targets.map(([s, p]) => `${nameOf(s)} (${formats.gap(p)} ${pts})`).join(", ")}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-chalk-500">{t("teamUI.noThreat")}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p
            role="status"
            className="bevel-sm border border-dashed border-night-700 px-4 py-3 text-sm text-chalk-500"
          >
            {error ? t("teamUI.error") : t("teamUI.loading")}
          </p>
        )}
      </section>

      {/* ── Picks for the open lanes ─────────────────────────────────── */}
      {analysis.suggestions.length > 0 && (
        <section aria-labelledby="completer-titre">
          <h2 id="completer-titre" className="font-heading text-2xl font-bold text-chalk-100">
            {t("teamUI.complete")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <p className="mt-3 max-w-2xl text-sm text-chalk-500">{t("teamUI.completeIntro")}</p>

          <div className="mt-6 space-y-5">
            {analysis.suggestions.map(({ lane, picks }) => (
              <div key={lane}>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
                  {t(`lanes.${lane}`)}
                </h3>
                {picks.length > 0 ? (
                  <ul className="mt-2 grid gap-2 md:grid-cols-3">
                    {picks.map((s, i) => (
                      <li key={s.hero.slug}>
                        <CardSuggestion
                          suggestion={s}
                          first={i === 0}
                          titleTake={t("draftUI.chooseIn", { nom: s.hero.name, lane: t(`lanes.${lane}`) })}
                          onTake={() => onAdd(s.hero.slug)}
                          empty={t("teamUI.noReason")}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-chalk-500">{t("draftUI.noHero")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
