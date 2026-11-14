"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Download, RotateCcw, Share2 } from "lucide-react";
import { Chip, FilterGroup, classesChip } from "@/components/chip";
import { Card } from "@/components/ui";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import {
  BINDINGS,
  CURRENCIES,
  DEFAULT_INPUTS,
  MAX_DIAMONDS,
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
  type Rank,
  type Tier,
} from "@/lib/account-value";
import { KEY_COLLECTION, readOwnership } from "@/lib/collection";
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
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  max: number;
  /** "/ 103" after the value: how many exist in the game; off for a bare bound. */
  showMax?: boolean;
  onChange: (n: number) => void;
}) {
  const id = useId();
  const locale = useLocale();
  const count = new Intl.NumberFormat(LOCALE_INTL[locale]);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-chalk-200">
        {label}
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
          className={cn(
            "bevel-sm w-full border border-night-700 bg-night-900 py-2 pl-3 tabular-nums text-chalk-100 outline-none transition-colors placeholder:text-chalk-600 focus:border-gold-500",
            showMax ? "pr-14" : "pr-3",
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
  const empty = ownedSkins === 0 && inputs.diamonds === 0;

  const set = (patch: Partial<Inputs>) => {
    setInputs((before) => clampInputs({ ...before, ...patch }, model));
    setShare("");
  };
  const setSkin = (tier: Tier, n: number) => set({ skins: { ...inputs.skins, [tier]: n } });

  async function importCollection() {
    setImporting("busy");
    try {
      const catalog = await loadCatalog(locale);
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(KEY_COLLECTION);
      } catch {
        // Read above already; a refusal now leaves an empty save.
      }
      const counts = countsFromCollection(readOwnership(raw), catalog);
      set({ skins: counts.skins, heroes: counts.heroes });
      setImporting("done");
      trackEvent("Account value", "Import", undefined, Object.values(counts.skins).reduce((a, b) => a + (b ?? 0), 0));
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
                onClick={() => set(DEFAULT_INPUTS)}
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
            <p aria-live="polite" className="w-full text-xs text-chalk-500 empty:hidden">
              {importing && importing !== "busy" ? t(`pages.accountValueUI.import_${importing}`) : ""}
            </p>
          </div>
        )}

        <fieldset>
          <legend className="font-heading text-xl font-bold text-chalk-100 sm:text-2xl">
            {t("pages.accountValueUI.skinsTitle")}
          </legend>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 xl:grid-cols-3">
            {model.tiers.map((tier) => (
              <NumberField
                key={tier.tier}
                label={t(`pages.accountValueUI.tier.${tier.tier}`)}
                hint={t(tier.basis === "shop" ? "pages.accountValueUI.costShop" : "pages.accountValueUI.costDraw", {
                  n: count.format(tier.cost),
                })}
                value={inputs.skins[tier.tier] ?? 0}
                max={tier.count}
                onChange={(n) => setSkin(tier.tier, n)}
              />
            ))}
          </div>
        </fieldset>

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
