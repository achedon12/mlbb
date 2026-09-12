"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, RotateCcw, Settings2 } from "lucide-react";
import { VignetteHeros } from "@/components/choix-heros";
import Link from "@/components/lien";
import { Carte, Jauge } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import type { T } from "@/i18n/t";
import {
  analyserEquipe,
  ecrireParametres,
  NOTES,
  type Alerte,
  type Analyse,
  type MesuresRang,
  type TypeDegats,
} from "@/lib/composition";
import { LANES } from "@/lib/draft";
import { matchupsBetween, measuredAdvantage, type Side, type SimulationHero } from "@/lib/draft-simulation";
import type { RangMesure } from "@/lib/rangs-mesure";
import { formaterEcart } from "@/lib/tendances";
import { cn } from "@/lib/utils";

/**
 * Summary of a finished draft: each team run through the team analyzer
 * (lanes, damage, crowd control, measured duos), the measured matchups
 * between them, and an advantage index built from those measurements only,
 * shown as an estimate and never as a win probability.
 */

/** Numbers in the page language. */
export interface NumberFormats {
  /** One decimal: rates, averages. */
  decimal: (v: number) => string;
  integer: (v: number) => string;
  /** Signed gap, one decimal. */
  signed: (v: number) => string;
}

export function useNumberFormats(): NumberFormats {
  const language = useLangue();
  return useMemo(() => {
    const locale = LOCALE_HTML[language];
    const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    return { decimal: (v) => decimal.format(v), integer: (v) => integer.format(v), signed: (v) => formaterEcart(v, locale) };
  }, [language]);
}

const heading3 = "font-heading text-lg font-bold text-chalk-100";
const label = "text-xs uppercase tracking-wide text-chalk-500";
const button =
  "bevel-sm inline-flex min-h-11 items-center gap-2 border border-night-700 px-3 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400";

export function DraftSummary({
  blue,
  red,
  heroes,
  measures,
  failed,
  rank,
  damageLabels,
  query,
  onReplay,
  onSettings,
}: {
  blue: string[];
  red: string[];
  heroes: SimulationHero[];
  measures: MesuresRang | null;
  /** The rank's measurements could not be loaded. */
  failed: boolean;
  rank: RangMesure;
  damageLabels: Record<TypeDegats, string>;
  /** Parameters of the draft address, without the "?". */
  query: string;
  onReplay: () => void;
  onSettings: () => void;
}) {
  const t = useT();
  const f = useNumberFormats();
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  const bySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const nameOf = (slug: string) => bySlug.get(slug)?.nom ?? slug;

  const analyses = useMemo<Record<Side, Analyse>>(
    () => ({
      blue: analyserEquipe({ catalogue: heroes, slugs: blue, mesures: measures }),
      red: analyserEquipe({ catalogue: heroes, slugs: red, mesures: measures }),
    }),
    [heroes, blue, red, measures],
  );
  const advantage = measures ? measuredAdvantage(blue, red, measures) : null;
  const matchups = measures ? matchupsBetween(blue, red, measures).slice(0, 8) : [];
  const rankName = t(`measuredRanks.${rank}`);
  // Shown after a draft played in the browser: the address exists.
  const address = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}?${query}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied("ok");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied(null), 3000);
  }

  const index =
    advantage === null || advantage.measures === 0
      ? null
      : advantage.total === 0
        ? t("pages.draftSimulatorUI.summary.even")
        : t("pages.draftSimulatorUI.summary.index", {
            side: t(`pages.draftSimulatorUI.sides.${advantage.total > 0 ? "blue" : "red"}`),
            pts: f.decimal(Math.abs(advantage.total)),
          });

  return (
    <section aria-labelledby="summary-title" className="space-y-8">
      <div>
        <h2 id="summary-title" className="font-heading text-2xl font-bold text-chalk-100">
          {t("pages.draftSimulatorUI.summary.title")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <p className="mt-3 text-sm text-chalk-500">{t("pages.draftSimulatorUI.summary.intro", { rank: rankName })}</p>
      </div>

      {/* -- Measured advantage ----------------------------------------- */}
      <Carte>
        <h3 className={heading3}>{t("pages.draftSimulatorUI.summary.advantage")}</h3>
        {!measures ? (
          <p role="status" className="mt-2 text-sm text-chalk-500">
            {failed ? t("teamUI.error") : t("teamUI.loading")}
          </p>
        ) : advantage && index ? (
          <>
            <p className="mt-2 font-semibold text-chalk-100">{index}</p>
            <div className="relative mt-3">
              <div
                role="img"
                aria-label={t("pages.draftSimulatorUI.summary.bar", { text: index })}
                className="flex h-3 overflow-hidden rounded-full bg-night-800"
              >
                <span className="h-full bg-azure-500" style={{ width: `${advantage.blueShare * 100}%` }} />
                <span className="h-full bg-blood-500" style={{ width: `${(1 - advantage.blueShare) * 100}%` }} />
              </div>
              <span aria-hidden className="absolute -top-1 left-1/2 h-5 w-0.5 -translate-x-1/2 bg-chalk-100/70" />
            </div>
            <div aria-hidden className="mt-1 flex justify-between text-xs font-semibold">
              <span className="text-azure-500">{t("pages.draftSimulatorUI.sides.blue")}</span>
              <span className="text-blood-500">{t("pages.draftSimulatorUI.sides.red")}</span>
            </div>
            <p className="mt-3 text-xs text-chalk-300">
              {t("pages.draftSimulatorUI.summary.detail", {
                counters: f.signed(advantage.counters),
                blue: f.signed(advantage.duos.blue),
                red: f.signed(advantage.duos.red),
              })}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-chalk-500">
              {t("pages.draftSimulatorUI.summary.advantageNote", { rank: rankName })}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-chalk-500">{t("pages.draftSimulatorUI.summary.noMeasures", { rank: rankName })}</p>
        )}
      </Carte>

      {/* -- Both teams ------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {(["blue", "red"] as const).map((side) => (
          <TeamCard
            key={side}
            side={side}
            analysis={analyses[side]}
            measures={measures}
            rank={rank}
            bySlug={bySlug}
            damageLabels={damageLabels}
            f={f}
          />
        ))}
      </div>

      {/* -- Matchups --------------------------------------------------- */}
      {measures && (
        <div>
          <h3 className={heading3}>{t("pages.draftSimulatorUI.summary.matchups")}</h3>
          <p className="mt-1 text-sm text-chalk-500">{t("pages.draftSimulatorUI.summary.matchupsIntro")}</p>
          {matchups.length > 0 ? (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {matchups.map((m) => {
                const blueWins = m.points > 0;
                const a = bySlug.get(m.blue);
                const b = bySlug.get(m.red);
                return (
                  <li
                    key={`${m.blue}-${m.red}`}
                    className={cn(
                      "bevel-sm flex items-center gap-2 border bg-night-900/60 px-3 py-2 text-sm",
                      blueWins ? "border-azure-500/40" : "border-blood-500/40",
                    )}
                  >
                    {a && <VignetteHeros heros={a} petite />}
                    {b && <VignetteHeros heros={b} petite />}
                    <span className="min-w-0 flex-1 leading-snug text-chalk-100">
                      {t("pages.draftSimulatorUI.summary.matchup", {
                        winner: nameOf(blueWins ? m.blue : m.red),
                        loser: nameOf(blueWins ? m.red : m.blue),
                        pts: f.decimal(Math.abs(m.points)),
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-chalk-500">{t("pages.draftSimulatorUI.summary.noMatchup")}</p>
          )}
        </div>
      )}

      {/* -- Share ------------------------------------------------------ */}
      <div>
        <h3 className={heading3}>{t("pages.draftSimulatorUI.summary.share")}</h3>
        <p className="mt-1 text-sm text-chalk-500">{t("pages.draftSimulatorUI.summary.shareIntro")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1 basis-64">
            <span className="sr-only">{t("pages.draftSimulatorUI.summary.address")}</span>
            <input
              readOnly
              value={address}
              onFocus={(e) => e.currentTarget.select()}
              className="bevel-sm min-h-11 w-full border border-night-700 bg-night-950 px-3 text-sm text-chalk-300 outline-none focus:border-gold-500"
            />
          </label>
          <button type="button" onClick={copy} className={button}>
            <Link2 size={15} aria-hidden />
            {t("teamUI.copy")}
          </button>
          <span role="status" className="text-xs text-chalk-300">
            {copied === "ok" && t("teamUI.linkCopied")}
            {copied === "error" && t("teamUI.copyFailed")}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onReplay} className={button}>
            <RotateCcw size={15} aria-hidden />
            {t("pages.draftSimulatorUI.summary.newDraft")}
          </button>
          <button type="button" onClick={onSettings} className={button}>
            <Settings2 size={15} aria-hidden />
            {t("pages.draftSimulatorUI.changeSettings")}
          </button>
        </div>
      </div>
    </section>
  );
}

function alertText(a: Alerte, t: T, f: NumberFormats, nameOf: (slug: string) => string): string {
  switch (a.type) {
    case "lanes":
      return t("teamUI.alerts.lanes", {
        lanes: a.lanes.map((l) => t(`lanes.${l}`)).join(", "),
        noms: a.enTrop.map(nameOf).join(", "),
      });
    case "tank":
      return t("teamUI.alerts.tank");
    case "degats":
      return t(`teamUI.alerts.damage.${a.dominant}`);
    default:
      return t(`teamUI.alerts.${a.type}`, { v: f.decimal(a.valeur) });
  }
}

/** One team through the team analyzer. */
function TeamCard({
  side,
  analysis,
  measures,
  rank,
  bySlug,
  damageLabels,
  f,
}: {
  side: Side;
  analysis: Analyse;
  measures: MesuresRang | null;
  rank: RangMesure;
  bySlug: Map<string, SimulationHero>;
  damageLabels: Record<TypeDegats, string>;
  f: NumberFormats;
}) {
  const t = useT();
  const nameOf = (slug: string) => bySlug.get(slug)?.nom ?? slug;
  const { affectation, degats, notes, alertes } = analysis;
  const duos = analysis.synergies.filter((p): p is typeof p & { points: number } => p.points !== null);
  const slugs = analysis.equipe.map((h) => h.slug);

  return (
    <Carte className={side === "blue" ? "border-azure-500/40" : "border-blood-500/40"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={cn("font-heading text-xl font-bold", side === "blue" ? "text-azure-500" : "text-blood-500")}>
          {t(`pages.draftSimulatorUI.sides.${side}`)}
        </h3>
        {analysis.victoire !== null && (
          <p className="text-sm text-chalk-300">
            {t("teamUI.averageRate")} :{" "}
            <span className="font-semibold tabular-nums text-chalk-100">{f.decimal(analysis.victoire)} %</span>
          </p>
        )}
      </div>

      <p className={cn("mt-4", label)}>{t("pages.draftSimulatorUI.summary.lanes")}</p>
      <ul className="mt-2 space-y-1">
        {LANES.map((lane) => {
          const slug = affectation.lanes[lane];
          const h = slug ? bySlug.get(slug) : null;
          return (
            <li key={lane} className="flex min-h-7 items-center gap-2 text-sm">
              <span className={cn("w-24 shrink-0", label)}>{t(`lanes.${lane}`)}</span>
              {h ? (
                <span className="flex min-w-0 items-center gap-2">
                  <VignetteHeros heros={h} petite />
                  <span className="truncate text-chalk-100">{h.nom}</span>
                </span>
              ) : (
                <span className="italic text-blood-500">{t("teamUI.toFill")}</span>
              )}
            </li>
          );
        })}
      </ul>
      {affectation.enTrop.length > 0 && (
        <p className="mt-2 text-xs text-blood-500">{t("teamUI.noLane", { noms: affectation.enTrop.map(nameOf).join(", ") })}</p>
      )}

      {degats.partPhysique !== null && (
        <>
          <p className={cn("mt-5", label)}>{t("teamUI.damage")}</p>
          <div
            role="img"
            aria-label={t("teamUI.damageShare", {
              physique: f.integer(degats.partPhysique * 100),
              magique: f.integer((1 - degats.partPhysique) * 100),
            })}
            className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-night-800"
          >
            <span className="h-full bg-gold-500" style={{ width: `${degats.partPhysique * 100}%` }} />
            <span className="h-full bg-azure-500" style={{ width: `${(1 - degats.partPhysique) * 100}%` }} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-300">
            {(["physical", "magic", "mixed"] as const).map(
              (d) =>
                degats[d] > 0 && (
                  <li key={d} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        d === "physical" ? "bg-gold-500" : d === "magic" ? "bg-azure-500" : "bg-chalk-500",
                      )}
                    />
                    {damageLabels[d]}
                    <span className="font-semibold tabular-nums text-chalk-100">{f.integer(degats[d])}</span>
                  </li>
                ),
            )}
          </ul>
        </>
      )}

      <p className={cn("mt-5", label)}>{t("teamUI.ratings")}</p>
      <dl className="mt-2 space-y-2">
        {NOTES.map((n) => {
          const value = notes[n];
          if (value === null) return null;
          return (
            <div key={n} className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3 text-sm">
              <dt className="text-chalk-300">{t(`compareUI.${n}`)}</dt>
              <dd>
                <Jauge valeur={value} texte={f.decimal(value)} />
              </dd>
            </div>
          );
        })}
      </dl>

      <p className={cn("mt-5", label)}>{t("teamUI.alerts.title")}</p>
      {alertes.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {alertes.map((a) => (
            <li key={a.type} className="flex gap-2 text-sm leading-snug text-chalk-100">
              <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-blood-500" />
              {alertText(a, t, f, nameOf)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex gap-2 text-sm text-chalk-300">
          <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-emerald-400" />
          {t("teamUI.alerts.none")}
        </p>
      )}

      <p className={cn("mt-5", label)}>{t("pages.draftSimulatorUI.summary.duos")}</p>
      {measures && duos.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {duos.map((p) => (
            <li key={`${p.a}-${p.b}`} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-chalk-100">
                {nameOf(p.a)} + {nameOf(p.b)}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-emerald-400">
                {f.signed(p.points)} {t("counters.pts")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-chalk-500">{t("pages.draftSimulatorUI.summary.noDuo")}</p>
      )}

      <Link
        href={`/tools/team?${ecrireParametres("", slugs, rank)}`}
        className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
      >
        {t("pages.draftSimulatorUI.summary.fullAnalysis")} →
      </Link>
    </Carte>
  );
}
