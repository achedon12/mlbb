"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Share2 } from "lucide-react";
import { SkinCard, propsCardSkin } from "@/components/skin-card";
import { SearchField } from "@/components/search-field";
import { ChoiceUnique, FilterGroup, Chip, classesChip } from "@/components/chip";
import { Card } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
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
import {
  KEY_COLLECTION,
  summaryCollection,
  writeOwnership,
  readOwnership,
  skinsCollectible,
  type Summary,
} from "@/lib/collection";
import type { Role } from "@/lib/types";
import { keySearch, cn } from "@/lib/utils";

type View = "all" | "owned" | "missing";
const VIEWS: View[] = ["all", "owned", "missing"];
/** Series montrees d'abord ; les autres se deplient. */
const VISIBLE_SERIES = 10;

const toggle = (set: ReadonlySet<string>, key: string) => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};

/**
 * Calculateur de collection : le joueur coche ses heros et ses skins, et voit
 * ce qu'ils valent au prix de la boutique du jeu, en diamants.
 *
 * L'index des skins est demande au chargement de l'outil, jamais embarque
 * dans la page. La collection se garde dans le navigateur (`localStorage`) :
 * rien ne part vers un serveur.
 */
export function CollectionCalculator() {
  const t = useT();
  const locale = useLocale();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  const [heroes, setHero] = useState<ReadonlySet<string>>(new Set());
  const [skins, setSkins] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [series, setSeries] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [openHeroes, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [allSeries, setAllSeries] = useState(false);
  const [share, setShare] = useState<"" | "copied" | "shared" | "failed">("");

  const count = useMemo(() => new Intl.NumberFormat(LOCALE_HTML[locale]), [locale]);
  const percent = useMemo(
    () => new Intl.NumberFormat(LOCALE_HTML[locale], { style: "percent", maximumFractionDigits: 0 }),
    [locale],
  );

  // Index et sauvegarde arrivent ensemble : la collection ne s'affiche qu'une fois les deux lus.
  useEffect(() => {
    let cancelled = false;
    loadCatalog(locale).then(
      (c) => {
        if (cancelled) return;
        let raw: string | null = null;
        try {
          raw = localStorage.getItem(KEY_COLLECTION);
        } catch {
          // Stockage refuse (navigation privee stricte) : la collection reste le temps de la visite.
        }
        const p = readOwnership(raw);
        setHero(new Set(p.heros));
        setSkins(new Set(p.skins));
        setCatalog(c);
      },
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!catalog) return;
    try {
      localStorage.setItem(KEY_COLLECTION, writeOwnership({ heros: heroes, skins }));
    } catch {
      // Idem : pas de sauvegarde possible, le calcul reste juste.
    }
  }, [catalog, heroes, skins]);

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
    };
  }, [catalog]);

  const summary = useMemo(() => (catalog ? summaryCollection(catalog, { heros: heroes, skins }) : null), [catalog, heroes, skins]);

  const list = useMemo(() => {
    if (!data) return [];
    const term = keySearch(search.trim());
    return data.sortedHeroes.flatMap((h) => {
      if (role && !h.roles.includes(role)) return [];
      const nameFound = !term || keySearch(h.name).includes(term);
      let sk = data.byHero.get(h.slug) ?? [];
      if (series) sk = sk.filter((s) => s.series === series);
      if (!nameFound) sk = sk.filter((s) => keySearch(s.name).includes(term));
      if (view === "owned") sk = sk.filter((s) => skins.has(s.id));
      if (view === "missing") sk = sk.filter((s) => !skins.has(s.id));
      // Le heros reste s'il passe lui-meme les filtres, ou s'il lui reste des skins a montrer.
      const heroPasses = nameFound && !series && (view === "all" || (view === "owned") === heroes.has(h.slug));
      if (!heroPasses && sk.length === 0) return [];
      // Une recherche par nom de skin ou une serie deplie d'office les heros concernes.
      return [{ h, sk, expanded: (!!term && !nameFound) || !!series }];
    });
  }, [data, search, role, series, view, heroes, skins]);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-chalk-300">{t("pages.collectionUI.error")}</p>
      </Card>
    );
  }
  if (!catalog || !data || !summary) {
    return (
      <Card aria-busy>
        <p className="text-sm text-chalk-500">{t("pages.collectionUI.loading")}</p>
      </Card>
    );
  }

  function everythingForHero(slug: string) {
    const ids = (data!.byHero.get(slug) ?? []).map((s) => s.id);
    const full = heroes.has(slug) && ids.every((id) => skins.has(id));
    setHero((before) => {
      const n = new Set(before);
      if (full) n.delete(slug);
      else n.add(slug);
      return n;
    });
    setSkins((before) => {
      const n = new Set(before);
      for (const id of ids) {
        if (full) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  }

  const everyHero = data.sortedHeroes.every((h) => heroes.has(h.slug));
  const empty = heroes.size === 0 && skins.size === 0;

  function summaryText(b: Summary): string {
    const rare = b.plusRare[0];
    return [
      t("pages.collectionUI.summaryText", {
        heros: `${count.format(b.heroes.owned)}/${count.format(b.heroes.total)}`,
        skins: `${count.format(b.skins.owned)}/${count.format(b.skins.total)}`,
        diamants: count.format(b.diamonds),
      }),
      rare ? t("pages.collectionUI.summaryRare", { nom: rare.name, heros: data!.names.get(rare.hero) ?? rare.hero }) : "",
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
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShare("copied");
    } catch (e) {
      // Fermer la feuille de partage n'est pas un echec.
      if ((e as Error).name !== "AbortError") setShare("failed");
    }
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ── Bilan ─────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:order-2" aria-labelledby="bilan-titre">
          <Card className="border-gold-500/30">
            <h2 id="bilan-titre" className="text-xs uppercase tracking-wide text-chalk-500">
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
            {(summary.skins.withoutDiamond > 0 || summary.heroes.withoutDiamond > 0) && (
              <p className="mt-3 text-xs leading-relaxed text-chalk-500">
                {t("pages.collectionUI.noDiamond", {
                  skins: count.format(summary.skins.withoutDiamond),
                  heros: count.format(summary.heroes.withoutDiamond),
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
          </Card>
        </aside>

        {/* ── Selection ─────────────────────────────────────────────── */}
        <div className="min-w-0 lg:order-1">
          <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.collectionUI.selectionTitle")}</h2>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
          <div className="mt-5 space-y-4">
            <SearchField value={search} onChange={setSearch} label={t("pages.collectionUI.search")} />
            <ChoiceUnique
              legend={t("pages.collectionUI.role")}
              values={ROLES_INDEX}
              active={role}
              onChange={setRole}
              label={(r) => t(`roles.${r}`)}
            />
            <FilterGroup legend={t("pages.collectionUI.show")}>
              {VIEWS.map((v) => (
                <Chip key={v} dense active={view === v} onClick={() => setView(v)}>
                  {t(`pages.collectionUI.view_${v}`)}
                </Chip>
              ))}
            </FilterGroup>
            <label className="block max-w-xs">
              <span className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.collectionUI.series")}</span>
              <select
                value={series ?? ""}
                onChange={(e) => setSeries(e.target.value || null)}
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
                onClick={() => setHero(everyHero ? new Set() : new Set(data.sortedHeroes.map((h) => h.slug)))}
                className={classesChip(false, true)}
              >
                {t(everyHero ? "pages.collectionUI.noHero" : "pages.collectionUI.allHeroes")}
              </button>
              {!empty && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("pages.collectionUI.confirmClear"))) {
                      setHero(new Set());
                      setSkins(new Set());
                    }
                  }}
                  className={classesChip(false, true)}
                >
                  {t("pages.collectionUI.clear")}
                </button>
              )}
            </div>
          </div>

          <p aria-live="polite" className="mt-5 text-sm text-chalk-500">
            {t(list.length === 1 ? "pages.collectionUI.heroCount1" : "pages.collectionUI.heroCount", {
              n: count.format(list.length),
            })}
          </p>

          <ul className="mt-3 divide-y divide-night-800 border-y border-night-800">
            {list.map(({ h, sk, expanded }) => {
              const all = data.byHero.get(h.slug) ?? [];
              const owned = all.filter((s) => skins.has(s.id)).length;
              const full = heroes.has(h.slug) && owned === all.length;
              const open = expanded || openHeroes.has(h.slug);
              return (
                <li key={h.slug} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {/* Base de 12rem : sur mobile, le compte et les boutons passent a la ligne plutot que d'ecraser le nom. */}
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
                    <span className="text-xs tabular-nums text-chalk-500">
                      {t("pages.collectionUI.heroSkins", { n: count.format(owned), total: count.format(all.length) })}
                    </span>
                    <button
                      type="button"
                      onClick={() => everythingForHero(h.slug)}
                      aria-label={t(full ? "pages.collectionUI.uncheckAllHeroes" : "pages.collectionUI.checkAllHeroes", {
                        nom: h.name,
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
                        {...propsCardSkin(s, data.names.get(s.hero) ?? s.hero, t, LOCALE_HTML[locale], count)}
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
