"use client";

import Image from "next/image";
import { HeroPortrait } from "@/components/hero-portrait";
import { useRank } from "@/components/rank-picker";
import { BadgeTier } from "@/components/ui";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import type { MeasuredRank } from "@/lib/measured-ranks";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A hero at a glance, for phones (hidden from `lg`, where the poster and the
 * analysis column already say it): role and lane, tier, win, pick and ban
 * rates, the most played build on one line and the two heroes it struggles
 * most against, each leading to its section. Rates, tier and counters follow
 * the rank picked on the page.
 *
 * The links are plain anchors: the tabs (or, on a phone, the folding
 * sections) listen to the hash and open the right one. A tap is filed as
 * "Glance link" in the "Hero page" category, named after the section.
 */
export interface GlanceStats {
  winRate: string;
  pickRate: string;
  banRate: string;
  tier: Tier;
}

export interface GlanceHero {
  slug: string;
  name: string;
  portrait: string | null;
}

export interface GlanceBuild {
  items: { name: string; image: string | null }[];
  emblem: { name: string; image: string | null } | null;
  winRate: string | null;
}

export function HeroGlance({
  slug,
  roles,
  lanes,
  stats,
  build,
  countersByRank,
  jumps,
}: {
  slug: string;
  roles: string[];
  lanes: string[];
  stats: Partial<Record<MeasuredRank, GlanceStats>>;
  build: GlanceBuild | null;
  /** The two heroes that trouble this one most, rank by rank. */
  countersByRank: Partial<Record<MeasuredRank, GlanceHero[]>>;
  /** Sections the quick links lead to, in page order. */
  jumps: { id: string; label: string }[];
}) {
  const t = useT();
  const rank = useRank();
  const s = stats[rank] ?? stats.all;
  const counters = countersByRank[rank] ?? countersByRank.all ?? [];
  const hasBuild = !!build && build.items.length > 0 && jumps.some((j) => j.id === "builds");
  const hasCounters = counters.length > 0 && jumps.some((j) => j.id === "counters");

  return (
    <section
      aria-labelledby={`glance-${slug}`}
      className="bevel relative mt-6 border border-night-700/70 bg-night-900/70 p-4 lg:hidden"
    >
      <div className="flex items-center gap-3">
        {s && <BadgeTier tier={s.tier} size="sm" />}
        <div className="min-w-0 flex-1">
          <h2 id={`glance-${slug}`} className="text-xs uppercase tracking-wide text-chalk-500">
            {t("pages.heroDetail.glance.title")}
          </h2>
          <p className="truncate font-heading text-lg font-bold uppercase leading-tight text-chalk-100">
            {[...roles, ...lanes].join(" · ")}
          </p>
        </div>
      </div>

      {s && (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {(
            [
              [t("pages.heroDetail.glance.win"), s.winRate, "text-gold-400"],
              [t("pages.heroDetail.glance.pick"), s.pickRate, "text-chalk-100"],
              [t("pages.heroDetail.glance.ban"), s.banRate, "text-blood-400"],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="bevel-sm bg-night-800/80 px-1 py-2">
              <dt className="text-[0.7rem] uppercase tracking-wide text-chalk-500">{label}</dt>
              <dd className={cn("font-heading text-2xl font-bold tabular-nums leading-tight", tone)}>
                {value}
                <span className="text-sm">%</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {hasBuild && (
        <GlanceLink to="builds" className="mt-4 block">
          <span className="flex items-baseline justify-between gap-2 text-xs text-chalk-500">
            <span className="uppercase tracking-wide">{t("pages.heroDetail.glance.build")}</span>
            {build.winRate && (
              <span className="tabular-nums text-gold-400">{t("pages.heroDetail.glance.buildWin", { rate: build.winRate })}</span>
            )}
          </span>
          <span className="mt-1.5 flex items-center gap-1">
            {build.items.slice(0, 6).map((o, i) => (
              <span key={`${o.name}-${i}`} className="bevel-sm aspect-square min-w-0 flex-1 bg-night-800">
                {o.image ? (
                  <Image src={o.image} alt={o.name} width={44} height={44} className="size-full object-contain" />
                ) : (
                  <span className="grid size-full place-items-center text-xs text-chalk-500">{i + 1}</span>
                )}
              </span>
            ))}
            {build.emblem?.image && (
              <span className="bevel-sm ml-1 aspect-square min-w-0 flex-1 bg-night-950">
                <Image src={build.emblem.image} alt={build.emblem.name} width={44} height={44} className="size-full object-contain p-0.5" />
              </span>
            )}
          </span>
        </GlanceLink>
      )}

      {hasCounters && (
        <GlanceLink to="counters" className="mt-4 flex items-center gap-3">
          <span className="shrink-0 text-xs uppercase tracking-wide text-chalk-500">{t("pages.heroDetail.glance.counteredBy")}</span>
          <span className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1.5">
            {counters.slice(0, 2).map((c) => (
              <span key={c.slug} className="flex min-w-0 items-center gap-1.5">
                <HeroPortrait source={c.portrait} name={c.name} size="mini" decorative />
                <span className="truncate font-semibold text-blood-400">{c.name}</span>
              </span>
            ))}
          </span>
        </GlanceLink>
      )}

      {jumps.length > 0 && (
        <nav aria-label={t("pages.heroDetail.glance.jump")} className="mt-4 flex flex-wrap gap-2 border-t border-night-800 pt-3">
          {jumps.map((j) => (
            <GlanceLink
              key={j.id}
              to={j.id}
              className="bevel-sm inline-flex min-h-10 items-center bg-night-800 px-3 font-heading text-sm font-bold uppercase text-gold-400 transition-colors hover:bg-night-700"
            >
              {j.label} →
            </GlanceLink>
          ))}
        </nav>
      )}
    </section>
  );
}

/**
 * An anchor to a section of the page. When the hash already points there (a
 * second tap), the browser fires no `hashchange`: one is sent by hand, so the
 * tabs still scroll back to it.
 */
function GlanceLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        trackEvent("Hero page", "Glance link", to);
        if (window.location.hash === `#${to}`) {
          e.preventDefault();
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      }}
    >
      {children}
    </a>
  );
}
