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

const heading3 = "font-titre text-lg font-bold text-craie-100";
const label = "text-xs uppercase tracking-wide text-craie-500";
const button =
  "biseau-sm inline-flex min-h-11 items-center gap-2 border border-nuit-700 px-3 py-2 text-sm text-craie-300 transition-colors hover:border-or-500/60 hover:text-or-400";

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
  const rankName = t(`rangsMesure.${rank}`);
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
        <h2 id="summary-title" className="font-titre text-2xl font-bold text-craie-100">
          {t("pages.draftSimulatorUI.summary.title")}
        </h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
        <p className="mt-3 text-sm text-craie-500">{t("pages.draftSimulatorUI.summary.intro", { rank: rankName })}</p>
      </div>

      {/* -- Measured advantage ----------------------------------------- */}
      <Carte>
        <h3 className={heading3}>{t("pages.draftSimulatorUI.summary.advantage")}</h3>
        {!measures ? (
          <p role="status" className="mt-2 text-sm text-craie-500">
            {failed ? t("equipeUI.erreur") : t("equipeUI.chargement")}
          </p>
        ) : advantage && index ? (
          <>
            <p className="mt-2 font-semibold text-craie-100">{index}</p>
            <div className="relative mt-3">
              <div
                role="img"
                aria-label={t("pages.draftSimulatorUI.summary.bar", { text: index })}
                className="flex h-3 overflow-hidden rounded-full bg-nuit-800"
              >
                <span className="h-full bg-azur-500" style={{ width: `${advantage.blueShare * 100}%` }} />
                <span className="h-full bg-sang-500" style={{ width: `${(1 - advantage.blueShare) * 100}%` }} />
              </div>
              <span aria-hidden className="absolute -top-1 left-1/2 h-5 w-0.5 -translate-x-1/2 bg-craie-100/70" />
            </div>
            <div aria-hidden className="mt-1 flex justify-between text-xs font-semibold">
              <span className="text-azur-500">{t("pages.draftSimulatorUI.sides.blue")}</span>
              <span className="text-sang-500">{t("pages.draftSimulatorUI.sides.red")}</span>
            </div>
            <p className="mt-3 text-xs text-craie-300">
              {t("pages.draftSimulatorUI.summary.detail", {
                counters: f.signed(advantage.counters),
                blue: f.signed(advantage.duos.blue),
                red: f.signed(advantage.duos.red),
              })}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-craie-500">
              {t("pages.draftSimulatorUI.summary.advantageNote", { rank: rankName })}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-craie-500">{t("pages.draftSimulatorUI.summary.noMeasures", { rank: rankName })}</p>
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
          <p className="mt-1 text-sm text-craie-500">{t("pages.draftSimulatorUI.summary.matchupsIntro")}</p>
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
                      "biseau-sm flex items-center gap-2 border bg-nuit-900/60 px-3 py-2 text-sm",
                      blueWins ? "border-azur-500/40" : "border-sang-500/40",
                    )}
                  >
                    {a && <VignetteHeros heros={a} petite />}
                    {b && <VignetteHeros heros={b} petite />}
                    <span className="min-w-0 flex-1 leading-snug text-craie-100">
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
            <p className="mt-3 text-sm text-craie-500">{t("pages.draftSimulatorUI.summary.noMatchup")}</p>
          )}
        </div>
      )}

      {/* -- Share ------------------------------------------------------ */}
      <div>
        <h3 className={heading3}>{t("pages.draftSimulatorUI.summary.share")}</h3>
        <p className="mt-1 text-sm text-craie-500">{t("pages.draftSimulatorUI.summary.shareIntro")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1 basis-64">
            <span className="sr-only">{t("pages.draftSimulatorUI.summary.address")}</span>
            <input
              readOnly
              value={address}
              onFocus={(e) => e.currentTarget.select()}
              className="biseau-sm min-h-11 w-full border border-nuit-700 bg-nuit-950 px-3 text-sm text-craie-300 outline-none focus:border-or-500"
            />
          </label>
          <button type="button" onClick={copy} className={button}>
            <Link2 size={15} aria-hidden />
            {t("equipeUI.copier")}
          </button>
          <span role="status" className="text-xs text-craie-300">
            {copied === "ok" && t("equipeUI.lienCopie")}
            {copied === "error" && t("equipeUI.copieImpossible")}
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
      return t("equipeUI.alertes.lanes", {
        lanes: a.lanes.map((l) => t(`lanes.${l}`)).join(", "),
        noms: a.enTrop.map(nameOf).join(", "),
      });
    case "tank":
      return t("equipeUI.alertes.tank");
    case "degats":
      return t(`equipeUI.alertes.degats.${a.dominant}`);
    default:
      return t(`equipeUI.alertes.${a.type}`, { v: f.decimal(a.valeur) });
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
    <Carte className={side === "blue" ? "border-azur-500/40" : "border-sang-500/40"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={cn("font-titre text-xl font-bold", side === "blue" ? "text-azur-500" : "text-sang-500")}>
          {t(`pages.draftSimulatorUI.sides.${side}`)}
        </h3>
        {analysis.victoire !== null && (
          <p className="text-sm text-craie-300">
            {t("equipeUI.tauxMoyen")} :{" "}
            <span className="font-semibold tabular-nums text-craie-100">{f.decimal(analysis.victoire)} %</span>
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
                  <span className="truncate text-craie-100">{h.nom}</span>
                </span>
              ) : (
                <span className="italic text-sang-500">{t("equipeUI.aPourvoir")}</span>
              )}
            </li>
          );
        })}
      </ul>
      {affectation.enTrop.length > 0 && (
        <p className="mt-2 text-xs text-sang-500">{t("equipeUI.sansLane", { noms: affectation.enTrop.map(nameOf).join(", ") })}</p>
      )}

      {degats.partPhysique !== null && (
        <>
          <p className={cn("mt-5", label)}>{t("equipeUI.degats")}</p>
          <div
            role="img"
            aria-label={t("equipeUI.partDegats", {
              physique: f.integer(degats.partPhysique * 100),
              magique: f.integer((1 - degats.partPhysique) * 100),
            })}
            className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-nuit-800"
          >
            <span className="h-full bg-or-500" style={{ width: `${degats.partPhysique * 100}%` }} />
            <span className="h-full bg-azur-500" style={{ width: `${(1 - degats.partPhysique) * 100}%` }} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-craie-300">
            {(["physical", "magic", "mixed"] as const).map(
              (d) =>
                degats[d] > 0 && (
                  <li key={d} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        d === "physical" ? "bg-or-500" : d === "magic" ? "bg-azur-500" : "bg-craie-500",
                      )}
                    />
                    {damageLabels[d]}
                    <span className="font-semibold tabular-nums text-craie-100">{f.integer(degats[d])}</span>
                  </li>
                ),
            )}
          </ul>
        </>
      )}

      <p className={cn("mt-5", label)}>{t("equipeUI.notes")}</p>
      <dl className="mt-2 space-y-2">
        {NOTES.map((n) => {
          const value = notes[n];
          if (value === null) return null;
          return (
            <div key={n} className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3 text-sm">
              <dt className="text-craie-300">{t(`compareUI.${n}`)}</dt>
              <dd>
                <Jauge valeur={value} texte={f.decimal(value)} />
              </dd>
            </div>
          );
        })}
      </dl>

      <p className={cn("mt-5", label)}>{t("equipeUI.alertes.titre")}</p>
      {alertes.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {alertes.map((a) => (
            <li key={a.type} className="flex gap-2 text-sm leading-snug text-craie-100">
              <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-sang-500" />
              {alertText(a, t, f, nameOf)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex gap-2 text-sm text-craie-300">
          <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-emerald-400" />
          {t("equipeUI.alertes.aucune")}
        </p>
      )}

      <p className={cn("mt-5", label)}>{t("pages.draftSimulatorUI.summary.duos")}</p>
      {measures && duos.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {duos.map((p) => (
            <li key={`${p.a}-${p.b}`} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-craie-100">
                {nameOf(p.a)} + {nameOf(p.b)}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-emerald-400">
                {f.signed(p.points)} {t("contres.pts")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-craie-500">{t("pages.draftSimulatorUI.summary.noDuo")}</p>
      )}

      <Link
        href={`/tools/team?${ecrireParametres("", slugs, rank)}`}
        className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
      >
        {t("pages.draftSimulatorUI.summary.fullAnalysis")} →
      </Link>
    </Carte>
  );
}
