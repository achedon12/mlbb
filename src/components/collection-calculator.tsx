"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Share2 } from "lucide-react";
import { Pager } from "@/components/pager";
import { SkinCard, propsCardSkin } from "@/components/skin-card";
import { SearchField } from "@/components/search-field";
import { ChoiceUnique, FilterGroup, Chip, classesChip } from "@/components/chip";
import { Card } from "@/components/ui";
import { BackupPanel, ShortcutsHelp, SyncLine, shortcutOf } from "@/components/collection-tools";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import {
  LABEL_CURRENCY,
  ROLES_INDEX,
  loadCatalog,
  labelRarity,
  seriesLabel,
  rarityOfRank,
  seriesStats,
  textPrice,
  type Catalog,
  type SkinCatalog,
} from "@/lib/skin-catalog";
import { summaryCollection, skinsCollectible, type Ownership, type StoredOwnership, type Summary } from "@/lib/collection";
import { unionOwnership } from "@/lib/collection-sync";
import { useCollectionSync } from "@/lib/collection-sync-client";
import type { Role } from "@/lib/types";
import { trackShare } from "@/lib/analytics";
import { pageHref, paging, pathWithoutPage, slicePage, SIZE_CARDS } from "@/lib/pager";
import { keySearch, cn } from "@/lib/utils";

type View = "all" | "owned" | "missing";
const VIEWS: View[] = ["all", "owned", "missing"];
type Pool = "all" | "played";
type Played = { state: "idle" | "loading" | "failed" } | { state: "ok"; heroes: string[] };
/** Series shown first; the others expand. */
const VISIBLE_SERIES = 10;

const EMPTY: ReadonlySet<string> = new Set();

/** Every id of `ids` added, or every one removed. */
const setAll = (set: ReadonlySet<string>, ids: readonly string[], on: boolean) => {
  const next = new Set(set);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
};

const toggle = (set: ReadonlySet<string>, key: string) => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};

/**
 * Collection calculator: the player ticks their heroes and skins, and sees
 * what they are worth at the in-game shop price, in diamonds.
 *
 * The skin index is requested when the tool loads, never bundled into the
 * page. The collection is kept in the browser (`localStorage`); signed in
 * with a game account, it is also saved to the account
 * (`useCollectionSync`), so it follows the player to another device.
 */
export function CollectionCalculator({ page: pageServer = 1 }: { page?: number }) {
  const t = useT();
  const locale = useLocale();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  const { owned, update, status, signedIn, notice, dismissNotice } = useCollectionSync(catalog);
  const heroes = owned?.heros ?? EMPTY;
  const skins = owned?.skins ?? EMPTY;
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [series, setSeries] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [pool, setPool] = useState<Pool>("all");
  const [played, setPlayed] = useState<Played>({ state: "idle" });
  const [openHeroes, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [allSeries, setAllSeries] = useState(false);
  const [page, setPage] = useState(pageServer);
  const [share, setShare] = useState<"" | "copied" | "shared" | "failed">("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const setHero = (fn: (before: ReadonlySet<string>) => ReadonlySet<string>) => update((o) => ({ ...o, heros: fn(o.heros) }));
  const setSkins = (fn: (before: ReadonlySet<string>) => ReadonlySet<string>) => update((o) => ({ ...o, skins: fn(o.skins) }));

  const count = useMemo(() => new Intl.NumberFormat(LOCALE_INTL[locale]), [locale]);
  const percent = useMemo(
    () => new Intl.NumberFormat(LOCALE_INTL[locale], { style: "percent", maximumFractionDigits: 0 }),
    [locale],
  );

  useEffect(() => {
    let cancelled = false;
    loadCatalog(locale).then(
      (c) => !cancelled && setCatalog(c),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Paging in place still writes the address the pager's link held, so a
  // reload or a shared link comes back to the page being read.
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      pageHref(pathWithoutPage(window.location.pathname), window.location.search, page),
    );
  }, [page]);

  const data = useMemo(() => {
    if (!catalog) return null;
    const collectible = skinsCollectible(catalog);
    const byHero = new Map<string, SkinCatalog[]>();
    for (const s of collectible) byHero.set(s.hero, [...(byHero.get(s.hero) ?? []), s]);
    return {
      byHero,
      names: new Map(catalog.heroes.map((h) => [h.slug, h.name])),
      sortedHeroes: [...catalog.heroes].sort((a, b) => a.name.localeCompare(b.name, "en")),
      series: seriesStats(collectible).map((s) => s.series),
      heroSlugs: new Set(catalog.heroes.map((h) => h.slug)),
      skinIds: new Set(collectible.map((s) => s.id)),
    };
  }, [catalog]);

  const summary = useMemo(() => (catalog ? summaryCollection(catalog, { heros: heroes, skins }) : null), [catalog, heroes, skins]);

  const playedOrder = useMemo(
    () => (played.state === "ok" ? new Map(played.heroes.map((slug, i) => [slug, i])) : null),
    [played],
  );

  const list = useMemo(() => {
    if (!data) return [];
    const term = keySearch(search.trim());
    // "Heroes I play": the season's most played first, the way the player thinks of their pool.
    const pooled =
      pool === "played" && playedOrder
        ? data.sortedHeroes.filter((h) => playedOrder.has(h.slug)).sort((a, b) => playedOrder.get(a.slug)! - playedOrder.get(b.slug)!)
        : data.sortedHeroes;
    return pooled.flatMap((h) => {
      if (role && !h.roles.includes(role)) return [];
      const nameFound = !term || keySearch(h.name).includes(term);
      let sk = data.byHero.get(h.slug) ?? [];
      if (series) sk = sk.filter((s) => s.series === series);
      if (!nameFound) sk = sk.filter((s) => keySearch(s.name).includes(term));
      if (view === "owned") sk = sk.filter((s) => skins.has(s.id));
      if (view === "missing") sk = sk.filter((s) => !skins.has(s.id));
      // The hero stays if it passes the filters itself, or if it still has skins to show.
      const heroPasses = nameFound && !series && (view === "all" || (view === "owned") === heroes.has(h.slug));
      if (!heroPasses && sk.length === 0) return [];
      // A search by skin name or a series expands the matching heroes automatically.
      return [{ h, sk, expanded: (!!term && !nameFound) || !!series }];
    });
  }, [data, search, role, series, view, pool, playedOrder, heroes, skins]);

  /* A hundred and thirty-four rows of checkboxes ran eighteen screens on a
     phone. They are read one page at a time — the links are real addresses,
     `/tools/collection/page/3`, so a middle click opens one — and any change
     of filter starts again at the first: the fourth page of eleven results
     holds nothing. */
  const view_ = paging(list.length, page, SIZE_CARDS);
  const shown = slicePage(list, view_.page, SIZE_CARDS);
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  function choosePool(p: Pool) {
    filter(setPool)(p);
    if (p !== "played" || played.state === "ok" || played.state === "loading") return;
    setPlayed({ state: "loading" });
    fetch("/api/collection/played", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ heroes?: unknown }>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        const list = Array.isArray(body.heroes) ? body.heroes.filter((h): h is string => typeof h === "string") : [];
        setPlayed({ state: "ok", heroes: list });
      })
      .catch(() => setPlayed({ state: "failed" }));
  }

  // Keyboard shortcuts, listed in the help under the filters. Never while typing in a field.
  const pages = view_.pages;
  const shortcuts = useRef<(key: string) => boolean>(() => false);
  useEffect(() => {
    shortcuts.current = (key) => {
      if (key === "/") searchRef.current?.focus();
      else if (key === "?") setHelp((v) => !v);
      else if (key === "1" || key === "2" || key === "3") filter(setView)(VIEWS[Number(key) - 1]);
      else if (key === "h" && signedIn) choosePool(pool === "played" ? "all" : "played");
      else if (key === "n") setPage((p) => Math.min(pages, p + 1));
      else if (key === "p") setPage((p) => Math.max(1, p - 1));
      else return false;
      return true;
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = shortcutOf(e);
      if (key && shortcuts.current(key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-chalk-300">{t("pages.collectionUI.error")}</p>
      </Card>
    );
  }
  if (!catalog || !data || !summary || !owned) {
    return (
      <Card aria-busy>
        <p className="text-sm text-chalk-500">{t("pages.collectionUI.loading")}</p>
      </Card>
    );
  }

  function everythingForHero(slug: string) {
    const ids = (data!.byHero.get(slug) ?? []).map((s) => s.id);
    const full = heroes.has(slug) && ids.every((id) => skins.has(id));
    update((o) => ({ heros: setAll(o.heros, [slug], !full), skins: setAll(o.skins, ids, !full) }));
  }

  const seriesSkins = series ? skinsCollectible(catalog).filter((s) => s.series === series) : [];
  const seriesFull = seriesSkins.length > 0 && seriesSkins.every((s) => skins.has(s.id));

  function importBackup(file: StoredOwnership, mode: "merge" | "replace") {
    update((o): Ownership => {
      const next = mode === "replace" ? file : unionOwnership({ heros: [...o.heros], skins: [...o.skins] }, file);
      return { heros: new Set(next.heros), skins: new Set(next.skins) };
    });
  }

  const everyHero = data.sortedHeroes.every((h) => heroes.has(h.slug));
  const empty = heroes.size === 0 && skins.size === 0;

  function summaryText(b: Summary): string {
    const rare = b.plusRare[0];
    return [
      t("pages.collectionUI.summaryText", {
        heroes: `${count.format(b.heroes.owned)}/${count.format(b.heroes.total)}`,
        skins: `${count.format(b.skins.owned)}/${count.format(b.skins.total)}`,
        diamonds: count.format(b.diamonds),
      }),
      rare ? t("pages.collectionUI.summaryRare", { name: rare.name, hero: data!.names.get(rare.hero) ?? rare.hero }) : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function shareSummary(b: Summary) {
    const text = summaryText(b);
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("pages.collectionUI.summaryTitle"), text, url });
        setShare("shared");
        trackShare("Collection", "native");
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShare("copied");
      trackShare("Collection", "clipboard");
    } catch (e) {
      // Closing the share sheet is not a failure.
      if ((e as Error).name !== "AbortError") setShare("failed");
    }
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ── Summary ───────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:order-2" aria-labelledby="summary-title">
          <Card className="border-gold-500/30">
            <h2 id="summary-title" className="text-xs uppercase tracking-wide text-chalk-500">
              {t("pages.collectionUI.valueTitle")}
            </h2>
            <p aria-live="polite" className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-heading text-4xl font-bold tabular-nums text-gold-400">{count.format(summary.diamonds)}</span>
              <span className="text-chalk-100">{t("skinsUI.diamonds").toLowerCase()}</span>
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row
                label={t("pages.collectionUI.heroes")}
                value={`${count.format(summary.heroes.owned)} / ${count.format(summary.heroes.total)}`}
                detail={t("pages.collectionUI.inDiamonds", { n: count.format(summary.heroes.diamonds) })}
              />
              <Row
                label={t("pages.collectionUI.skins")}
                value={`${count.format(summary.skins.owned)} / ${count.format(summary.skins.total)}`}
                detail={t("pages.collectionUI.inDiamonds", { n: count.format(summary.skins.diamonds) })}
              />
              {summary.heroes.battlePoints > 0 && (
                <Row
                  label={t("skinsUI.battlePoints")}
                  value={count.format(summary.heroes.battlePoints)}
                  detail={t("pages.collectionUI.bpDetail")}
                />
              )}
              {Object.entries(summary.skins.others).map(([m, n]) => (
                <Row
                  key={m}
                  label={t(`skinsUI.${LABEL_CURRENCY[m as keyof typeof LABEL_CURRENCY]}`)}
                  value={count.format(n)}
                  detail={t("pages.collectionUI.otherDetail")}
                />
              ))}
            </dl>
            <div className="mt-4 space-y-2.5 border-t border-night-800 pt-4">
              <h3 className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.collectionUI.progressTitle")}</h3>
              <Progress label={t("pages.collectionUI.heroes")} owned={summary.heroes.owned} total={summary.heroes.total} percent={percent} />
              <Progress label={t("pages.collectionUI.skins")} owned={summary.skins.owned} total={summary.skins.total} percent={percent} />
            </div>
            {(summary.skins.withoutDiamond > 0 || summary.heroes.withoutDiamond > 0) && (
              <p className="mt-3 text-xs leading-relaxed text-chalk-500">
                {t("pages.collectionUI.noDiamond", {
                  skins: count.format(summary.skins.withoutDiamond),
                  heroes: count.format(summary.heroes.withoutDiamond),
                })}
              </p>
            )}
            {empty ? (
              <p className="mt-4 border-t border-night-800 pt-3 text-sm text-chalk-300">{t("pages.collectionUI.empty")}</p>
            ) : (
              <div className="mt-4 border-t border-night-800 pt-4">
                <p className="text-sm leading-relaxed text-chalk-200">{summaryText(summary)}</p>
                <button
                  type="button"
                  onClick={() => shareSummary(summary)}
                  className={cn(classesChip(true), "mt-3 inline-flex items-center gap-2")}
                >
                  <Share2 size={15} aria-hidden />
                  {t("pages.collectionUI.share")}
                </button>
                <p aria-live="polite" className="mt-2 text-xs text-chalk-500">
                  {share && t(`pages.collectionUI.share_${share}`)}
                </p>
              </div>
            )}
            <div className="mt-4 border-t border-night-800 pt-4">
              <SyncLine status={status} notice={notice} onDismiss={dismissNotice} />
            </div>
          </Card>
        </aside>

        {/* ── Selection ─────────────────────────────────────────────── */}
        <div className="min-w-0 lg:order-1">
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.collectionUI.selectionTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-5 space-y-4">
            <SearchField
              value={search}
              onChange={filter(setSearch)}
              label={t("pages.collectionUI.search")}
              inputRef={searchRef}
              keyShortcuts="/"
            />
            <ChoiceUnique
              legend={t("pages.collectionUI.role")}
              values={ROLES_INDEX}
              active={role}
              onChange={filter(setRole)}
              label={(r) => t(`roles.${r}`)}
            />
            <FilterGroup legend={t("pages.collectionUI.show")}>
              {VIEWS.map((v) => (
                <Chip key={v} dense active={view === v} onClick={() => filter(setView)(v)}>
                  {t(`pages.collectionUI.view_${v}`)}
                </Chip>
              ))}
            </FilterGroup>
            {signedIn && (
              <FilterGroup legend={t("pages.collectionUI.pool")}>
                <Chip dense active={pool === "all"} onClick={() => choosePool("all")}>
                  {t("pages.collectionUI.pool_all")}
                </Chip>
                <Chip dense active={pool === "played"} onClick={() => choosePool("played")}>
                  {t("pages.collectionUI.pool_played")}
                </Chip>
                {pool === "played" && played.state !== "ok" && (
                  <span aria-live="polite" className="text-xs text-chalk-500">
                    {t(`pages.collectionUI.played_${played.state === "failed" ? "failed" : "loading"}`)}
                  </span>
                )}
                {pool === "played" && played.state === "ok" && played.heroes.length === 0 && (
                  <span className="text-xs text-chalk-500">{t("pages.collectionUI.played_empty")}</span>
                )}
              </FilterGroup>
            )}
            <label className="block max-w-xs">
              <span className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.collectionUI.series")}</span>
              <select
                value={series ?? ""}
                onChange={(e) => filter(setSeries)(e.target.value || null)}
                className="bevel-sm mt-1.5 w-full border border-night-700 bg-night-900 px-3 py-2 text-sm text-chalk-100 outline-none focus:border-gold-500"
              >
                <option value="">{t("pages.collectionUI.allSeries")}</option>
                {data.series.map((s) => (
                  <option key={s} value={s}>
                    {seriesLabel(t, s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHero(() => (everyHero ? new Set() : new Set(data.sortedHeroes.map((h) => h.slug))))}
                className={classesChip(false, true)}
              >
                {t(everyHero ? "pages.collectionUI.noHero" : "pages.collectionUI.allHeroes")}
              </button>
              {series && seriesSkins.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSkins((before) => setAll(before, seriesSkins.map((s) => s.id), !seriesFull))}
                  className={classesChip(false, true)}
                >
                  {t(seriesFull ? "pages.collectionUI.seriesUncheck" : "pages.collectionUI.seriesCheck", {
                    n: count.format(seriesSkins.length),
                    series: seriesLabel(t, series),
                  })}
                </button>
              )}
              {!empty && !confirmClear && (
                <button type="button" onClick={() => setConfirmClear(true)} className={classesChip(false, true)}>
                  {t("pages.collectionUI.clear")}
                </button>
              )}
            </div>
            {confirmClear && !empty && (
              <div role="group" aria-labelledby="clear-question" className="bevel-sm flex flex-wrap items-center gap-x-3 gap-y-2 border border-gold-500/30 bg-gold-500/5 px-3 py-2 text-sm">
                <span id="clear-question" className="text-chalk-200">
                  {t("pages.collectionUI.confirmClear")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    update(() => ({ heros: new Set(), skins: new Set() }));
                    setConfirmClear(false);
                  }}
                  className={classesChip(true, true)}
                >
                  {t("pages.collectionUI.clearYes")}
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="text-xs font-semibold text-chalk-400 hover:text-chalk-100">
                  {t("pages.collectionUI.cancel")}
                </button>
              </div>
            )}
            <ShortcutsHelp open={help} onToggle={setHelp} />
          </div>

          <p aria-live="polite" className="mt-5 text-sm text-chalk-500">
            {t(list.length === 1 ? "pages.collectionUI.heroCount1" : "pages.collectionUI.heroCount", {
              n: count.format(list.length),
            })}
          </p>

          <ul className="mt-3 divide-y divide-night-800 border-y border-night-800">
            {shown.map(({ h, sk, expanded }) => {
              const all = data.byHero.get(h.slug) ?? [];
              const owned = all.filter((s) => skins.has(s.id)).length;
              const full = heroes.has(h.slug) && owned === all.length;
              const open = expanded || openHeroes.has(h.slug);
              return (
                <li key={h.slug} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {/* 12rem basis: on mobile, the count and buttons wrap rather than squash the name. */}
                    <label className="flex min-w-0 flex-[1_1_12rem] cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={heroes.has(h.slug)}
                        onChange={() => setHero((before) => toggle(before, h.slug))}
                        className="size-4 shrink-0 accent-gold-500"
                      />
                      {h.icon ? (
                        <Image src={h.icon} alt="" width={32} height={32} className="bevel-sm size-8 shrink-0 object-cover" />
                      ) : null}
                      <span className="truncate font-semibold text-chalk-100">{h.name}</span>
                    </label>
                    <span className="inline-flex items-center gap-2 text-xs tabular-nums text-chalk-500">
                      {all.length > 0 && (
                        <span aria-hidden className="h-1 w-12 bg-night-700">
                          <span className="block h-full bg-gold-400" style={{ width: `${(owned / all.length) * 100}%` }} />
                        </span>
                      )}
                      {t("pages.collectionUI.heroSkins", { n: count.format(owned), total: count.format(all.length) })}
                    </span>
                    <button
                      type="button"
                      onClick={() => everythingForHero(h.slug)}
                      aria-label={t(full ? "pages.collectionUI.uncheckAllHeroes" : "pages.collectionUI.checkAllHeroes", {
                        name: h.name,
                      })}
                      className={classesChip(false, true)}
                    >
                      {t(full ? "pages.collectionUI.uncheckAll" : "pages.collectionUI.checkAll")}
                    </button>
                    {sk.length > 0 && !expanded && (
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`skins-${h.slug}`}
                        onClick={() => setOpen((before) => toggle(before, h.slug))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.collectionUI.seeSkins")}
                        <span className="sr-only"> — {h.name}</span>
                        <ChevronDown size={14} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {open && sk.length > 0 && (
                    <ul id={`skins-${h.slug}`} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                      {sk.map((s) => {
                        const check = skins.has(s.id);
                        const r = rarityOfRank(s.rarity);
                        return (
                          <li key={s.id}>
                            <label
                              className={cn(
                                "bevel-sm relative block cursor-pointer overflow-hidden border-2 transition-colors",
                                !check && "border-night-700",
                              )}
                              style={check ? { borderColor: r.color, boxShadow: `0 0 10px ${r.halo}` } : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={check}
                                onChange={() => setSkins((before) => toggle(before, s.id))}
                                className="absolute left-1.5 top-1.5 z-10 size-4 accent-gold-500"
                              />
                              <span className="relative block aspect-[240/390] bg-night-800">
                                {s.image && (
                                  <Image
                                    src={s.image}
                                    alt=""
                                    width={120}
                                    height={195}
                                    className={cn("size-full object-cover transition-opacity", !check && "opacity-55")}
                                  />
                                )}
                              </span>
                              <span className="block bg-night-900 px-1.5 py-1 text-[0.65rem] leading-tight">
                                <span className="block truncate text-chalk-100">{s.name}</span>
                                <span className="block truncate" style={{ color: r.color }}>
                                  {labelRarity(t, s.rarity)}
                                </span>
                                <span className="block truncate text-chalk-500">
                                  {textPrice(s.price, t, count) ?? s.acquisition ?? t("pages.collectionUI.noPrice")}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          {list.length === 0 && <p className="mt-6 text-sm text-chalk-500">{t("pages.collectionUI.none")}</p>}
          <Pager
            paging={view_}
            href={(n) => pageHref("/tools/collection", null, n)}
            onNavigate={setPage}
            t={t}
          />
          <div className="mt-8 max-w-xl border-t border-night-800 pt-6">
            <BackupPanel
              collection={{ heros: [...heroes].sort(), skins: [...skins].sort() }}
              knownHeroes={data.heroSlugs}
              knownSkins={data.skinIds}
              onImport={importBackup}
            />
          </div>
        </div>
      </div>

      {/* ── Detail ────────────────────────────────────────────────── */}
      {!empty && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section>
            <h2 className="font-heading text-xl font-bold text-chalk-100">{t("pages.collectionUI.rarityTitle")}</h2>
            <div className="mt-4 relative overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("pages.collectionUI.rarityTitle")}</caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-chalk-500">
                    <th scope="col" className="py-2 font-medium">{t("pages.collectionUI.colRarity")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("pages.collectionUI.colOwned")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t("pages.collectionUI.colDiamonds")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-night-800">
                  {summary.byRarity.map((r) => (
                    <tr key={r.rank}>
                      <th scope="row" className="py-2 text-left font-normal" style={{ color: rarityOfRank(r.rank).color }}>
                        {labelRarity(t, r.rank)}
                      </th>
                      <td className="py-2 text-right tabular-nums text-chalk-200">
                        {count.format(r.owned)} / {count.format(r.total)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-chalk-200">{count.format(r.diamonds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary.plusRare.length > 0 && (
              <>
                <h2 className="mt-8 font-heading text-xl font-bold text-chalk-100">{t("pages.collectionUI.raresTitle")}</h2>
                <p className="mt-1 text-sm text-chalk-500">{t("pages.collectionUI.raresHelp")}</p>
                <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
                  {summary.plusRare.map((s) => (
                    <li key={s.id}>
                      <SkinCard
                        {...propsCardSkin(s, data.names.get(s.hero) ?? s.hero, t, LOCALE_INTL[locale], count)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-chalk-100">{t("pages.collectionUI.seriesTitle")}</h2>
            <p className="mt-1 text-sm text-chalk-500">{t("pages.collectionUI.seriesHelp")}</p>
            <ul className="mt-4 space-y-3">
              {(allSeries ? summary.bySeries : summary.bySeries.slice(0, VISIBLE_SERIES)).map((s) => (
                <li key={s.series}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-chalk-100">{seriesLabel(t, s.series)}</span>
                    <span className="shrink-0 tabular-nums text-chalk-400">
                      {count.format(s.owned)} / {count.format(s.total)} · {percent.format(s.owned / s.total)}
                    </span>
                  </div>
                  <div aria-hidden className="mt-1 h-1.5 bg-night-700">
                    <div className="h-full bg-gold-400" style={{ width: `${(s.owned / s.total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {summary.bySeries.length > VISIBLE_SERIES && (
              <button
                type="button"
                onClick={() => setAllSeries((v) => !v)}
                aria-expanded={allSeries}
                className={cn(classesChip(false, true), "mt-4")}
              >
                {allSeries
                  ? t("pages.collectionUI.fewerSeries")
                  : t("pages.collectionUI.showAllSeries", { n: count.format(summary.bySeries.length) })}
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Progress({ label, owned, total, percent }: { label: string; owned: number; total: number; percent: Intl.NumberFormat }) {
  const share = total ? owned / total : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-chalk-400">{label}</span>
        <span className="tabular-nums text-chalk-100">{percent.format(share)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={owned}
        className="mt-1 h-1.5 bg-night-700"
      >
        <div className="h-full bg-gold-400" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-chalk-400">{label}</dt>
      <dd className="text-right">
        <span className="tabular-nums text-chalk-100">{value}</span>
        {detail && <span className="block text-xs text-chalk-500">{detail}</span>}
      </dd>
    </div>
  );
}
