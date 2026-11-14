"use client";

import Image from "next/image";
import { useId, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { FilterGroup, Chip } from "@/components/chip";
import { HeroSelector, type HeroPickable } from "@/components/hero-picker";
import { HeroPortrait } from "@/components/hero-portrait";
import { ItemPicker } from "@/components/item-picker";
import { Card } from "@/components/ui";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { EMPTY_BUILD, LEVEL_MAX, LEVEL_MIN, MAX_ITEMS } from "@/lib/build-code";
import { simulate, type SimCatalog } from "@/lib/build-simulator";
import {
  attackerFrom,
  basicAttack,
  damageCatalogFrom,
  defenderFrom,
  hit,
  type AttackerStats,
  type DamageCalculatorData,
  type DefenderStats,
  type HitKind,
  type HitOutcome,
} from "@/lib/damage-calculator";
import { readCount } from "@/lib/win-rate";
import { cn } from "@/lib/utils";

/**
 * Damage calculator: an attacker, a defender, and what one hit does.
 *
 * Each side is either a hero (level, six items, emblem set), whose stats come
 * from the build simulator, or figures typed by hand - the stats a player
 * reads in a match, with whatever the calculator cannot know (talents, skill
 * buffs) already in them. Everything is computed in the browser on every
 * change; nothing is sent.
 */

type Role = "attacker" | "defender";
type Mode = "hero" | "manual";

interface HeroSide {
  hero: string | null;
  level: number;
  items: string[];
  emblem: string | null;
}

interface Side {
  mode: Mode;
  build: HeroSide;
  /** Typed figures, kept as text: a field being edited may be empty or half written. */
  manual: Record<string, string>;
}

/** Typed fields of each side, keyed by the simulator's stat names (their labels already exist). */
const MANUAL_FIELDS = {
  attacker: [
    { key: "physicalAttack", percent: false },
    { key: "critChance", percent: true },
    { key: "critDamage", percent: true },
    { key: "physicalPenFlat", percent: false },
    { key: "physicalPenPercent", percent: true },
    { key: "magicPenFlat", percent: false },
    { key: "magicPenPercent", percent: true },
  ],
  defender: [
    { key: "hp", percent: false },
    { key: "physicalDefense", percent: false },
    { key: "magicDefense", percent: false },
  ],
} as const;

/** Plausible figures to start from: a marksman's late-game attack, a fighter's bulk. */
const START: Record<Role, Record<string, string>> = {
  attacker: {
    physicalAttack: "400",
    critChance: "0",
    critDamage: "200",
    physicalPenFlat: "0",
    physicalPenPercent: "0",
    magicPenFlat: "0",
    magicPenPercent: "0",
  },
  defender: { hp: "5000", physicalDefense: "80", magicDefense: "50" },
};

const emptySide = (role: Role): Side => ({
  mode: "hero",
  build: { hero: null, level: EMPTY_BUILD.level, items: [], emblem: null },
  manual: START[role],
});

/** A typed figure, or null when unreadable or out of range (HP must be positive, a percentage at most 100). */
function readField(text: string | undefined, key: string, percent: boolean): number | null {
  const v = readCount(text ?? "");
  if (v === null || v < 0) return null;
  if (key === "hp" && v <= 0) return null;
  // Crit damage is a multiplier (200%), not a share: only the other percentages stop at 100.
  if (percent && key !== "critDamage" && v > 100) return null;
  return v;
}

function simulated(side: Side, catalog: SimCatalog) {
  if (!side.build.hero) return null;
  return simulate({ ...EMPTY_BUILD, ...side.build, talents: [null, null, null] }, catalog);
}

function attackerOf(side: Side, catalog: SimCatalog): AttackerStats | null {
  if (side.mode === "hero") {
    const r = simulated(side, catalog);
    return r ? attackerFrom(r) : null;
  }
  const v = Object.fromEntries(MANUAL_FIELDS.attacker.map((f) => [f.key, readField(side.manual[f.key], f.key, f.percent)]));
  if (Object.values(v).some((x) => x === null)) return null;
  return {
    physicalAttack: v.physicalAttack!,
    critChance: v.critChance!,
    critDamage: v.critDamage!,
    physicalPen: { flat: v.physicalPenFlat!, percent: v.physicalPenPercent! },
    magicPen: { flat: v.magicPenFlat!, percent: v.magicPenPercent! },
  };
}

function defenderOf(side: Side, catalog: SimCatalog): DefenderStats | null {
  if (side.mode === "hero") {
    const r = simulated(side, catalog);
    return r ? defenderFrom(r) : null;
  }
  const v = Object.fromEntries(MANUAL_FIELDS.defender.map((f) => [f.key, readField(side.manual[f.key], f.key, f.percent)]));
  if (Object.values(v).some((x) => x === null)) return null;
  return { hp: v.hp!, physicalDefense: v.physicalDefense!, magicDefense: v.magicDefense! };
}

const NO_EXCLUSION = new Set<string>();

type Picker = { role: Role; slot: number | null } | null;

export function DamageCalculator({ data }: { data: DamageCalculatorData }) {
  const t = useT();
  const locale = LOCALE_INTL[useLocale()];
  const catalog = useMemo(() => damageCatalogFrom(data), [data]);
  const heroChoices = useMemo<HeroPickable[]>(
    () => data.heroes.map((h) => ({ slug: h.slug, name: h.name, lanes: h.lanes, roles: h.roles, icon: h.icon })),
    [data],
  );
  const itemsBySlug = useMemo(() => new Map(data.items.map((o) => [o.slug, o])), [data]);

  const [sides, setSides] = useState<Record<Role, Side>>(() => ({ attacker: emptySide("attacker"), defender: emptySide("defender") }));
  const [kind, setKind] = useState<"basic" | "raw">("basic");
  const [raw, setRaw] = useState("500");
  const [rawKind, setRawKind] = useState<HitKind>("magic");
  const [heroPicker, setHeroPicker] = useState<Role | null>(null);
  const [itemPicker, setItemPicker] = useState<Picker>(null);

  const change = (role: Role, f: (s: Side) => Side) => setSides((all) => ({ ...all, [role]: f(all[role]) }));
  const changeBuild = (role: Role, b: Partial<HeroSide>) => change(role, (s) => ({ ...s, build: { ...s.build, ...b } }));

  const attacker = attackerOf(sides.attacker, catalog);
  const defender = defenderOf(sides.defender, catalog);
  const rawValue = readCount(raw);
  const rawValid = rawValue !== null && rawValue >= 0;

  const pickItem = (slug: string) => {
    if (!itemPicker || itemPicker.slot === null) return;
    const { role, slot } = itemPicker;
    change(role, (s) => {
      const items = [...s.build.items];
      if (slot < items.length) items[slot] = slug;
      else if (items.length < MAX_ITEMS) items.push(slug);
      return { ...s, build: { ...s.build, items } };
    });
    setItemPicker(null);
  };
  const removeItem = () => {
    if (!itemPicker || itemPicker.slot === null) return;
    const { role, slot } = itemPicker;
    change(role, (s) => ({ ...s, build: { ...s.build, items: s.build.items.filter((_, i) => i !== slot) } }));
    setItemPicker(null);
  };
  const pickerSlot = itemPicker?.slot ?? null;
  const pickerCurrent = itemPicker && pickerSlot !== null ? sides[itemPicker.role].build.items[pickerSlot] : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {(["attacker", "defender"] as const).map((role) => (
          <SideEditor
            key={role}
            role={role}
            side={sides[role]}
            data={data}
            catalog={catalog}
            itemsBySlug={itemsBySlug}
            locale={locale}
            onMode={(mode) => change(role, (s) => ({ ...s, mode }))}
            onBuild={(b) => changeBuild(role, b)}
            onManual={(key, value) => change(role, (s) => ({ ...s, manual: { ...s.manual, [key]: value } }))}
            onPickHero={() => setHeroPicker(role)}
            onPickItem={(slot) => setItemPicker({ role, slot })}
          />
        ))}
      </div>

      <Card>
        <h2 id="dmg-hit" className="font-heading text-xl font-bold text-chalk-100">
          {t("pages.damageCalculatorUI.hitTitle")}
        </h2>
        <FilterGroup legend={t("pages.damageCalculatorUI.hitKind")} widthLegend="w-auto" className="mt-4">
          <Chip active={kind === "basic"} onClick={() => setKind("basic")}>
            {t("pages.damageCalculatorUI.basicAttack")}
          </Chip>
          <Chip active={kind === "raw"} onClick={() => setKind("raw")}>
            {t("pages.damageCalculatorUI.rawHit")}
          </Chip>
        </FilterGroup>
        {kind === "raw" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-end">
            <NumberField
              label={t("pages.damageCalculatorUI.rawAmount")}
              value={raw}
              onChange={setRaw}
              invalid={!rawValid}
            />
            <FilterGroup legend={t("pages.damageCalculatorUI.damageType")} widthLegend="w-auto">
              {(["physical", "magic", "true"] as const).map((k) => (
                <Chip key={k} dense active={rawKind === k} onClick={() => setRawKind(k)}>
                  {t(`pages.damageCalculatorUI.kinds.${k}`)}
                </Chip>
              ))}
            </FilterGroup>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-chalk-500">{t("pages.damageCalculatorUI.basicNote")}</p>
        )}
      </Card>

      <section aria-labelledby="dmg-result" aria-live="polite">
        <Card className="border-gold-500/30">
          <h2 id="dmg-result" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.damageCalculatorUI.resultTitle")}
          </h2>
          {!attacker || !defender ? (
            <p className="mt-3 text-sm leading-relaxed text-chalk-400">
              {!attacker ? t("pages.damageCalculatorUI.missingAttacker") : t("pages.damageCalculatorUI.missingDefender")}
            </p>
          ) : kind === "raw" && !rawValid ? (
            <p className="mt-3 text-sm leading-relaxed text-chalk-400">{t("pages.damageCalculatorUI.invalidRaw")}</p>
          ) : kind === "raw" ? (
            <Outcome outcome={hit(rawValue!, rawKind, attacker, defender)} defender={defender} locale={locale} />
          ) : (
            <BasicOutcome attacker={attacker} defender={defender} locale={locale} />
          )}
        </Card>
      </section>

      {heroPicker && (
        <HeroSelector
          heroes={heroChoices}
          excluded={NO_EXCLUSION}
          lane={null}
          title={t(`pages.damageCalculatorUI.chooseHero.${heroPicker}`)}
          onChoose={(slug) => {
            changeBuild(heroPicker, { hero: slug });
            setHeroPicker(null);
          }}
          onClose={() => setHeroPicker(null)}
        />
      )}
      {itemPicker && pickerSlot !== null && (
        <ItemPicker
          items={data.items}
          categories={data.categories}
          title={t("pages.damageCalculatorUI.pickItem", { n: pickerSlot + 1 })}
          current={pickerCurrent ? (itemsBySlug.get(pickerCurrent) ?? null) : null}
          onPick={pickItem}
          onRemove={removeItem}
          onClose={() => setItemPicker(null)}
        />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  invalid,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  suffix?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs uppercase leading-tight tracking-wide text-chalk-500">
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
          className="bevel-sm h-11 w-full border border-night-700 bg-night-900 pl-3 pr-8 tabular-nums text-chalk-100 outline-none transition-colors focus:border-gold-500 aria-invalid:border-blood-500/70"
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

function SideEditor({
  role,
  side,
  data,
  catalog,
  itemsBySlug,
  locale,
  onMode,
  onBuild,
  onManual,
  onPickHero,
  onPickItem,
}: {
  role: Role;
  side: Side;
  data: DamageCalculatorData;
  catalog: SimCatalog;
  itemsBySlug: Map<string, DamageCalculatorData["items"][number]>;
  locale: string;
  onMode: (mode: Mode) => void;
  onBuild: (b: Partial<HeroSide>) => void;
  onManual: (key: string, value: string) => void;
  onPickHero: () => void;
  onPickItem: (slot: number) => void;
}) {
  const t = useT();
  const emblemId = useId();
  const hero = side.build.hero ? data.heroes.find((h) => h.slug === side.build.hero) : undefined;
  const { level, items } = side.build;
  const setLevel = (n: number) => onBuild({ level: Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n)) });
  const result = side.mode === "hero" ? simulated(side, catalog) : null;
  const titleId = `dmg-${role}`;

  return (
    <section aria-labelledby={titleId}>
      <Card className="h-full space-y-4">
        <h2 id={titleId} className="font-heading text-xl font-bold text-chalk-100">
          {t(`pages.damageCalculatorUI.${role}Title`)}
        </h2>
        <FilterGroup legend={t("pages.damageCalculatorUI.source")} widthLegend="sr-only">
          <Chip dense active={side.mode === "hero"} onClick={() => onMode("hero")}>
            {t("pages.damageCalculatorUI.modeHero")}
          </Chip>
          <Chip dense active={side.mode === "manual"} onClick={() => onMode("manual")}>
            {t("pages.damageCalculatorUI.modeManual")}
          </Chip>
        </FilterGroup>

        {side.mode === "hero" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onPickHero}
                className="flex min-h-14 w-full min-w-0 items-center sm:w-auto sm:flex-1 gap-3 border border-night-700 bg-night-900/60 px-3 py-2 text-left transition-colors hover:border-gold-500/60"
              >
                {hero ? (
                  <HeroPortrait source={hero.icon} name={hero.name} size="icon" decorative />
                ) : (
                  <span aria-hidden className="grid size-10 place-items-center bg-night-800 text-lg text-chalk-500">
                    ?
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-chalk-100">
                    {hero ? hero.name : t(`pages.damageCalculatorUI.chooseHero.${role}`)}
                  </span>
                  {hero && <span className="block text-xs text-chalk-500">{t("pages.damageCalculatorUI.changeHero")}</span>}
                </span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLevel(level - 1)}
                  disabled={level <= LEVEL_MIN}
                  aria-label={t("pages.damageCalculatorUI.levelDown")}
                  className="grid size-11 place-items-center border border-night-700 text-chalk-300 transition-colors hover:border-gold-500/60 disabled:opacity-40"
                >
                  <Minus size={16} aria-hidden />
                </button>
                <span aria-live="polite" className="w-20 text-center text-sm tabular-nums text-chalk-200">
                  {t("pages.damageCalculatorUI.level", { level })}
                </span>
                <button
                  type="button"
                  onClick={() => setLevel(level + 1)}
                  disabled={level >= LEVEL_MAX}
                  aria-label={t("pages.damageCalculatorUI.levelUp")}
                  className="grid size-11 place-items-center border border-night-700 text-chalk-300 transition-colors hover:border-gold-500/60 disabled:opacity-40"
                >
                  <Plus size={16} aria-hidden />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.damageCalculatorUI.items")}</p>
              <ol className="mt-2 grid grid-cols-6 gap-1.5">
                {Array.from({ length: MAX_ITEMS }, (_, i) => {
                  const item = items[i] ? itemsBySlug.get(items[i]) : undefined;
                  const next = i === items.length;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => onPickItem(i < items.length ? i : items.length)}
                        disabled={!item && !next}
                        aria-label={
                          item
                            ? t("pages.damageCalculatorUI.slotFilled", { n: i + 1, item: item.name })
                            : t("pages.damageCalculatorUI.slotEmpty", { n: i + 1 })
                        }
                        title={item?.name}
                        className={cn(
                          "grid aspect-square w-full min-h-11 place-items-center border transition-colors",
                          item
                            ? "border-night-700 bg-night-850 hover:border-gold-500/60"
                            : next
                              ? "border-dashed border-gold-500/50 text-gold-400 hover:border-gold-500"
                              : "border-dashed border-night-800 text-chalk-600",
                        )}
                      >
                        {item?.image ? (
                          <Image src={item.image} alt="" width={40} height={40} className="size-4/5 object-contain" />
                        ) : (
                          !item && <Plus size={16} aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div>
              <label htmlFor={emblemId} className="block text-xs uppercase tracking-wide text-chalk-500">
                {t("pages.damageCalculatorUI.emblem")}
              </label>
              <select
                id={emblemId}
                value={side.build.emblem ?? ""}
                onChange={(e) => onBuild({ emblem: e.target.value || null })}
                className="bevel-sm mt-1.5 h-11 w-full border border-night-700 bg-night-900 px-3 text-sm text-chalk-100 outline-none focus:border-gold-500"
              >
                <option value="">{t("pages.damageCalculatorUI.noEmblem")}</option>
                {data.emblems.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            {result && <HeroFigures role={role} result={result} locale={locale} />}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {MANUAL_FIELDS[role].map((f) => (
              <NumberField
                key={f.key}
                label={t(`pages.buildSimulatorUI.stats.${f.key}`)}
                value={side.manual[f.key] ?? ""}
                onChange={(v) => onManual(f.key, v)}
                invalid={readField(side.manual[f.key], f.key, f.percent) === null}
                suffix={f.percent ? "%" : undefined}
              />
            ))}
            <p className="col-span-2 text-xs leading-relaxed text-chalk-500">{t(`pages.damageCalculatorUI.manualNote.${role}`)}</p>
          </div>
        )}
      </Card>
    </section>
  );
}

/** The stats a side brings to the calculation, so a hero's figures can be checked against the game's. */
function HeroFigures({ role, result, locale }: { role: Role; result: NonNullable<ReturnType<typeof simulate>>; locale: string }) {
  const t = useT();
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const keys =
    role === "attacker"
      ? (["physicalAttack", "critChance", "physicalPenFlat", "physicalPenPercent", "magicPenFlat", "magicPenPercent"] as const)
      : (["hp", "physicalDefense", "magicDefense"] as const);
  const isPercent = (k: string) => k === "critChance" || k.endsWith("Percent");
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-night-800 pt-3 text-sm sm:grid-cols-3">
        {keys.map((k) => {
          const v = result.stats[k].value;
          return (
            <div key={k} className="min-w-0">
              <dt className="text-[0.65rem] uppercase leading-tight tracking-wide text-chalk-500">{t(`pages.buildSimulatorUI.stats.${k}`)}</dt>
              <dd className="font-semibold tabular-nums text-chalk-100">
                {v === null ? "—" : isPercent(k) ? percent.format(v / 100) : whole.format(v)}
              </dd>
            </div>
          );
        })}
      </dl>
      {result.interpolated && (
        <p className="mt-2 text-xs leading-relaxed text-chalk-500">{t("pages.damageCalculatorUI.interpolated", { level: result.level })}</p>
      )}
    </div>
  );
}

function formatters(locale: string) {
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return {
    damage: (v: number) => (Math.abs(v) < 100 ? decimal.format(v) : whole.format(v)),
    whole: (v: number) => whole.format(v),
    percent: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }),
  };
}

function Outcome({
  outcome: o,
  defender,
  locale,
  label,
  details = true,
}: {
  outcome: HitOutcome;
  defender: DefenderStats;
  locale: string;
  label?: string;
  /** Defense, share and effective HP: the same for a hit and its crit, shown once. */
  details?: boolean;
}) {
  const t = useT();
  const f = formatters(locale);
  const baseDefense = o.kind === "physical" ? defender.physicalDefense : o.kind === "magic" ? defender.magicDefense : null;
  return (
    <div className="mt-4">
      {label && <p className="text-xs uppercase tracking-wide text-chalk-500">{label}</p>}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <p className="flex flex-col">
          <span className="font-heading text-4xl font-bold tabular-nums text-gold-400 sm:text-5xl">{f.damage(o.damage)}</span>
          <span className="text-sm text-chalk-300">{t("pages.damageCalculatorUI.damagePerHit")}</span>
        </p>
        <p className="flex flex-col">
          <span className="font-heading text-4xl font-bold tabular-nums text-chalk-100 sm:text-5xl">
            {o.hitsToKill === null ? "—" : f.whole(o.hitsToKill)}
          </span>
          <span className="text-sm text-chalk-300">{t("pages.damageCalculatorUI.hitsToKill")}</span>
        </p>
      </div>
      {details && (
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-night-800 pt-3 text-sm sm:grid-cols-2">
        <Row term={t("pages.damageCalculatorUI.rawDamage")} value={f.damage(o.raw)} />
        <Row
          term={t("pages.damageCalculatorUI.defenseAfter")}
          value={
            o.defense === null || baseDefense === null
              ? t("pages.damageCalculatorUI.ignored")
              : t("pages.damageCalculatorUI.defenseFromTo", { from: f.damage(baseDefense), to: f.damage(o.defense) })
          }
        />
        <Row term={t("pages.damageCalculatorUI.share")} value={f.percent.format(o.multiplier)} />
        <Row term={t("pages.damageCalculatorUI.effectiveHp")} value={f.whole(o.effectiveHp)} />
        <Row term={t("pages.damageCalculatorUI.defenderHp")} value={f.whole(defender.hp)} />
      </dl>
      )}
    </div>
  );
}

function BasicOutcome({ attacker, defender, locale }: { attacker: AttackerStats; defender: DefenderStats; locale: string }) {
  const t = useT();
  const f = formatters(locale);
  const r = basicAttack(attacker, defender);
  return (
    <>
      <Outcome outcome={r.normal} defender={defender} locale={locale} label={r.crit ? t("pages.damageCalculatorUI.normalHit") : undefined} />
      {r.crit && (
        <div className="mt-6 border-t border-night-800 pt-4">
          <Outcome outcome={r.crit} defender={defender} locale={locale} label={t("pages.damageCalculatorUI.critHit")} details={false} />
          <p className="mt-3 text-sm leading-relaxed text-chalk-300">
            {t("pages.damageCalculatorUI.average", {
              damage: f.damage(r.average),
              chance: f.percent.format(Math.min(100, attacker.critChance) / 100),
            })}
          </p>
        </div>
      )}
    </>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-chalk-500">{term}</dt>
      <dd className="text-right font-semibold tabular-nums text-chalk-100">{value}</dd>
    </div>
  );
}
