"use client";

import { useState } from "react";
import { HeroPortrait } from "@/components/hero-portrait";
import Link from "@/components/link";
import { ArrowRight, ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { HeroAdjustment, AdjustmentType } from "@/lib/types";
import { useT } from "@/i18n/provider";

/** Adjustment enriched server-side: portrait and detail-page existence resolved. */
export interface EnrichedAdjustment extends HeroAdjustment {
  portrait: string | null;
  sheet: boolean;
}
import { cn } from "@/lib/utils";

/**
 * Hero adjustments of a patch.
 *
 * The notes' wikitext follows a regular grammar: each hero has a type
 * — buff, nerf, adjustment — and, when the wiki details them, « before →
 * after » changes. We show them as a list: portrait, type badge, and the
 * detail expanded on demand. A wall of text becomes a list where you find
 * your hero at a glance.
 */
const STYLE: Record<
  AdjustmentType,
  { color: string; background: string; icon: React.ReactNode }
> = {
  buff: {
    color: "text-emerald-400",
    background: "border-emerald-500/30",
    icon: <TrendingUp size={14} aria-hidden />,
  },
  nerf: {
    color: "text-blood-500",
    background: "border-blood-500/30",
    icon: <TrendingDown size={14} aria-hidden />,
  },
  adjust: {
    color: "text-azure-400",
    background: "border-azure-500/30",
    icon: <Minus size={14} aria-hidden />,
  },
};

export function HeroPatch({
  adjustments,
  summary,
}: {
  adjustments: EnrichedAdjustment[];
  summary: Record<AdjustmentType, number>;
}) {
  const t = useT();
  const [filter, setFilter] = useState<AdjustmentType | null>(null);

  const visible = filter ? adjustments.filter((a) => a.type === filter) : adjustments;

  return (
    <div>
      {/* Summary: three counters that filter the list. */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STYLE) as AdjustmentType[]).map((type) => {
          const active = filter === type;
          const s = STYLE[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(active ? null : type)}
              aria-pressed={active}
              className={cn(
                "bevel-sm flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors",
                active ? `${s.background} bg-night-850` : "border-night-700 hover:border-night-600",
              )}
            >
              <span className={s.color}>{s.icon}</span>
              <span className="font-semibold text-chalk-100">{summary[type] ?? 0}</span>
              <span className="text-chalk-500">{t(`patchHeroes.plural.${type}`)}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 space-y-2">
        {visible.map((a) => (
          <HeroRow key={a.slug + a.name} adjustment={a} portrait={a.portrait} sheet={a.sheet} />
        ))}
      </ul>
    </div>
  );
}

/**
 * A hero's adjustments across patches, newest to oldest: the same row as in
 * the patch notes, titled by the version.
 */
export function HeroAdjustments({
  entries,
  portrait,
}: {
  entries: { version: string; adjustment: HeroAdjustment }[];
  portrait: string | null;
}) {
  const t = useT();
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <HeroRow
          key={e.version}
          adjustment={e.adjustment}
          portrait={portrait}
          title={`Patch ${e.version}`}
          link={{ href: `/patch-notes/${e.version}`, label: t("patchHeroes.seePatch", { version: e.version }) }}
        />
      ))}
    </ul>
  );
}

function HeroRow({
  adjustment,
  portrait,
  sheet = false,
  title,
  link,
}: {
  adjustment: HeroAdjustment;
  portrait: string | null;
  sheet?: boolean;
  /** Replaces the hero name, when the list covers a single hero. */
  title?: string;
  link?: { href: string; label: string };
}) {
  const t = useT();
  const target =
    link ?? (sheet ? { href: `/heroes/${adjustment.slug}`, label: t("patchHeroes.seeSheet", { name: adjustment.name }) } : null);
  const [open, setOpen] = useState(false);
  const s = adjustment.type ? STYLE[adjustment.type] : null;
  const detailed = adjustment.sections.length > 0 || adjustment.intro.length > 0;

  return (
    <li className={cn("bevel border bg-night-900/60", s?.background ?? "border-night-700/70")}>
      <button
        type="button"
        onClick={() => detailed && setOpen((o) => !o)}
        aria-expanded={detailed ? open : undefined}
        className={cn(
          "flex w-full items-center gap-3 p-3 text-left",
          detailed ? "cursor-pointer" : "cursor-default",
        )}
      >
        <HeroPortrait source={portrait} name={adjustment.name} size="medium" decorative />

        <span className="min-w-0 flex-1">
          <span className="font-heading font-bold text-chalk-100">{title ?? adjustment.name}</span>
          {s && (
            <span className={cn("mt-0.5 flex items-center gap-1 text-xs font-semibold", s.color)}>
              {s.icon}
              {t(`patchHeroes.${adjustment.type}`)}
            </span>
          )}
        </span>

        {detailed ? (
          <ChevronDown
            size={18}
            aria-hidden
            className={cn("shrink-0 text-chalk-500 transition-transform", open && "rotate-180")}
          />
        ) : (
          <span className="shrink-0 text-xs text-chalk-500">{t("patchHeroes.detailsSoon")}</span>
        )}
      </button>

      {open && detailed && (
        <div className="border-t border-night-800 p-4">
          {adjustment.intro && (
            <p className="mb-4 text-sm leading-relaxed text-chalk-300">{adjustment.intro}</p>
          )}

          <div className="space-y-4">
            {adjustment.sections.map((section, i) => (
              <div key={i}>
                <h4 className="flex flex-wrap items-baseline gap-2 font-heading text-sm font-bold text-gold-400">
                  {section.name}
                  {section.category && (
                    <span className="text-xs font-medium text-chalk-500">{section.category}</span>
                  )}
                </h4>
                <ul className="mt-2 space-y-1">
                  {section.changes.map((c, j) => (
                    <li key={j} className="text-sm">
                      {"after" in c ? (
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {c.label && (
                            <span className="text-chalk-500">{t("patchHeroes.label", { label: c.label })}</span>
                          )}
                          <span className="text-chalk-500 line-through decoration-blood-500/50">
                            {c.before}
                          </span>
                          <ArrowRight size={12} aria-hidden className="text-chalk-500" />
                          <span className="font-medium text-chalk-100">{c.after}</span>
                        </div>
                      ) : (
                        <span className="text-chalk-300">{c.text}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {target && (
            <Link
              href={target.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-500"
            >
              {target.label}
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
