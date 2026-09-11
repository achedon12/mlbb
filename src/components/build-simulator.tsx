"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Minus, Plus } from "lucide-react";
import { BuildStats } from "@/components/build-stats";
import { SelecteurHeros, type HerosChoisissable } from "@/components/choix-heros";
import { ItemPicker } from "@/components/item-picker";
import { PortraitHeros } from "@/components/portrait-heros";
import { ChoixRang } from "@/components/selecteur-rang";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  EMPTY_BUILD,
  LEVEL_MAX,
  LEVEL_MIN,
  MAX_ITEMS,
  TIERS,
  decodeBuild,
  encodeBuild,
  type BuildCode,
  type DecodedBuild,
} from "@/lib/build-code";
import {
  catalogFrom,
  closeCores,
  codeCatalogFrom,
  namesFrom,
  simulate,
  type MeasuredCore,
  type SimulatorData,
} from "@/lib/build-simulator";
import { RANGS_MESURE, type RangMesure } from "@/lib/rangs-mesure";
import { cn } from "@/lib/utils";

/**
 * Build simulator: hero, level, six items, emblem and talents, battle spell,
 * and the resulting stats, computed in the browser on every change.
 *
 * The build lives in the URL (`src/lib/build-code.ts`): the address bar is
 * rewritten in place on each change, so copying it - or the share button -
 * hands over the exact build. The page itself is static; the build is read
 * from the URL once mounted.
 */

const NO_EXCLUSION = new Set<string>();

function ChoiceChip({
  active,
  onClick,
  image,
  label,
}: {
  active: boolean;
  onClick: () => void;
  image: string | null;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 border px-2.5 py-1.5 text-left text-sm transition-colors",
        active ? "border-gold-500 bg-gold-500/10 text-chalk-100" : "border-night-700 text-chalk-300 hover:border-gold-500/60 hover:text-chalk-100",
      )}
    >
      <span className="relative size-7 shrink-0 overflow-hidden rounded-full border border-night-700 bg-night-800">
        {image ? (
          <Image src={image} alt="" fill unoptimized className="object-contain" />
        ) : (
          <span aria-hidden className="grid size-full place-items-center text-[0.65rem] font-semibold text-chalk-500">
            {label.charAt(0)}
          </span>
        )}
      </span>
      <span className="min-w-0 leading-tight">{label}</span>
    </button>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-heading text-xl font-bold text-chalk-100">
      {children}
    </h2>
  );
}

export function BuildSimulator({
  data,
  pageUrl,
  measuredDate,
  children,
}: {
  data: SimulatorData;
  /** Absolute URL of the simulator page, in the current language. */
  pageUrl: string;
  /** Date of the rate measurement, already formatted for the language. */
  measuredDate: string;
  /** Extra block under the stats (community publishing), fed with the current build. */
  children?: (build: BuildCode) => React.ReactNode;
}) {
  const t = useT();
  const langue = useLangue();
  const locale = LOCALE_HTML[langue];
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });

  const catalog = useMemo(() => catalogFrom(data), [data]);
  const codeCatalog = useMemo(() => codeCatalogFrom(data), [data]);
  const names = useMemo(() => namesFrom(data), [data]);
  const heroChoices = useMemo<HerosChoisissable[]>(
    () => data.heroes.map((h) => ({ slug: h.slug, nom: h.name, lanes: h.lanes, roles: h.roles, icone: h.icon })),
    [data],
  );
  const itemsBySlug = useMemo(() => new Map(data.items.map((o) => [o.slug, o])), [data]);

  const [build, setBuild] = useState<BuildCode>(EMPTY_BUILD);
  const [ignored, setIgnored] = useState<DecodedBuild["ignored"]>([]);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [rank, setRank] = useState<RangMesure>("all");
  const [copied, setCopied] = useState(false);
  /** The URL has been read: before that, writing it back would erase the shared build. */
  const [ready, setReady] = useState(false);
  const decoded = useRef(false);

  // Read the build from the URL once mounted: the static page knows nothing
  // of the query string. The ref guards against the development double run
  // of effects, whose second pass would read a URL already rewritten.
  useEffect(() => {
    if (decoded.current) return;
    decoded.current = true;
    const fromUrl = decodeBuild(window.location.search, codeCatalog);
    setBuild(fromUrl.build);
    setIgnored(fromUrl.ignored);
    setReady(true);
  }, [codeCatalog]);

  // Written back only once the decoded build is in state: the same batch as `ready`.
  const code = encodeBuild(build);
  useEffect(() => {
    if (!ready) return;
    const url = `${window.location.pathname}${code ? `?${code}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [code, ready]);

  // Measured cores of the chosen hero, fetched on demand (a few KB each).
  const [cores, setCores] = useState<{ hero: string; list: MeasuredCore[] } | null>(null);
  useEffect(() => {
    const hero = build.hero;
    if (!hero) return;
    let cancelled = false;
    fetch(`/api/builds/measured/${hero}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ cores?: MeasuredCore[] }>) : { cores: [] }))
      .then((d) => !cancelled && setCores({ hero, list: d.cores ?? [] }))
      .catch(() => !cancelled && setCores({ hero, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [build.hero]);

  const hero = build.hero ? data.heroes.find((h) => h.slug === build.hero) : undefined;
  const result = useMemo(() => simulate(build, catalog), [build, catalog]);
  const heroCores = cores && cores.hero === build.hero ? cores.list : null;
  const close = heroCores ? closeCores(heroCores, build.items, rank).slice(0, 3) : [];
  const shareUrl = `${pageUrl}${code ? `?${code}` : ""}`;

  const update = (change: Partial<BuildCode>) => setBuild((b) => ({ ...b, ...change }));
  const setLevel = (level: number) => update({ level: Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, level)) });
  const pickItem = (slug: string) => {
    if (slot === null) return;
    setBuild((b) => {
      const items = [...b.items];
      if (slot < items.length) items[slot] = slug;
      else if (items.length < MAX_ITEMS) items.push(slug);
      return { ...b, items };
    });
    setSlot(null);
  };
  const removeItem = () => {
    if (slot === null) return;
    setBuild((b) => ({ ...b, items: b.items.filter((_, i) => i !== slot) }));
    setSlot(null);
  };
  const setTalent = (tier: number, key: string | null) =>
    setBuild((b) => {
      const talents = [...b.talents] as BuildCode["talents"];
      talents[tier] = key;
      return { ...b, talents };
    });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard refused (permissions, insecure context): the field below stays selectable.
      setCopied(false);
    }
  }

  const tierTalents = Array.from({ length: TIERS }, (_, tier) => data.talents.filter((tl) => tl.tier === tier));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="min-w-0 space-y-9">
        {ignored.length > 0 && (
          <p role="status" className="border border-gold-500/40 bg-gold-500/5 p-3 text-sm text-chalk-200">
            {t("pages.buildSimulatorUI.linkDamaged", {
              parts: ignored.map((p) => t(`pages.buildSimulatorUI.params.${p}`)).join(", "),
            })}
          </p>
        )}

        <section aria-labelledby="sim-hero" className="space-y-4">
          <SectionTitle id="sim-hero">{t("pages.buildSimulatorUI.heroTitle")}</SectionTitle>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setHeroPickerOpen(true)}
              className="flex min-h-14 items-center gap-3 border border-night-700 bg-night-900/60 px-3 py-2 text-left transition-colors hover:border-gold-500/60"
            >
              {hero ? (
                <PortraitHeros source={hero.icon} nom={hero.name} taille="icone" decoratif />
              ) : (
                <span aria-hidden className="grid size-10 place-items-center bg-night-800 text-lg text-chalk-500">
                  ?
                </span>
              )}
              <span>
                <span className="block font-semibold text-chalk-100">{hero ? hero.name : t("pages.buildSimulatorUI.chooseHero")}</span>
                {hero && <span className="block text-xs text-chalk-500">{t("pages.buildSimulatorUI.changeHero")}</span>}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLevel(build.level - 1)}
                disabled={build.level <= LEVEL_MIN}
                aria-label={t("pages.buildSimulatorUI.levelDown")}
                className="grid size-11 place-items-center border border-night-700 text-chalk-300 transition-colors hover:border-gold-500/60 disabled:opacity-40"
              >
                <Minus size={16} aria-hidden />
              </button>
              <label className="flex flex-col items-center text-xs text-chalk-500">
                <span>{t("pages.buildSimulatorUI.level", { level: build.level })}</span>
                <input
                  type="range"
                  min={LEVEL_MIN}
                  max={LEVEL_MAX}
                  step={1}
                  value={build.level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  className="mt-1 h-6 w-32 accent-[var(--color-gold-500)] sm:w-40"
                />
              </label>
              <button
                type="button"
                onClick={() => setLevel(build.level + 1)}
                disabled={build.level >= LEVEL_MAX}
                aria-label={t("pages.buildSimulatorUI.levelUp")}
                className="grid size-11 place-items-center border border-night-700 text-chalk-300 transition-colors hover:border-gold-500/60 disabled:opacity-40"
              >
                <Plus size={16} aria-hidden />
              </button>
            </div>
          </div>
        </section>

        <section aria-labelledby="sim-items" className="space-y-4">
          <SectionTitle id="sim-items">{t("pages.buildSimulatorUI.itemsTitle")}</SectionTitle>
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: MAX_ITEMS }, (_, i) => {
              const item = build.items[i] ? itemsBySlug.get(build.items[i]) : undefined;
              const next = i === build.items.length;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSlot(i < build.items.length ? i : build.items.length)}
                    disabled={!item && !next}
                    aria-label={
                      item
                        ? t("pages.buildSimulatorUI.slotFilled", { n: i + 1, item: item.name })
                        : t("pages.buildSimulatorUI.slotEmpty", { n: i + 1 })
                    }
                    className={cn(
                      "flex h-full min-h-24 w-full flex-col items-center justify-center gap-1.5 border p-2 text-center transition-colors",
                      item
                        ? "border-night-700 bg-night-850 hover:border-gold-500/60"
                        : next
                          ? "border-dashed border-gold-500/50 text-gold-400 hover:border-gold-500"
                          : "border-dashed border-night-800 text-chalk-600",
                    )}
                  >
                    {item ? (
                      <>
                        <span className="relative size-11">
                          {item.image && <Image src={item.image} alt="" fill unoptimized className="object-contain" />}
                        </span>
                        <span className="line-clamp-2 text-[0.7rem] leading-tight text-chalk-200">{item.name}</span>
                      </>
                    ) : (
                      <Plus size={20} aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="sim-emblem" className="space-y-4">
          <SectionTitle id="sim-emblem">{t("pages.buildSimulatorUI.emblemTitle")}</SectionTitle>
          <fieldset>
            <legend className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.buildSimulatorUI.emblemSet")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.emblems.map((e) => (
                <ChoiceChip
                  key={e.key}
                  active={build.emblem === e.key}
                  onClick={() => update({ emblem: build.emblem === e.key ? null : e.key })}
                  image={e.image}
                  label={e.name}
                />
              ))}
            </div>
          </fieldset>
          {tierTalents.map((list, tier) => (
            <fieldset key={tier}>
              <legend className="text-xs uppercase tracking-wide text-chalk-500">{t(`pages.buildSimulatorUI.tiers.t${tier + 1}`)}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {list.map((tl) => (
                  <ChoiceChip
                    key={tl.key}
                    active={build.talents[tier] === tl.key}
                    onClick={() => setTalent(tier, build.talents[tier] === tl.key ? null : tl.key)}
                    image={tl.image}
                    label={tl.name}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </section>

        <section aria-labelledby="sim-spell" className="space-y-4">
          <SectionTitle id="sim-spell">{t("pages.buildSimulatorUI.spellTitle")}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {data.spells.map((s) => (
              <ChoiceChip
                key={s.key}
                active={build.spell === s.key}
                onClick={() => update({ spell: build.spell === s.key ? null : s.key })}
                image={s.image}
                label={s.name}
              />
            ))}
          </div>
          <p className="text-xs text-chalk-500">{t("pages.buildSimulatorUI.spellNote")}</p>
        </section>
      </div>

      <aside aria-labelledby="sim-result" className="min-w-0 space-y-8 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <section className="space-y-4">
          <SectionTitle id="sim-result">{t("pages.buildSimulatorUI.resultTitle")}</SectionTitle>
          {result && hero ? (
            <>
              <p className="text-sm text-chalk-400">
                {t("pages.buildSimulatorUI.resultFor", { hero: hero.name, level: result.level })}
              </p>
              <BuildStats result={result} names={names} resource={hero.sim.resource} />
            </>
          ) : (
            <p className="border border-dashed border-night-700 p-4 text-sm text-chalk-400">{t("pages.buildSimulatorUI.pickHeroFirst")}</p>
          )}
        </section>

        {hero && (
          <section aria-labelledby="sim-measured" className="space-y-3">
            <SectionTitle id="sim-measured">{t("pages.buildSimulatorUI.measuredTitle")}</SectionTitle>
            <ChoixRang rangs={RANGS_MESURE} rang={rank} onChange={setRank} />
            {heroCores === null ? (
              <p className="text-sm text-chalk-500">{t("pages.buildSimulatorUI.measuredLoading")}</p>
            ) : build.items.length === 0 ? (
              <p className="text-sm text-chalk-500">{t("pages.buildSimulatorUI.measuredNeedItems")}</p>
            ) : close.length === 0 ? (
              <p className="text-sm text-chalk-500">{t("pages.buildSimulatorUI.measuredNone")}</p>
            ) : (
              <ul className="space-y-2">
                {close.map((c, i) => (
                  <li key={`${c.lane}-${i}`} className="border border-night-800 bg-night-900/60 p-3">
                    <p className="text-sm font-semibold text-chalk-100">
                      {c.complete
                        ? t("pages.buildSimulatorUI.measuredSame")
                        : t("pages.buildSimulatorUI.measuredClose", { n: c.common, total: new Set(c.items).size })}
                    </p>
                    <ul className="mt-2 flex gap-1.5" aria-label={t("pages.buildSimulatorUI.measuredCoreItems")}>
                      {c.items.map((slug, j) => {
                        const it = itemsBySlug.get(slug);
                        return (
                          <li key={`${slug}-${j}`} title={it?.name ?? slug} className="relative size-9 bg-night-800">
                            {it?.image && <Image src={it.image} alt={it.name} fill unoptimized className="object-contain" />}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-sm text-chalk-300">
                      {t("pages.buildSimulatorUI.measuredRates", {
                        win: c.winRate === null ? "—" : percent.format(c.winRate / 100),
                        pick: c.pickRate === null ? "—" : percent.format(c.pickRate / 100),
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-chalk-500">
                      {t("pages.buildSimulatorUI.measuredWhere", {
                        lane: t(`lanes.${c.lane}`),
                        rank: t(`rangsMesure.${c.rank}`),
                        date: measuredDate,
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs leading-relaxed text-chalk-500">{t("pages.buildSimulatorUI.measuredSource")}</p>
          </section>
        )}

        <section aria-labelledby="sim-share" className="space-y-3">
          <SectionTitle id="sim-share">{t("pages.buildSimulatorUI.shareTitle")}</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              aria-label={t("pages.buildSimulatorUI.shareUrl")}
              onFocus={(e) => e.currentTarget.select()}
              className="bevel-sm h-11 min-w-0 flex-1 border border-night-700 bg-night-900 px-3 text-xs text-chalk-300 outline-none focus:border-gold-500"
            />
            <button
              type="button"
              onClick={copyLink}
              disabled={!build.hero}
              className="bevel-sm flex h-11 items-center gap-2 bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400 disabled:opacity-50"
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? t("pages.buildSimulatorUI.copied") : t("pages.buildSimulatorUI.copyLink")}
            </button>
          </div>
          <p aria-live="polite" className="sr-only">
            {copied ? t("pages.buildSimulatorUI.copied") : ""}
          </p>
        </section>

        {children?.(build)}
      </aside>

      {heroPickerOpen && (
        <SelecteurHeros
          heros={heroChoices}
          exclus={NO_EXCLUSION}
          lane={null}
          titre={t("pages.buildSimulatorUI.chooseHero")}
          onChoisir={(slug) => {
            update({ hero: slug });
            setHeroPickerOpen(false);
          }}
          onFermer={() => setHeroPickerOpen(false)}
        />
      )}
      {slot !== null && (
        <ItemPicker
          items={data.items}
          categories={data.categories}
          title={t("pages.buildSimulatorUI.pickItem", { n: slot + 1 })}
          current={build.items[slot] ? (itemsBySlug.get(build.items[slot]) ?? null) : null}
          onPick={pickItem}
          onRemove={removeItem}
          onClose={() => setSlot(null)}
        />
      )}
    </div>
  );
}
