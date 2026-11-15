"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ChevronRight, Download, RotateCcw, Share2 } from "lucide-react";
import { Chip, FilterGroup, classesChip } from "@/components/chip";
import { Card } from "@/components/ui";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import {
  BINDINGS,
  CURRENCIES,
  DEFAULT_INPUTS,
  MAX_DIAMONDS,
  MAX_GROUP_POINTS,
  POINT_GROUPS,
  MAX_PER_TIER,
  RANKS,
  clampInputs,
  convert,
  countsFromCollection,
  estimate,
  readParams,
  roughly,
  writeParams,
  type Assumptions,
  type Currency,
  type Inputs,
  type Model,
  type PointGroup,
  type Rank,
  type Tier,
  type TierCost,
} from "@/lib/account-value";
import { KEY_COLLECTION, readOwnership } from "@/lib/collection";
import type { PanelReading } from "@/lib/showcase-ocr";
import { ShowcaseScan } from "@/components/showcase-scan";
import { readSyncedCollection } from "@/lib/collection-sync-client";
import { loadCatalog } from "@/lib/skin-catalog";
import { trackEvent, trackShare } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** A whole number typed in a field; empty reads as zero. */
const readCount = (text: string) => {
  const n = Number(text.replace(/[\s,.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

function NumberField({
  label,
  hint,
  value,
  max,
  showMax = true,
  mark,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  max: number;
  /** "/ 103" after the value: how many exist in the game; off for a bare bound. */
  showMax?: boolean;
  /** Filled from a screenshot: confirmed by the row's points, or to check by hand. */
  mark?: Mark;
  onChange: (n: number) => void;
}) {
  const t = useT();
  const id = useId();
  const locale = useLocale();
  const count = new Intl.NumberFormat(LOCALE_INTL[locale]);
  return (
    <div>
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-chalk-200">
        {label}
        {mark && (
          <span className={cn("text-xs font-medium", mark === "check" ? "text-rose-400" : "text-gold-400")}>
            {t(`pages.accountValueUI.scan.${mark}`)}
          </span>
        )}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value ? String(value) : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.min(max, readCount(e.target.value)))}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={mark === "check" || undefined}
          className={cn(
            "bevel-sm w-full border border-night-700 bg-night-900 py-2 pl-3 tabular-nums text-chalk-100 outline-none transition-colors placeholder:text-chalk-600 focus:border-gold-500",
            showMax ? "pr-14" : "pr-3",
            mark === "detected" && "border-gold-500/70 bg-gold-500/5",
            mark === "check" && "border-rose-500/80 bg-rose-500/5",
          )}
        />
        {showMax && (
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-chalk-500">
            / {count.format(max)}
          </span>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-chalk-500">
          {hint}
        </p>
      )}
    </div>
  );
}

type Mark = "detected" | "check";

const COST_HINT: Record<TierCost["basis"], string> = {
  shop: "pages.accountValueUI.costShop",
  draw: "pages.accountValueUI.costDraw",
  flat: "pages.accountValueUI.costFlat",
};

/**
 * Where the counts are in the game, with a sketch of one row of the
 * Showcase overview: the number to copy is the first one.
 */
function WhereToFind() {
  const t = useT();
  const locale = useLocale();
  const steps = t("pages.accountValueUI.wherePath")
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="bevel-sm mt-5 flex flex-col gap-4 border border-night-700/70 bg-night-900/60 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-chalk-100">{t("pages.accountValueUI.whereTitle")}</p>
        <ol className="mt-2 flex flex-wrap items-center gap-1 text-sm" aria-label={t("pages.accountValueUI.wherePath")}>
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} aria-hidden className="text-chalk-500" />}
              <span className="bevel-sm border border-gold-500/30 bg-gold-500/5 px-2 py-0.5 font-medium text-gold-400">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs leading-relaxed text-chalk-400">{t("pages.accountValueUI.whereHint")}</p>
      </div>
      {/* A sketch of one row, not a capture: the highlighted number is the one to type. */}
      <div aria-hidden className="bevel-sm w-full shrink-0 border border-night-700 bg-night-950/70 p-3 text-xs sm:w-52">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-chalk-200">{t("pages.accountValueUI.tier.grand")}</span>
          <span className="tabular-nums text-chalk-400">
            <span className="rounded-sm bg-gold-500/20 px-1 font-bold text-gold-400 ring-1 ring-gold-500/60">12</span>/111
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-night-800">
          <div className="h-full w-[11%] bg-gold-500/70" />
        </div>
        <p className="mt-1.5 text-right tabular-nums text-chalk-500">{new Intl.NumberFormat(LOCALE_INTL[locale]).format(36000)}</p>
      </div>
    </div>
  );
}

/**
 * Account value estimator. Everything is computed in the browser from the
 * counts typed in; the counts go into the address so the result can be
 * shared, and nothing else is kept. The collection tool's save is only read
 * when the player asks for it.
 */
export function AccountValueEstimator({ model, assumptions }: { model: Model; assumptions: Assumptions }) {
  const t = useT();
  const locale = useLocale();
  const html = LOCALE_INTL[locale];
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState<"" | "busy" | "done" | "failed">("");
  const [imported, setImported] = useState({ n: 0, unmapped: 0 });
  const [marks, setMarks] = useState<Partial<Record<Tier | PointGroup, Mark>>>({});
  const [share, setShare] = useState<"" | "copied" | "shared" | "failed">("");

  // The address and the collection save are only readable in the browser.
  useEffect(() => {
    const read = readParams(window.location.search);
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY_COLLECTION);
    } catch {
      // Storage refused: no import offered.
    }
    const owned = readOwnership(raw);
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL and the save after mount */
    setInputs(clampInputs(read.inputs, model));
    setCurrency(read.currency);
    setSaved(owned.skins.length > 0 || owned.heros.length > 0);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Signed in, the collection may live on the account only (ticked on another device).
    let cancelled = false;
    readSyncedCollection().then(
      (o) => !cancelled && (o.skins.length > 0 || o.heros.length > 0) && setSaved(true),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [model]);

  useEffect(() => {
    if (!ready) return;
    window.history.replaceState(null, "", `${window.location.pathname}${writeParams(inputs, currency)}`);
  }, [ready, inputs, currency]);

  const result = useMemo(() => estimate(inputs, model, assumptions), [inputs, model, assumptions]);
  const count = useMemo(() => new Intl.NumberFormat(html), [html]);
  // Rounded to two significant figures: cents are only shown on amounts under 100.
  const money = (usd: number, c: Currency = currency) => {
    const value = roughly(convert(usd, c, assumptions));
    const decimals = value >= 100 || c === "IDR" ? 0 : 2;
    return new Intl.NumberFormat(html, {
      style: "currency",
      currency: c,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };
  const ownedSkins = Object.values(inputs.skins).reduce((a, b) => a + (b ?? 0), 0);
  const groupPoints = Object.values(inputs.points).reduce((a, b) => a + (b ?? 0), 0);
  const empty = ownedSkins === 0 && groupPoints === 0 && inputs.diamonds === 0;

  const set = (patch: Partial<Inputs>) => {
    setInputs((before) => clampInputs({ ...before, ...patch }, model));
    setShare("");
  };
  // A value typed over a detected one is the player's own.
  const unmark = (key: Tier | PointGroup) =>
    setMarks((before) => {
      const rest = { ...before };
      delete rest[key];
      return rest;
    });
  const setSkin = (tier: Tier, n: number) => {
    set({ skins: { ...inputs.skins, [tier]: n } });
    unmark(tier);
  };
  const setPoints = (group: PointGroup, n: number) => {
    set({ points: { ...inputs.points, [group]: n } });
    unmark(group);
  };
  const catalogCounts = useMemo(
    () => Object.fromEntries(model.tiers.filter((x) => x.count != null).map((x) => [x.tier, x.count!])) as Partial<Record<Tier, number>>,
    [model],
  );
  /** One panel read: its fields are replaced, the others' kept, with their marks. */
  function fromScreenshot(panel: PanelReading) {
    if (panel.kind === "items") {
      const r = panel.reading;
      set({ points: { ...inputs.points, [r.group]: r.points } });
      setMarks((before) => ({ ...before, [r.group]: r.header?.matches ? "detected" : "check" }));
      return;
    }
    const reading = panel.reading;
    const skins = { ...inputs.skins };
    const next: Partial<Record<Tier | PointGroup, Mark>> = {};
    for (const r of reading.rows) {
      skins[r.tier] = r.owned;
      // The header total matching the rows confirms every one of them.
      next[r.tier] = r.checked || reading.header?.matches ? "detected" : "check";
    }
    const points = { ...inputs.points };
    if (reading.shining != null) {
      points.shining = reading.shining;
      next.shining = reading.header?.matches ? "detected" : "check";
    }
    set({ skins, points });
    setMarks((before) => {
      const kept = Object.fromEntries(Object.entries(before).filter(([k]) => k === "inMatch" || k === "outMatch"));
      return { ...kept, ...next };
    });
  }

  async function importCollection() {
    setImporting("busy");
    try {
      const [catalog, owned] = await Promise.all([loadCatalog(locale), readSyncedCollection()]);
      const counts = countsFromCollection(owned, catalog);
      const n = Object.values(counts.skins).reduce((a, b) => a + (b ?? 0), 0);
      // The colour variants are not in the catalogue: what was typed for them stays.
      set({ skins: { ...counts.skins, painted: inputs.skins.painted }, heroes: counts.heroes });
      setImported({ n, unmapped: counts.unmapped });
      setImporting("done");
      trackEvent("Account value", "Import", undefined, n);
    } catch {
      setImporting("failed");
    }
  }

  async function shareResult() {
    const url = window.location.href;
    const text = result.resale
      ? t("pages.accountValueUI.shareText", { cost: money(result.usd), low: money(result.resale.low), high: money(result.resale.high) })
      : t("pages.accountValueUI.shareTextCost", { cost: money(result.usd) });
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("pages.accountValueUI.resultTitle"), text, url });
        setShare("shared");
        trackShare("Account value", "native");
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShare("copied");
      trackShare("Account value", "clipboard");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShare("failed");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {/* ── Result ────────────────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:order-2" aria-labelledby="result-title">
        <Card className="border-gold-500/30">
          <h2 id="result-title" className="text-xs uppercase tracking-wide text-chalk-500">
            {t("pages.accountValueUI.costTitle")}
          </h2>
          <div aria-live="polite">
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-heading text-4xl font-bold tabular-nums text-gold-400">
                ≈ {count.format(roughly(result.totalDiamonds))}
              </span>
              <span className="text-chalk-100">{t("skinsUI.diamonds").toLowerCase()}</span>
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-chalk-100">≈ {money(result.usd)}</p>

            <h3 className="mt-5 border-t border-night-800 pt-4 text-xs uppercase tracking-wide text-chalk-500">
              {t("pages.accountValueUI.pointsTitle")}
            </h3>
            {/* Exact, not rounded: it is meant to match the game's own total. */}
            <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-chalk-100">{count.format(result.points)}</p>
            {groupPoints > 0 && (
              <p className="mt-0.5 text-xs tabular-nums text-chalk-400">
                {t("pages.accountValueUI.pointsSplit", {
                  skins: count.format(result.skinPoints),
                  items: count.format(result.points - result.skinPoints),
                })}
              </p>
            )}
            <p className="mt-1 text-xs leading-relaxed text-chalk-500">{t("pages.accountValueUI.pointsCheck")}</p>

            <h3 className="mt-5 border-t border-night-800 pt-4 text-xs uppercase tracking-wide text-chalk-500">
              {t("pages.accountValueUI.resaleTitle")}
            </h3>
            {result.resale ? (
              <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-chalk-100">
                {t("pages.accountValueUI.range", { low: money(result.resale.low), high: money(result.resale.high) })}
              </p>
            ) : (
              <p className="mt-1 text-sm text-chalk-300">
                {inputs.binding === "none" ? t("pages.accountValueUI.resaleUnbound") : t("pages.accountValueUI.resaleEmpty")}
              </p>
            )}
          </div>

          <FilterGroup legend={t("pages.accountValueUI.currency")} widthLegend="w-auto" className="mt-4">
            {CURRENCIES.map((c) => (
              <Chip key={c} dense active={currency === c} onClick={() => setCurrency(c)}>
                {c}
              </Chip>
            ))}
          </FilterGroup>

          <p className="mt-4 text-xs leading-relaxed text-chalk-500">
            {t("pages.accountValueUI.indicative", {
              date: new Intl.DateTimeFormat(html, { dateStyle: "long", timeZone: "UTC" }).format(
                Date.parse(`${assumptions.ratesDate}T00:00:00Z`),
              ),
            })}
          </p>

          {!empty && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-night-800 pt-4">
              <button type="button" onClick={shareResult} className={cn(classesChip(true), "inline-flex items-center gap-2")}>
                <Share2 size={15} aria-hidden />
                {t("pages.accountValueUI.share")}
              </button>
              <button
                type="button"
                onClick={() => {
                  set(DEFAULT_INPUTS);
                  setMarks({});
                }}
                className={cn(classesChip(false), "inline-flex items-center gap-2")}
              >
                <RotateCcw size={15} aria-hidden />
                {t("pages.accountValueUI.reset")}
              </button>
              <p aria-live="polite" className="w-full text-xs text-chalk-500">
                {share && t(`pages.accountValueUI.share_${share}`)}
              </p>
            </div>
          )}
        </Card>
      </aside>

      {/* ── Inputs ────────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-8 lg:order-1">
        {saved && (
          <div className="bevel-sm flex flex-wrap items-center gap-3 border border-night-700/70 bg-night-900/60 p-3">
            <p className="min-w-0 flex-1 text-sm text-chalk-300">{t("pages.accountValueUI.importLead")}</p>
            <button
              type="button"
              onClick={importCollection}
              disabled={importing === "busy"}
              className={cn(classesChip(false), "inline-flex items-center gap-2 disabled:opacity-60")}
            >
              <Download size={15} aria-hidden />
              {t("pages.accountValueUI.import")}
            </button>
            <div aria-live="polite" className="w-full space-y-0.5 text-xs text-chalk-500 empty:hidden">
              {importing === "failed" && <p>{t("pages.accountValueUI.import_failed")}</p>}
              {importing === "done" && (
                <>
                  <p>{t("pages.accountValueUI.import_done", { n: count.format(imported.n) })}</p>
                  {imported.unmapped > 0 && (
                    <p className="text-gold-400">{t("pages.accountValueUI.import_unmapped", { n: count.format(imported.unmapped) })}</p>
                  )}
                  <p>{t("pages.accountValueUI.import_variants")}</p>
                </>
              )}
            </div>
          </div>
        )}

        <section aria-labelledby="showcase-title">
          <h2 id="showcase-title" className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
            {t("pages.accountValueUI.skinsTitle")}
          </h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <WhereToFind />
          <ShowcaseScan catalog={catalogCounts} onRead={fromScreenshot}>
            <fieldset className="mt-6">
              <legend className="text-base font-semibold text-chalk-100">{t("pages.accountValueUI.skinsLegend")}</legend>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 xl:grid-cols-4">
                {model.tiers.map((tier) => (
                  <NumberField
                    key={tier.tier}
                    label={t(`pages.accountValueUI.tier.${tier.tier}`)}
                    hint={`${t("pages.accountValueUI.pointsEach", { points: count.format(tier.points) })} · ${t(COST_HINT[tier.basis], {
                      n: count.format(tier.cost),
                    })}`}
                    value={inputs.skins[tier.tier] ?? 0}
                    max={MAX_PER_TIER}
                    showMax={false}
                    mark={marks[tier.tier]}
                    onChange={(n) => setSkin(tier.tier, n)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-6">
              <legend className="text-base font-semibold text-chalk-100">{t("pages.accountValueUI.pointsLegend")}</legend>
              <p className="mt-1 text-xs leading-relaxed text-chalk-400">{t("pages.accountValueUI.pointsLead")}</p>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 xl:grid-cols-3">
                {POINT_GROUPS.map((g) => (
                  <NumberField
                    key={g}
                    label={t(`pages.accountValueUI.group.${g}`)}
                    hint={`${t(`pages.accountValueUI.groupWhere.${g}`)} · ${t("pages.accountValueUI.costPoint", {
                      n: new Intl.NumberFormat(html, { maximumFractionDigits: 2 }).format(assumptions.pointCost[g]),
                    })}`}
                    value={inputs.points[g] ?? 0}
                    max={MAX_GROUP_POINTS}
                    showMax={false}
                    mark={marks[g]}
                    onChange={(n) => setPoints(g, n)}
                  />
                ))}
              </div>
            </fieldset>
          </ShowcaseScan>
        </section>

        <fieldset>
          <legend className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
            {t("pages.accountValueUI.accountTitle")}
          </legend>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 xl:grid-cols-3">
            <label className="block">
              <span className="block text-sm font-semibold text-chalk-200">{t("pages.accountValueUI.rank")}</span>
              <select
                value={inputs.rank}
                onChange={(e) => set({ rank: e.target.value as Rank })}
                className="bevel-sm mt-1 w-full border border-night-700 bg-night-900 px-3 py-2 text-chalk-100 outline-none focus:border-gold-500"
              >
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    {t(`rankNames.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label={t("pages.accountValueUI.heroes")}
              value={inputs.heroes}
              max={model.heroes}
              onChange={(n) => set({ heroes: n })}
            />
            <NumberField
              label={t("pages.accountValueUI.emblems")}
              value={inputs.emblems}
              max={model.emblems}
              onChange={(n) => set({ emblems: n })}
            />
            <NumberField
              label={t("pages.accountValueUI.diamonds")}
              hint={t("pages.accountValueUI.diamondsHint")}
              value={inputs.diamonds}
              max={MAX_DIAMONDS}
              showMax={false}
              onChange={(n) => set({ diamonds: n })}
            />
          </div>
          <FilterGroup legend={t("pages.accountValueUI.binding")} widthLegend="w-full sm:w-auto" className="mt-5">
            {BINDINGS.map((b) => (
              <Chip key={b} dense active={inputs.binding === b} onClick={() => set({ binding: b })}>
                {t(`pages.accountValueUI.bindingValue.${b}`)}
              </Chip>
            ))}
          </FilterGroup>
        </fieldset>
      </div>
    </div>
  );
}
