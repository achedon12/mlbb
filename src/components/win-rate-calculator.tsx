"use client";

import { useId, useState } from "react";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { FilterGroup, Chip } from "@/components/chip";
import { Card } from "@/components/ui";
import { compute, readCount, matchesAuPace, type Situation } from "@/lib/win-rate";

/**
 * Win rate calculator: how many wins in a row to reach a target, and how many
 * games at a given pace. Everything is computed in the browser, on every
 * keystroke; no request.
 */
const OBJECTIVES = [50, 55, 60, 65, 70];

function Field({
  label,
  value,
  onChange,
  suffix,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  invalid: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-chalk-500">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className="bevel-sm w-full border border-night-700 bg-night-900 py-2.5 pl-3 pr-9 text-lg tabular-nums text-chalk-100 outline-none transition-colors focus:border-gold-500 aria-invalid:border-blood-500/70"
        />
        {suffix && (
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-chalk-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function WinRateCalculator() {
  const t = useT();
  const locale = useLocale();
  const count = new Intl.NumberFormat(LOCALE_HTML[locale], { maximumFractionDigits: 2 });
  // Sample values, written with the locale's decimal separator.
  const [matches, setMatches] = useState("250");
  const [rate, setRate] = useState(() => count.format(48.5));
  const [objective, setObjective] = useState("55");
  const [pace, setPace] = useState("60");

  const readValues = { matches: readCount(matches), rate: readCount(rate), objective: readCount(objective) };
  const situation: Situation = {
    matches: readValues.matches ?? Number.NaN,
    rate: readValues.rate ?? Number.NaN,
    objective: readValues.objective ?? Number.NaN,
  };
  const result = compute(situation);
  // « 55 % » in French, « 55% » in English: the space follows the locale.
  const percentage = new Intl.NumberFormat(LOCALE_HTML[locale], { style: "percent", maximumFractionDigits: 2 });
  const percent = (p: number) => percentage.format(p / 100);
  const outOfRange = (p: number | null, integer = false) =>
    p !== null && (integer ? !Number.isInteger(p) || p < 1 : p < 0 || p > 100);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t("winRateTool.games")}
            value={matches}
            onChange={setMatches}
            invalid={outOfRange(readValues.matches, true)}
          />
          <Field
            label={t("winRateTool.currentRate")}
            value={rate}
            onChange={setRate}
            suffix="%"
            invalid={outOfRange(readValues.rate)}
          />
          <Field
            label={t("winRateTool.objective")}
            value={objective}
            onChange={setObjective}
            suffix="%"
            invalid={outOfRange(readValues.objective)}
          />
        </div>
        <FilterGroup legend={t("winRateTool.commonTargets")} widthLegend="w-auto" className="mt-5">
          {OBJECTIVES.map((o) => (
            <Chip key={o} dense active={readValues.objective === o} onClick={() => setObjective(String(o))}>
              {percent(o)}
            </Chip>
          ))}
        </FilterGroup>
      </Card>

      <div aria-live="polite">
        {result.state === "invalid" ? (
          <Card>
            <p className="text-sm leading-relaxed text-chalk-300">{t("winRateTool.invalid")}</p>
          </Card>
        ) : (
          <Card className="border-gold-500/30">
            {result.state === "wins" && (
              <>
                <Figure value={count.format(result.wins)} unit={t("winRateTool.winsInARow")} />
                <p className="mt-3 leading-relaxed text-chalk-300">
                  {t("winRateTool.winsSentence", {
                    n: count.format(result.wins),
                    current: percent(situation.rate),
                    objective: percent(situation.objective),
                    total: count.format(situation.matches + result.wins),
                  })}
                </p>
              </>
            )}
            {result.state === "impossible" && (
              <>
                <p className="font-heading text-2xl font-bold text-blood-500">{t("winRateTool.impossibleTitle")}</p>
                <p className="mt-3 leading-relaxed text-chalk-300">{t("winRateTool.impossible")}</p>
                {(() => {
                  const fallback = compute({ ...situation, objective: 99 });
                  return fallback.state === "wins" ? (
                    <p className="mt-2 text-sm leading-relaxed text-chalk-400">
                      {t("winRateTool.impossibleAdvice", { objective: percent(99), n: count.format(fallback.wins) })}
                    </p>
                  ) : null;
                })()}
              </>
            )}
            {result.state === "reached" && (
              <>
                <Figure
                  value={result.margin === null ? "∞" : count.format(result.margin)}
                  unit={t("winRateTool.lossesAffordable")}
                />
                <p className="mt-3 leading-relaxed text-chalk-300">
                  {result.margin === null
                    ? t("winRateTool.zeroSentence")
                    : result.margin === 0
                      ? t("winRateTool.limitSentence", { objective: percent(situation.objective) })
                      : t("winRateTool.reachedSentence", {
                          n: count.format(result.margin),
                          objective: percent(situation.objective),
                        })}
                </p>
              </>
            )}
            <p className="mt-4 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
              {t("winRateTool.base", {
                v: count.format(result.currentWins),
                n: count.format(situation.matches),
              })}
            </p>
          </Card>
        )}
      </div>

      {result.state === "wins" && (
        <Card>
          <h2 className="font-heading text-lg font-bold text-chalk-100">{t("winRateTool.paceTitle")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-chalk-500">{t("winRateTool.paceIntro")}</p>
          <div className="mt-4 max-w-48">
            <Field
              label={t("winRateTool.pace")}
              value={pace}
              onChange={setPace}
              suffix="%"
              invalid={outOfRange(readCount(pace))}
            />
          </div>
          <div aria-live="polite" className="mt-4 text-sm leading-relaxed text-chalk-300">
            {(() => {
              const r = readCount(pace);
              if (r === null || outOfRange(r)) return null;
              const m = matchesAuPace(situation, r);
              return m === null
                ? t("winRateTool.paceTooLow", { pace: percent(r), objective: percent(situation.objective) })
                : t("winRateTool.paceGames", { n: count.format(m), pace: percent(r) });
            })()}
          </div>
        </Card>
      )}
    </div>
  );
}

function Figure({ value, unit }: { value: string; unit: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-heading text-5xl font-bold tabular-nums text-gold-400">{value}</span>
      <span className="text-lg text-chalk-100">{unit}</span>
    </p>
  );
}
