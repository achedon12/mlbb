"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SkinCard, propsCardSkin } from "@/components/skin-card";
import { SearchField } from "@/components/search-field";
import { FilterGroup, Chip, classesChip } from "@/components/chip";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import {
  RANKS_RARITY,
  ROLES_INDEX,
  loadCatalog,
  isOrigin,
  isReleased,
  filterSkins,
  groupByDate,
  labelRarity,
  seriesLabel,
  rarityOfRank,
  truncateGroups,
  type Catalog,
} from "@/lib/skin-catalog";
import type { Role } from "@/lib/types";

/** Skins shown per step: a thousand thumbnails at once would help no one. */
const STEP = 48;

interface Filters {
  search: string;
  hero: string | null;
  role: Role | null;
  series: string | null;
  rarity: number | null;
  year: number | null;
}
const EMPTY: Filters = { search: "", hero: null, role: null, series: null, rarity: null, year: null };

const CLASS_CHOICE =
  "bevel-sm w-full border border-night-700 bg-night-900 px-3 py-2 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500";

/**
 * Calendar explorer: search and filters (hero, role, series, rarity, year) on
 * every released skin.
 *
 * Without a filter, it shows the overview rendered by the server
 * (`children`). The skin index is only requested on the first interaction
 * with the filters, or right away when the address carries some
 * (`?serie=Collector`): filters go through the URL, which makes a view
 * shareable.
 */
export function SkinExplorer({
  heroes,
  series,
  years,
  reference,
  children,
}: {
  heroes: [slug: string, name: string][];
  series: string[];
  years: number[];
  /** Data date: past it, a skin is not released yet. */
  reference: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const [f, setF] = useState<Filters>(EMPTY);
  const [limit, setLimit] = useState(STEP);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  const active = !!(f.search.trim() || f.hero || f.role || f.series || f.rarity !== null || f.year !== null);
  const count = useMemo(() => new Intl.NumberFormat(LOCALE_HTML[locale]), [locale]);

  const maj = (partial: Partial<Filters>) => {
    setF((before) => ({ ...before, ...partial }));
    setLimit(STEP);
  };

  // Same principle as the hero catalogue: the URL is only read after mount
  // (server and hydration start empty), then every change is written back
  // to it.
  const rise = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!rise.current) {
      rise.current = true;
      const countOf = (key: string, valid: readonly number[]) => {
        const n = Number(params.get(key));
        return params.get(key) && valid.includes(n) ? n : null;
      };
      const readValues: Filters = {
        search: params.get("q") ?? "",
        hero: heroes.some(([s]) => s === params.get("heros")) ? params.get("heros") : null,
        role: ROLES_INDEX.find((r) => r === params.get("role")) ?? null,
        series: series.find((s) => s === params.get("serie")) ?? null,
        rarity: countOf("rarete", RANKS_RARITY),
        year: countOf("annee", years),
      };
      if (Object.values(readValues).some((v) => v !== null && v !== "")) {
        setF(readValues); // eslint-disable-line react-hooks/set-state-in-effect -- reading the URL after mount
        return;
      }
    }
    const values: [string, string | null][] = [
      ["q", f.search.trim() || null],
      ["heros", f.hero],
      ["role", f.role],
      ["serie", f.series],
      ["rarete", f.rarity === null ? null : String(f.rarity)],
      ["annee", f.year === null ? null : String(f.year)],
    ];
    for (const [key, value] of values) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const suffix = params.toString();
    window.history.replaceState(null, "", `${suffix ? `?${suffix}` : window.location.pathname}${window.location.hash}`);
  }, [f, heroes, series, years]);

  useEffect(() => {
    if (!active || catalog) return;
    let cancelled = false;
    loadCatalog(locale).then(
      (c) => !cancelled && setCatalog(c),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [active, catalog, locale]);

  const results = useMemo(() => {
    if (!catalog || !active) return null;
    const bySlug = new Map(catalog.heroes.map((h) => [h.slug, h]));
    const released = catalog.skins.filter((s) => !isOrigin(s) && isReleased(s, reference));
    const list = filterSkins(released, bySlug, f);
    return { bySlug, total: list.length, groups: groupByDate(list, "recent") };
  }, [catalog, active, f, reference]);

  const formatMonth = new Intl.DateTimeFormat(LOCALE_HTML[locale], { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      {/* The first interaction with the filters is enough to request the index. */}
      <div
        className="space-y-4"
        onFocusCapture={() => void loadCatalog(locale).catch(() => undefined)}
        onPointerEnter={() => void loadCatalog(locale).catch(() => undefined)}
      >
        <SearchField
          value={f.search}
          onChange={(search) => maj({ search })}
          label={t("pages.skinsCalendarUI.search")}
          className="max-w-md"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Choice
            label={t("pages.skinsCalendarUI.heroes")}
            value={f.hero ?? ""}
            onChange={(v) => maj({ hero: v || null })}
            all={t("pages.skinsCalendarUI.allHeroes")}
            options={heroes.map(([slug, name]) => [slug, name])}
          />
          <Choice
            label={t("pages.skinsCalendarUI.series")}
            value={f.series ?? ""}
            onChange={(v) => maj({ series: v || null })}
            all={t("pages.skinsCalendarUI.all")}
            options={series.map((s) => [s, seriesLabel(t, s)])}
          />
          <Choice
            label={t("pages.skinsCalendarUI.year")}
            value={f.year === null ? "" : String(f.year)}
            onChange={(v) => maj({ year: v ? Number(v) : null })}
            all={t("pages.skinsCalendarUI.all")}
            options={years.map((a) => [String(a), String(a)])}
          />
        </div>
        <FilterGroup legend={t("pages.skinsCalendarUI.role")}>
          {ROLES_INDEX.map((r) => (
            <Chip key={r} dense active={f.role === r} onClick={() => maj({ role: f.role === r ? null : r })}>
              {t(`roles.${r}`)}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup legend={t("pages.skinsCalendarUI.rarity")}>
          {RANKS_RARITY.map((rank) => (
            <Chip key={rank} dense active={f.rarity === rank} onClick={() => maj({ rarity: f.rarity === rank ? null : rank })}>
              <span aria-hidden className="mr-1.5 inline-block size-2 border-2" style={{ borderColor: rarityOfRank(rank).color }} />
              {labelRarity(t, rank)}
            </Chip>
          ))}
        </FilterGroup>
        {active && (
          <button type="button" onClick={() => maj(EMPTY)} className={classesChip(false, true)}>
            {t("pages.skinsCalendarUI.clear")}
          </button>
        )}
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {active &&
          (error
            ? t("pages.skinsCalendarUI.error")
            : !results
              ? t("pages.skinsCalendarUI.loading")
              : t(results.total === 1 ? "pages.skinsCalendarUI.result" : "pages.skinsCalendarUI.results", {
                  n: count.format(results.total),
                }))}
      </p>

      <div className="mt-6">
        {!active
          ? children
          : results && (
              <div className="space-y-10">
                {truncateGroups(results.groups, limit).map((a) => (
                  <section key={a.year}>
                    <h3 className="font-heading text-2xl font-bold text-chalk-100">
                      {a.year}{" "}
                      <span className="text-sm font-normal text-chalk-500">
                        {t(a.total === 1 ? "pages.skinsCalendarUI.nSkins1" : "pages.skinsCalendarUI.nSkins", {
                          n: count.format(a.total),
                        })}
                      </span>
                    </h3>
                    {a.month.map((m) => (
                      <div key={m.month ?? "unknown"} className="mt-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gold-400">
                          {m.month ? formatMonth.format(Date.UTC(a.year, m.month - 1, 1)) : t("pages.skinsCalendarUI.unknownMonth")}
                        </h4>
                        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                          {m.skins.map((s) => (
                            <li key={s.id}>
                              <SkinCard
                                {...propsCardSkin(
                                  s,
                                  results.bySlug.get(s.hero)?.name ?? s.hero,
                                  t,
                                  LOCALE_HTML[locale],
                                  count,
                                )}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ))}
                {results.total > limit && (
                  <button type="button" onClick={() => setLimit((l) => l + STEP)} className={classesChip(false)}>
                    {t("pages.skinsCalendarUI.more", { n: count.format(Math.min(STEP, results.total - limit)) })}
                  </button>
                )}
              </div>
            )}
      </div>
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: [value: string, label: string][];
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-chalk-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${CLASS_CHOICE}`}>
        <option value="">{all}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
