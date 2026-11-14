"use client";

import { ChevronDown } from "lucide-react";
import type { NumberFormats } from "@/components/draft-summary";
import { useT } from "@/i18n/provider";
import type { T } from "@/i18n/t";
import type { Side } from "@/lib/draft-simulation";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { cn } from "@/lib/utils";
import { FACTORS, percentages, type Estimate, type FactorKey, type PickReason } from "@/lib/win-estimate";

/**
 * Live win estimate of the draft simulator: a balanced bar for the pinned
 * board, and the factors behind it, folded away. The model lives in
 * `lib/win-estimate`; this file only words it.
 */

const sideText: Record<Side, string> = { blue: "text-azure-500", red: "text-blood-500" };

/** The bar alone, one row high: it sits in the pinned board. */
export function EstimateBar({
  estimate,
  detailsId,
  open,
  onToggle,
}: {
  estimate: Estimate;
  /** Id of the details panel the toggle controls; no toggle without it. */
  detailsId?: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  const t = useT();
  const pct = percentages(estimate);
  const text = t("pages.draftSimulatorUI.estimate.bar", {
    blue: pct.blue,
    red: pct.red,
    confidence: t(`pages.draftSimulatorUI.estimate.confidence.${estimate.confidence}`),
  });

  return (
    <div className="flex items-center gap-2 text-xs sm:gap-3">
      <span aria-hidden className="w-9 shrink-0 font-heading text-sm font-bold tabular-nums text-azure-500 sm:w-11 sm:text-base">
        {pct.blue}%
      </span>
      <div className="relative min-w-0 flex-1">
        <div role="img" aria-label={text} className="flex h-2 overflow-hidden rounded-full bg-night-800 sm:h-2.5">
          <span className="h-full bg-azure-500 motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${pct.blue}%` }} />
          <span className="h-full flex-1 bg-blood-500" />
        </div>
        <span aria-hidden className="absolute -top-0.5 left-1/2 h-3 w-0.5 -translate-x-1/2 bg-chalk-100/70 sm:h-3.5" />
      </div>
      <span aria-hidden className="w-9 shrink-0 text-right font-heading text-sm font-bold tabular-nums text-blood-500 sm:w-11 sm:text-base">
        {pct.red}%
      </span>
      {detailsId && onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={onToggle}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-chalk-300 transition-colors hover:text-gold-400"
        >
          <span aria-hidden className="max-sm:hidden">
            {t("pages.draftSimulatorUI.estimate.short")}
          </span>
          <span className="sr-only">{t("pages.draftSimulatorUI.estimate.toggle")}</span>
          <ChevronDown size={14} aria-hidden className={cn("motion-safe:transition-transform", open && "rotate-180")} />
        </button>
      ) : null}
    </div>
  );
}

/** One line per factor: who it favours, by how much, and the fact behind it. */
export function EstimateDetails({
  estimate,
  nameOf,
  f,
  rank,
  id,
  className,
}: {
  estimate: Estimate;
  nameOf: (slug: string) => string;
  f: NumberFormats;
  rank: MeasuredRank;
  id?: string;
  className?: string;
}) {
  const t = useT();
  const side = (s: Side) => t(`pages.draftSimulatorUI.sides.${s}`);
  const verdict =
    estimate.picks === 0
      ? t("pages.draftSimulatorUI.estimate.empty")
      : Math.abs(estimate.edge) < 0.5
        ? t("pages.draftSimulatorUI.estimate.even")
        : t("pages.draftSimulatorUI.estimate.edge", {
            side: side(estimate.edge > 0 ? "blue" : "red"),
            pts: f.decimal(Math.abs(estimate.edge)),
          });

  return (
    <div id={id} className={className}>
      <p className="text-sm font-semibold text-chalk-100">
        {verdict}{" "}
        <span className="font-normal text-chalk-500">
          · {t(`pages.draftSimulatorUI.estimate.confidence.${estimate.confidence}`)}
        </span>
      </p>
      <dl className="mt-3 space-y-2.5">
        {FACTORS.map((k) => {
          const v = estimate.factors[k];
          const leader: Side | null = Math.abs(v) < 0.05 ? null : v > 0 ? "blue" : "red";
          return (
            <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-sm">
              <dt className="font-semibold text-chalk-100">{t(`pages.draftSimulatorUI.estimate.factors.${k}`)}</dt>
              <dd className={cn("text-right text-xs font-semibold tabular-nums", leader ? sideText[leader] : "text-chalk-500")}>
                {leader
                  ? t("pages.draftSimulatorUI.estimate.favours", { side: side(leader), pts: f.decimal(Math.abs(v)) })
                  : t("pages.draftSimulatorUI.estimate.neutral")}
              </dd>
              <dd className="col-span-2 text-xs leading-snug text-chalk-300">{factorFact(k, estimate, t, f, nameOf)}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-chalk-500">
        {t("pages.draftSimulatorUI.estimate.note", { rank: t(`measuredRanks.${rank}`) })}
      </p>
    </div>
  );
}

const mean = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);

function factorFact(k: FactorKey, e: Estimate, t: T, f: NumberFormats, nameOf: (slug: string) => string): string {
  const side = (s: Side) => t(`pages.draftSimulatorUI.sides.${s}`);
  const none = t("pages.draftSimulatorUI.estimate.facts.none");
  switch (k) {
    case "strength": {
      const avg = (s: Side) => mean(e.teams[s].rates.flatMap((r) => (r.rate === null ? [] : [r.rate])));
      const [b, r] = [avg("blue"), avg("red")];
      if (b === null && r === null) return none;
      const dash = "—";
      return t("pages.draftSimulatorUI.estimate.facts.strength", {
        blue: b === null ? dash : f.decimal(b),
        red: r === null ? dash : f.decimal(r),
      });
    }
    case "counters": {
      const [top] = e.duels;
      if (!top) return t("pages.draftSimulatorUI.estimate.facts.noDuel");
      const blueWins = top.points > 0;
      return t("pages.draftSimulatorUI.estimate.facts.duel", {
        winner: nameOf(blueWins ? top.blue : top.red),
        loser: nameOf(blueWins ? top.red : top.blue),
        pts: f.decimal(Math.abs(top.points)),
      });
    }
    case "synergy": {
      const parts = (["blue", "red"] as const).flatMap((s) => {
        const [p] = e.teams[s].pairs;
        return p ? [t("pages.draftSimulatorUI.estimate.facts.duo", { side: side(s), a: nameOf(p.a), b: nameOf(p.b), pts: f.decimal(p.points) })] : [];
      });
      return parts.length ? parts.join(" · ") : t("pages.draftSimulatorUI.estimate.facts.noDuo");
    }
    case "composition": {
      const parts = (["blue", "red"] as const).flatMap((s) => [
        ...(e.teams[s].laneConflicts.length
          ? [t("pages.draftSimulatorUI.estimate.facts.lanes", { side: side(s), names: e.teams[s].laneConflicts.map(nameOf).join(", ") })]
          : []),
        ...(e.teams[s].noTank ? [t("pages.draftSimulatorUI.estimate.facts.tank", { side: side(s) })] : []),
      ]);
      return parts.length ? parts.join(" · ") : none;
    }
    case "damage": {
      const parts = (["blue", "red"] as const).flatMap((s) => {
        const d = e.teams[s].oneDamage;
        return d ? [t(`pages.draftSimulatorUI.estimate.facts.damage.${d}`, { side: side(s) })] : [];
      });
      return parts.length ? parts.join(" · ") : none;
    }
  }
}

/** A suggested pick's argument, in one short clause. */
export function pickReasonText(
  r: PickReason,
  t: T,
  f: NumberFormats,
  nameOf: (slug: string) => string,
  damageLabels: Record<string, string>,
): string {
  switch (r.type) {
    case "counter":
      return r.measured
        ? t("pages.draftSimulatorUI.reasons.counter", { names: r.targets.map(nameOf).join(", "), pts: f.signed(r.points) })
        : t("pages.draftSimulatorUI.reasons.counterWiki", { names: r.targets.map(nameOf).join(", ") });
    case "duo":
      return r.measured
        ? t("pages.draftSimulatorUI.reasons.duo", { names: r.partners.map(nameOf).join(", "), pts: f.signed(r.points) })
        : t("pages.draftSimulatorUI.reasons.duoWiki", { names: r.partners.map(nameOf).join(", ") });
    case "strength":
      return t("pages.draftSimulatorUI.reasons.strength", { rate: f.decimal(r.rate) });
    case "lane":
      return t("pages.draftSimulatorUI.reasons.lane", { lane: t(`lanes.${r.lane}`) });
    case "tank":
      return t("pages.draftSimulatorUI.estimate.reasons.tank");
    case "damage":
      return t("pages.draftSimulatorUI.estimate.reasons.damage", { type: damageLabels[r.damage] ?? r.damage });
  }
}

