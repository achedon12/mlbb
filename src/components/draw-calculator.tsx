"use client";

import { useEffect, useId, useRef, useState } from "react";
import { classesPuce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  LIMITS,
  PRESETS,
  analyze,
  curve,
  diamondsFor,
  parseInteger,
  parsePercent,
  tenDrawPays,
  type DrawEvent,
  type DrawField,
  type Preset,
} from "@/lib/draw-odds";
import { cn } from "@/lib/utils";

/**
 * Draw odds calculator: chance of getting the prize for a budget or a number
 * of draws, average, milestones and chart. Everything is computed in the
 * browser, on every keystroke.
 */

type Mode = "budget" | "draws";

interface Inputs {
  cost: string;
  tenCost: string;
  chance: string;
  pity: string;
  budget: string;
  draws: string;
}

function Field({
  label,
  value,
  onChange,
  suffix,
  decimal = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  decimal?: boolean;
  /** Message shown under the field when the input is rejected. */
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-craie-500">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "biseau-sm min-h-11 w-full border border-nuit-700 bg-nuit-900 py-2.5 pl-3 text-lg tabular-nums text-craie-100 outline-none transition-colors focus:border-or-500 aria-invalid:border-sang-500/70",
            suffix ? "pr-9" : "pr-3",
          )}
        />
        {suffix && (
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-craie-500">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-sang-500">
          {error}
        </p>
      )}
    </div>
  );
}

/** Optional field: empty means "none", unreadable input becomes NaN so it gets flagged. */
const optional = (s: string) => (s.trim() === "" ? null : (parseInteger(s) ?? Number.NaN));

/** Upper bound shown in each field's error message. */
const FIELD_MAX: Record<DrawField, number> = {
  cost: LIMITS.cost,
  tenCost: LIMITS.tenCost,
  chance: 100,
  pity: LIMITS.pity,
  budget: LIMITS.budget,
  draws: LIMITS.draws,
};

export function DrawCalculator() {
  const t = useT();
  const locale = LOCALE_HTML[useLangue()];
  const integer = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const oneDecimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const finePercent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });

  const toInputs = (e: DrawEvent) => ({
    cost: String(e.cost),
    tenCost: e.tenCost === null ? "" : String(e.tenCost),
    chance: decimal.format(e.chance),
    pity: e.pity === null ? "" : String(e.pity),
  });

  // Start on a real event, so the page shows a meaningful result right away.
  const [inputs, setInputs] = useState<Inputs>(() => ({
    ...toInputs(PRESETS[1].event),
    budget: integer.format(1000),
    draws: "100",
  }));
  const [mode, setMode] = useState<Mode>("budget");
  const update = (field: keyof Inputs) => (v: string) => setInputs((s) => ({ ...s, [field]: v }));

  const event: DrawEvent = {
    cost: parseInteger(inputs.cost) ?? Number.NaN,
    tenCost: optional(inputs.tenCost),
    chance: parsePercent(inputs.chance) ?? Number.NaN,
    pity: optional(inputs.pity),
  };
  const result = analyze(
    event,
    mode === "budget"
      ? { type: "budget", diamonds: parseInteger(inputs.budget) ?? Number.NaN }
      : { type: "draws", count: parseInteger(inputs.draws) ?? Number.NaN },
  );
  const errors = new Set<DrawField>(result.state === "invalid" ? result.errors : []);
  const errorFor = (field: DrawField) =>
    errors.has(field)
      ? t(`pages.drawCalculatorUI.error.${field}`, {
          max: integer.format(FIELD_MAX[field]),
          // The minimum has four decimals: the two-decimal formatter would print it as 0.
          min: new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(LIMITS.minChance),
        })
      : undefined;

  /** Chance as a percentage, never showing 0 % or 100 % for a value that is not exactly that. */
  const chance = (p: number) => {
    if (p >= 1) return percent.format(1);
    if (p <= 0) return percent.format(0);
    if (p < 0.0001) return `< ${finePercent.format(0.0001)}`;
    if (p > 0.9999) return `> ${finePercent.format(0.9999)}`;
    return p < 0.01 || p > 0.99 ? finePercent.format(p) : percent.format(p);
  };

  const activePreset = PRESETS.find((p) => {
    const s = toInputs(p.event);
    return s.cost === inputs.cost && s.tenCost === inputs.tenCost && s.chance === inputs.chance && s.pity === inputs.pity;
  });
  const wikiDate = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <Carte>
        <fieldset>
          <legend className="text-xs uppercase tracking-wide text-craie-500">{t("pages.drawCalculatorUI.presets")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={activePreset?.key === p.key}
                onClick={() => setInputs((s) => ({ ...s, ...toInputs(p.event) }))}
                className={cn(classesPuce(activePreset?.key === p.key), "min-h-11 text-left")}
              >
                {p.name} · {t(`pages.drawCalculatorUI.prize.${p.key}`)}
              </button>
            ))}
          </div>
        </fieldset>
        {activePreset && (
          <PresetNote preset={activePreset} date={wikiDate.format(new Date(`${activePreset.checked}T00:00:00Z`))} />
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={t("pages.drawCalculatorUI.cost")} value={inputs.cost} onChange={update("cost")} error={errorFor("cost")} />
          <Field
            label={t("pages.drawCalculatorUI.tenCost")}
            value={inputs.tenCost}
            onChange={update("tenCost")}
            error={errorFor("tenCost")}
          />
          <Field
            label={t("pages.drawCalculatorUI.chance")}
            value={inputs.chance}
            onChange={update("chance")}
            suffix="%"
            decimal
            error={errorFor("chance")}
          />
          <Field label={t("pages.drawCalculatorUI.pity")} value={inputs.pity} onChange={update("pity")} error={errorFor("pity")} />
        </div>
        {result.state === "ok" && event.tenCost !== null && !tenDrawPays(event) && (
          <p className="mt-3 text-xs text-craie-500">{t("pages.drawCalculatorUI.tenIgnored")}</p>
        )}

        <fieldset className="mt-6 border-t border-nuit-800 pt-5">
          <legend className="sr-only">{t("pages.drawCalculatorUI.modeLegend")}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden className="mr-1 text-xs uppercase tracking-wide text-craie-500">
              {t("pages.drawCalculatorUI.modeLegend")}
            </span>
            {(["budget", "draws"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(classesPuce(mode === m), "min-h-11")}
              >
                {t(m === "budget" ? "pages.drawCalculatorUI.modeBudget" : "pages.drawCalculatorUI.modeDraws")}
              </button>
            ))}
          </div>
          <div className="mt-4 max-w-xs">
            {mode === "budget" ? (
              <Field
                label={t("pages.drawCalculatorUI.budget")}
                value={inputs.budget}
                onChange={update("budget")}
                error={errorFor("budget")}
              />
            ) : (
              <Field
                label={t("pages.drawCalculatorUI.draws")}
                value={inputs.draws}
                onChange={update("draws")}
                error={errorFor("draws")}
              />
            )}
          </div>
        </fieldset>
      </Carte>

      <div aria-live="polite">
        {result.state === "invalid" ? (
          <Carte>
            <p className="text-sm leading-relaxed text-craie-300">{t("pages.drawCalculatorUI.invalid")}</p>
          </Carte>
        ) : (
          <Carte className="border-or-500/30">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-titre text-5xl font-bold tabular-nums text-or-400">{chance(result.chance)}</span>
              <span className="text-lg text-craie-100">{t("pages.drawCalculatorUI.chanceOfPrize")}</span>
            </p>
            <p className="mt-3 leading-relaxed text-craie-300">
              {result.draws === 0
                ? t("pages.drawCalculatorUI.summaryNone", { cost: integer.format(event.cost) })
                : t(mode === "budget" ? "pages.drawCalculatorUI.summaryBudget" : "pages.drawCalculatorUI.summaryDraws", {
                    diamonds: integer.format(result.diamonds),
                    draws: integer.format(result.draws),
                    chance: chance(result.chance),
                  })}{" "}
              {t("pages.drawCalculatorUI.summaryAverage", {
                draws: oneDecimal.format(result.expectedDraws),
                // Drawing by ten is only cheaper on average when the prize is slow to come: keep the better way.
                diamonds: integer.format(Math.round(Math.min(result.expectedDiamondsSingle, result.expectedDiamondsTen ?? Infinity))),
              })}{" "}
              {event.pity !== null &&
                t("pages.drawCalculatorUI.summaryPity", {
                  n: integer.format(event.pity),
                  diamonds: integer.format(diamondsFor(event.pity, event)),
                })}
            </p>
          </Carte>
        )}
      </div>

      {result.state === "ok" && (
        <>
          <Carte>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Stat label={t("pages.drawCalculatorUI.statDraws")} value={integer.format(result.draws)} />
              <Stat label={t("pages.drawCalculatorUI.statDiamonds")} value={integer.format(result.diamonds)} />
              <Stat label={t("pages.drawCalculatorUI.statAverageDraws")} value={oneDecimal.format(result.expectedDraws)} />
              <Stat
                label={t("pages.drawCalculatorUI.statAverageSingle")}
                value={integer.format(Math.round(result.expectedDiamondsSingle))}
              />
              {result.expectedDiamondsTen !== null && (
                <Stat
                  label={t("pages.drawCalculatorUI.statAverageTen")}
                  value={integer.format(Math.round(result.expectedDiamondsTen))}
                />
              )}
            </dl>

            <h2 className="mt-6 font-titre text-lg font-bold text-craie-100">{t("pages.drawCalculatorUI.milestonesTitle")}</h2>
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">{t("pages.drawCalculatorUI.colChance")}</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">{t("pages.drawCalculatorUI.colDraws")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("pages.drawCalculatorUI.colDiamonds")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.milestones.map((m) => (
                    <tr key={m.target} className="border-b border-nuit-800">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-craie-100">{percent.format(m.target)}</th>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-craie-200">{integer.format(m.draws)}</td>
                      <td className="py-2.5 text-right tabular-nums text-craie-200">{integer.format(m.diamonds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          <Carte>
            <h2 className="font-titre text-lg font-bold text-craie-100">{t("pages.drawCalculatorUI.chartTitle")}</h2>
            <DrawChart
              event={event}
              draws={result.draws}
              chance={result.chance}
              milestones={result.milestones.map((m) => m.draws)}
              label={t("pages.drawCalculatorUI.chartLabel", {
                p50: integer.format(result.milestones[0].draws),
                p90: integer.format(result.milestones[1].draws),
                p99: integer.format(result.milestones[2].draws),
              })}
              format={{ integer, percent, chance }}
              texts={{
                axis: t("pages.drawCalculatorUI.axisDraws"),
                you: t("pages.drawCalculatorUI.you"),
                pity: t("pages.drawCalculatorUI.pityChart"),
              }}
            />
          </Carte>
        </>
      )}

      <p className="text-sm leading-relaxed text-craie-500">{t("pages.drawCalculatorUI.whereToFind")}</p>
    </div>
  );
}

function PresetNote({ preset, date }: { preset: Preset; date: string }) {
  const t = useT();
  return (
    <p className="mt-3 text-xs leading-relaxed text-craie-500">
      {t("pages.drawCalculatorUI.presetNote", { date, prize: t(`pages.drawCalculatorUI.prize.${preset.key}`) })}{" "}
      {/* Inline link, but with a full-size tap target on touch screens. */}
      <a
        href={preset.source}
        rel="noopener"
        className="inline-flex min-h-11 items-center align-middle underline transition-colors hover:text-or-400"
      >
        {t("pages.drawCalculatorUI.wikiLink")}
      </a>
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-nuit-800 pb-2">
      <dt className="text-sm text-craie-400">{label}</dt>
      <dd className="font-titre text-lg font-bold tabular-nums text-craie-100">{value}</dd>
    </div>
  );
}

// Drawing height and margins, in pixels: the width follows the frame's.
const H = 220;
const LEFT = 44;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 28;
const GRIDLINES = [0, 0.5, 0.9, 1];

/**
 * Cumulative chance by number of draws, in SVG. The axis runs a little past
 * the 99 % milestone, and past the user's point while it stays readable; the
 * pity step is drawn as it is.
 */
function DrawChart({
  event,
  draws,
  chance,
  milestones,
  label,
  format,
  texts,
}: {
  event: DrawEvent;
  draws: number;
  chance: number;
  milestones: number[];
  label: string;
  format: { integer: Intl.NumberFormat; percent: Intl.NumberFormat; chance: (p: number) => string };
  texts: { axis: string; you: string; pity: string };
}) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const frame = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const p99 = milestones[milestones.length - 1];
  // Past three times the 99 % milestone the curve is only a plateau: the point leaves the frame instead.
  const max = Math.max(10, Math.ceil(Math.max(p99 * 1.15, Math.min(draws, p99 * 3))));
  const points = curve(event, max, 160);
  const x = (n: number) => LEFT + (Math.min(n, max) / max) * (W - LEFT - RIGHT);
  const y = (p: number) => TOP + (1 - p) * (H - TOP - BOTTOM);
  const path = points.map((pt, i) => `${i ? "L" : "M"}${x(pt.n).toFixed(1)},${y(pt.p).toFixed(1)}`).join("");
  const area = `${path}L${x(max)},${y(0)}L${x(0)},${y(0)}Z`;
  const offChart = draws > max;
  const onRight = x(draws) > W / 2;
  const pityOnRight = event.pity !== null && x(event.pity) > W / 2;

  return (
    <div ref={frame} className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-[220px] w-full select-none text-or-400">
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {GRIDLINES.map((g) => (
          <g key={g}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(g)} y2={y(g)} className="stroke-nuit-700" strokeDasharray="3 4" />
            <text x={LEFT - 6} y={y(g) + 4} textAnchor="end" className="fill-craie-500 text-[11px] tabular-nums">
              {format.percent.format(g)}
            </text>
          </g>
        ))}
        {[0, Math.round(max / 2), max].map((n, i) => (
          <text
            key={i}
            x={x(n)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            className="fill-craie-500 text-[11px] tabular-nums"
          >
            {i === 2 ? `${format.integer.format(n)} ${texts.axis}` : format.integer.format(n)}
          </text>
        ))}

        {event.pity !== null && event.pity <= max && (
          <g>
            <line x1={x(event.pity)} x2={x(event.pity)} y1={TOP} y2={y(0)} className="stroke-azur-400/70" strokeDasharray="2 3" />
            <text
              x={x(event.pity) + (pityOnRight ? -4 : 4)}
              y={y(0) - 6}
              textAnchor={pityOnRight ? "end" : "start"}
              className="fill-azur-400 text-[10px]"
            >
              {texts.pity}
            </text>
          </g>
        )}

        <path d={area} fill={`url(#${id}-area)`} />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />

        {draws > 0 && (
          <g>
            <line x1={x(draws)} x2={x(draws)} y1={y(chance)} y2={y(0)} className="stroke-craie-500/60" strokeDasharray="3 3" />
            <circle cx={x(draws)} cy={y(chance)} r={5} fill="currentColor" className="stroke-nuit-950" strokeWidth={2} />
            <text
              x={x(draws) + (onRight ? -9 : 9)}
              y={Math.min(Math.max(y(chance) + 16, TOP + 12), y(0) - 20)}
              textAnchor={onRight ? "end" : "start"}
              paintOrder="stroke"
              strokeWidth={4}
              strokeLinejoin="round"
              className="fill-craie-100 stroke-nuit-900 text-[12px] font-semibold tabular-nums"
            >
              {`${texts.you}${offChart ? " →" : ""} · ${format.chance(chance)}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
