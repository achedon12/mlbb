"use client";

import { useId, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  PERCENT_STATS,
  damageShare,
  type BuildNames,
  type Resource,
  type SimResult,
  type Source,
  type StatKey,
} from "@/lib/build-simulator";
import { cn } from "@/lib/utils";

/**
 * Computed stats of a build, with their breakdown on demand: the hero's
 * base, what the items add, what the emblem and talents add. Used by the
 * simulator and by the community build pages.
 *
 * The breakdown uses `<details>`: it opens with the keyboard as with touch,
 * and screen readers announce it collapsed or expanded with no extra script.
 */

const GROUPS: { key: string; stats: StatKey[] }[] = [
  { key: "survival", stats: ["hp", "mana", "physicalDefense", "magicDefense", "hpRegen", "manaRegen"] },
  {
    key: "offense",
    stats: [
      "physicalAttack",
      "magicPower",
      "attackSpeed",
      "critChance",
      "critDamage",
      "physicalPenFlat",
      "physicalPenPercent",
      "magicPenFlat",
      "magicPenPercent",
    ],
  },
  { key: "utility", stats: ["cooldownReduction", "lifesteal", "spellVamp", "movementSpeed", "movementSpeedPercent"] },
];

/** Default target defense: about a hero's in mid game. */
const DEFAULT_TARGET_DEFENSE = 60;

export function BuildStats({
  result,
  names,
  resource,
  compact = false,
}: {
  result: SimResult;
  names: BuildNames;
  resource: Resource;
  /** Without the side blocks (damage reference, notes), for a build page summary. */
  compact?: boolean;
}) {
  const t = useT();
  const langue = useLangue();
  const locale = LOCALE_HTML[langue];
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const signedPercent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "always" });
  const signed = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: "always" });

  const format = (key: StatKey, v: number | null) =>
    v === null ? "—" : PERCENT_STATS.has(key) ? percent.format(v / 100) : Math.abs(v) < 20 ? decimal.format(v) : whole.format(v);
  const formatAdded = (key: StatKey, v: number) => (PERCENT_STATS.has(key) ? signedPercent.format(v / 100) : signed.format(v));

  const sourceName = (s: Source) => {
    const name = s.origin === "emblem" ? names.emblems[s.key] : s.origin === "talent" ? names.talents[s.key] : names.items[s.key];
    const detail =
      s.origin === "passive"
        ? t("pages.buildSimulatorUI.detailPassive")
        : s.origin === "conversion"
          ? t("pages.buildSimulatorUI.detailConversion")
          : s.adaptive
            ? t("pages.buildSimulatorUI.detailAdaptive")
            : null;
    return detail ? `${name ?? s.key} (${detail})` : (name ?? s.key);
  };

  const stats = result.stats;
  const [defense, setDefense] = useState(String(DEFAULT_TARGET_DEFENSE));
  const defenseId = useId();
  const defenseValue = Number(defense.replace(",", "."));
  const defenseValid = defense.trim() !== "" && Number.isFinite(defenseValue) && defenseValue >= 0 && defenseValue <= 1000;
  const share = (pct: StatKey, flat: StatKey) => damageShare(defenseValue, stats[pct].value ?? 0, stats[flat].value ?? 0);

  const notes: string[] = [];
  if (result.interpolated) notes.push(t("pages.buildSimulatorUI.noteInterpolated", { level: result.level }));
  notes.push(t("pages.buildSimulatorUI.noteHpRegen"));
  notes.push(t("pages.buildSimulatorUI.noteAttackSpeed"));
  notes.push(t("pages.buildSimulatorUI.noteMovement"));
  if (result.adaptive) notes.push(t(`pages.buildSimulatorUI.noteAdaptive.${result.adaptive}`));
  if (resource !== "mana") notes.push(t(`pages.buildSimulatorUI.noteResource.${resource}`));
  if (result.critToAttackSpeed) notes.push(t("pages.buildSimulatorUI.noteConversion"));

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => (
        <section key={g.key}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-chalk-500">{t(`pages.buildSimulatorUI.groups.${g.key}`)}</h3>
          <ul className="mt-1.5 divide-y divide-night-800 border-y border-night-800">
            {g.stats.map((key) => {
              const s = stats[key];
              const fromItems = s.sources.filter((x) => x.origin === "item" || x.origin === "passive" || x.origin === "conversion");
              const fromEmblem = s.sources.filter((x) => x.origin === "emblem" || x.origin === "talent");
              const sum = (list: Source[]) => list.reduce((n, x) => n + x.value, 0);
              const capped = s.cap !== null && s.raw !== null && s.raw > s.cap;
              const idle = s.sources.length === 0 && (s.value === 0 || s.value === null);
              return (
                <li key={key}>
                  <details className="group">
                    <summary
                      className={cn(
                        "flex min-h-11 cursor-pointer list-none items-center gap-2 py-1.5 text-sm [&::-webkit-details-marker]:hidden",
                        idle ? "text-chalk-500" : "text-chalk-200",
                      )}
                    >
                      <ChevronDown size={14} aria-hidden className="shrink-0 text-chalk-600 transition-transform group-open:rotate-180" />
                      <span className="min-w-0 flex-1">{t(`pages.buildSimulatorUI.stats.${key}`)}</span>
                      {capped && (
                        <span className="shrink-0 bg-gold-500/15 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-gold-400">
                          {t("pages.buildSimulatorUI.capped")}
                        </span>
                      )}
                      <span className={cn("shrink-0 font-heading text-base font-bold tabular-nums", idle ? "text-chalk-500" : "text-chalk-100")}>
                        {format(key, s.value)}
                      </span>
                    </summary>
                    <div className="mb-2 ml-5 space-y-1 border-l border-night-700 pl-3 text-xs text-chalk-400">
                      <p className="flex justify-between gap-3">
                        <span>
                          {key === "hpRegen"
                            ? t("pages.buildSimulatorUI.baseLevel1")
                            : t("pages.buildSimulatorUI.base", { level: result.level })}
                        </span>
                        <span className="tabular-nums text-chalk-200">
                          {s.base === null ? t("pages.buildSimulatorUI.baseUnknown") : format(key, s.base)}
                        </span>
                      </p>
                      <p className="flex justify-between gap-3">
                        <span>{t("pages.buildSimulatorUI.fromItems")}</span>
                        <span className="tabular-nums text-chalk-200">{formatAdded(key, sum(fromItems))}</span>
                      </p>
                      <p className="flex justify-between gap-3">
                        <span>{t("pages.buildSimulatorUI.fromEmblem")}</span>
                        <span className="tabular-nums text-chalk-200">{formatAdded(key, sum(fromEmblem))}</span>
                      </p>
                      {s.sources.length > 0 && (
                        <ul className="space-y-0.5 pt-1 text-chalk-500">
                          {s.sources.map((x, i) => (
                            <li key={`${x.origin}-${x.key}-${i}`} className="flex justify-between gap-3">
                              <span className="min-w-0">{sourceName(x)}</span>
                              <span className="shrink-0 tabular-nums">{formatAdded(key, x.value)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {capped && (
                        <p className="text-gold-400">
                          {t("pages.buildSimulatorUI.capDetail", { cap: format(key, s.cap), raw: format(key, s.raw) })}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-chalk-500">{t("pages.buildSimulatorUI.derived")}</h3>
        <dl className="mt-1.5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
          <div className="border border-night-800 bg-night-900/60 p-2.5">
            <dt className="text-xs text-chalk-500">{t("pages.buildSimulatorUI.gold")}</dt>
            <dd className="font-heading text-lg font-bold tabular-nums text-gold-400">{whole.format(result.gold)}</dd>
            {result.discountedGold !== null && (
              <dd className="text-xs text-chalk-400">
                {t("pages.buildSimulatorUI.goldDiscounted", { gold: whole.format(result.discountedGold) })}
              </dd>
            )}
          </div>
          <div className="border border-night-800 bg-night-900/60 p-2.5">
            <dt className="text-xs text-chalk-500">{t("pages.buildSimulatorUI.effectiveHpPhysical")}</dt>
            <dd className="font-heading text-lg font-bold tabular-nums text-chalk-100">{format("hp", result.effectiveHp.physical)}</dd>
          </div>
          <div className="border border-night-800 bg-night-900/60 p-2.5">
            <dt className="text-xs text-chalk-500">{t("pages.buildSimulatorUI.effectiveHpMagic")}</dt>
            <dd className="font-heading text-lg font-bold tabular-nums text-chalk-100">{format("hp", result.effectiveHp.magic)}</dd>
          </div>
        </dl>
        <p className="mt-1.5 text-xs leading-relaxed text-chalk-500">{t("pages.buildSimulatorUI.effectiveHpHelp")}</p>

        {!compact && (
          <div className="mt-4 border border-night-800 bg-night-900/60 p-3">
            <label htmlFor={defenseId} className="text-xs text-chalk-400">
              {t("pages.buildSimulatorUI.targetDefense")}
            </label>
            <input
              id={defenseId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={defense}
              onChange={(e) => setDefense(e.target.value)}
              aria-invalid={!defenseValid || undefined}
              aria-describedby={`${defenseId}-help`}
              className="bevel-sm mt-1 block h-11 w-28 border border-night-700 bg-night-900 px-3 tabular-nums text-chalk-100 outline-none focus:border-gold-500 aria-invalid:border-blood-500/70"
            />
            {defenseValid ? (
              <ul className="mt-2 space-y-1 text-sm text-chalk-300" aria-live="polite">
                <li>
                  {t("pages.buildSimulatorUI.physicalShare", {
                    share: percent.format(share("physicalPenPercent", "physicalPenFlat")),
                    without: percent.format(damageShare(defenseValue, 0, 0)),
                  })}
                </li>
                <li>
                  {t("pages.buildSimulatorUI.magicShare", {
                    share: percent.format(share("magicPenPercent", "magicPenFlat")),
                    without: percent.format(damageShare(defenseValue, 0, 0)),
                  })}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-blood-500">{t("pages.buildSimulatorUI.invalidDefense")}</p>
            )}
            <p id={`${defenseId}-help`} className="mt-2 text-xs leading-relaxed text-chalk-500">
              {t("pages.buildSimulatorUI.shareHelp")}
            </p>
          </div>
        )}
      </section>

      {result.conflicts.length > 0 && (
        <section className="border border-blood-500/40 bg-blood-500/5 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-chalk-100">
            <AlertTriangle size={16} aria-hidden className="text-blood-500" />
            {t("pages.buildSimulatorUI.conflicts")}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-chalk-300">
            {result.conflicts.map((c, i) => (
              <li key={i}>
                {c.type === "passive"
                  ? t("pages.buildSimulatorUI.conflictPassive", {
                      passive: c.name,
                      items: [...new Set(c.items)].map((o) => names.items[o] ?? o).join(", "),
                    })
                  : c.type === "unique"
                    ? t("pages.buildSimulatorUI.conflictUnique", { item: names.items[c.item] ?? c.item })
                    : t("pages.buildSimulatorUI.conflictBoots", { items: c.items.map((o) => names.items[o] ?? o).join(", ") })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(result.uncomputed.length > 0 || result.others.length > 0 || result.resourceIgnored) && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-chalk-500">{t("pages.buildSimulatorUI.notComputed")}</h3>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-chalk-400">
            {result.uncomputed.length > 0 && (
              <li>
                {t("pages.buildSimulatorUI.conditionalPassives", {
                  list: result.uncomputed.map((p) => `${p.passive} (${names.items[p.item] ?? p.item})`).join(", "),
                })}
              </li>
            )}
            {result.others.length > 0 && (
              <li>
                {t("pages.buildSimulatorUI.otherAttributes", {
                  list: result.others
                    .map((a) => `${a.text} (${(a.origin === "emblem" ? names.emblems[a.key] : names.items[a.key]) ?? a.key})`)
                    .join(", "),
                })}
              </li>
            )}
            {result.resourceIgnored && <li>{t("pages.buildSimulatorUI.resourceIgnored")}</li>}
          </ul>
        </section>
      )}

      {!compact && (
        <ul className="space-y-1 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
