"use client";

import Image from "next/image";
import Link from "@/components/link";
import { useState } from "react";
import { BuildPicker } from "@/components/build-picker";
import { FilterGroup, Chip } from "@/components/chip";
import { useRank } from "@/components/rank-picker";
import type { MeasuredRank } from "@/lib/measured-ranks";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export interface ResolvedVisual {
  name: string;
  image: string | null;
  /** Page of the choice (emblem, spell), when it exists. */
  href?: string;
}

export interface ResolvedItem extends ResolvedVisual {
  slug: string | null;
}

/** Build resolved by the server: the browser has neither catalogue nor visuals. */
export interface ResolvedBuild {
  items: ResolvedItem[];
  emblem: ResolvedVisual | null;
  talents: ResolvedVisual[];
  spell: ResolvedVisual | null;
  /** Build win rate, in %. */
  win: number | null;
  /** Share of matches it appears in, in %. */
  selection: number | null;
}

/** Resolved player guide: full equipment, no measured rate. */
export interface ResolvedGuide {
  items: ResolvedItem[];
  emblem: ResolvedVisual | null;
  talents: ResolvedVisual[];
  spell: ResolvedVisual | null;
  /** Author's highest rank reached, as a rank emblem key. */
  author: { key: string; division: string } | null;
  votes: number;
}

/**
 * Builds actually played, rank by rank.
 *
 * They follow the rank chosen on the hero page: a Mythic does not gear up like
 * an Epic. A hero played in two lanes has one build per lane; the
 * lane choice only shows up in that case.
 *
 * Measured builds only carry the core items. The full equipment comes
 * separately, from a player guide: two distinct sources, never mixed
 * under the same win rate.
 */
export function BuildsByRank({
  byLane,
  guides,
}: {
  byLane: Record<string, Partial<Record<MeasuredRank, ResolvedBuild[]>>>;
  guides: Record<string, Partial<Record<MeasuredRank, ResolvedGuide>>>;
}) {
  const t = useT();
  const rank = useRank();
  const lanes = [...new Set([...Object.keys(byLane), ...Object.keys(guides)])];
  const [lane, setLane] = useState(lanes[0]);
  const byRank = byLane[lane] ?? {};
  // The page's rank may be missing for this lane: fall back to all ranks.
  const builds = byRank[rank] ?? byRank.all ?? [];
  const guide = guides[lane]?.[rank] ?? guides[lane]?.all ?? null;

  const nameEmblem = (name: string) => {
    const role = t(`roles.${name}`);
    return role === `roles.${name}` ? name : role;
  };

  return (
    <div>
      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("builds.played")}</h3>
      <p className="mt-1 text-sm leading-relaxed text-chalk-500">{t("builds.playedIntro")}</p>

      {lanes.length > 1 && (
        <FilterGroup legend={t("builds.position")} widthLegend="" className="mt-4">
          {lanes.map((l) => (
            <Chip key={l} active={l === lane} onClick={() => setLane(l)}>
              {t(`lanes.${l}`)}
            </Chip>
          ))}
        </FilterGroup>
      )}

      <ol className="mt-5 grid gap-4 lg:grid-cols-3">
        {builds.map((b, i) => (
          <li key={i} className="bevel border border-night-700/70 bg-night-900/60 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-heading font-bold text-gold-400">{t("builds.build", { n: i + 1 })}</span>
              {b.win !== null && (
                <span className="text-xs font-semibold tabular-nums text-emerald-400">
                  {t("builds.win", { rate: b.win.toFixed(1) })}
                </span>
              )}
            </div>
            {b.selection !== null && (
              <p className="mt-0.5 text-xs tabular-nums text-chalk-500">
                {t("builds.pick", { rate: b.selection.toFixed(1) })}
              </p>
            )}

            <p className="mt-4 text-[0.65rem] uppercase tracking-wide text-chalk-500">{t("builds.items")}</p>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {b.items.map((o) => (
                <li key={o.name}>
                  <ItemKey item={o} />
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-3 border-t border-night-800 pt-4">
              {b.emblem && (
                <BuildPicker
                  label={t("builds.emblem")}
                  name={nameEmblem(b.emblem.name)}
                  image={b.emblem.image}
                  href={b.emblem.href}
                />
              )}
              {b.talents.map((talent, j) => (
                <BuildPicker
                  key={talent.name}
                  label={j === 0 ? t("builds.talents") : undefined}
                  name={talent.name}
                  image={talent.image}
                />
              ))}
              {b.spell && <BuildPicker label={t("builds.spell")} name={b.spell.name} image={b.spell.image} href={b.spell.href} />}
            </div>
          </li>
        ))}
      </ol>

      {guide && (
        <section className="mt-8">
          <h4 className="font-heading font-bold text-chalk-100">{t("builds.guide")}</h4>
          <p className="mt-1 text-sm leading-relaxed text-chalk-500">{t("builds.guideIntro")}</p>
          <div className="bevel mt-4 border border-night-700/70 bg-night-900/60 p-4">
            <p className="text-xs text-chalk-500">
              {guide.author &&
                t("builds.guideAuthor", {
                  rank: `${t(`rankNames.${guide.author.key}`)}${guide.author.division ? ` ${guide.author.division}` : ""}`,
                })}
              {guide.author && " · "}
              {t("builds.guideVotes", { n: guide.votes })}
            </p>
            <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {guide.items.map((o, i) => (
                <li key={`${o.name}-${i}`}>
                  <ItemKey item={o} />
                </li>
              ))}
            </ol>
            <div className="mt-4 grid gap-3 border-t border-night-800 pt-4 sm:grid-cols-3 lg:grid-cols-5">
              {guide.emblem && (
                <BuildPicker
                  label={t("builds.emblem")}
                  name={nameEmblem(guide.emblem.name)}
                  image={guide.emblem.image}
                  href={guide.emblem.href}
                />
              )}
              {guide.talents.map((talent, j) => (
                <BuildPicker
                  key={talent.name}
                  label={j === 0 ? t("builds.talents") : undefined}
                  name={talent.name}
                  image={talent.image}
                />
              ))}
              {guide.spell && (
                <BuildPicker label={t("builds.spell")} name={guide.spell.name} image={guide.spell.image} href={guide.spell.href} />
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ItemKey({ item }: { item: ResolvedItem }) {
  const content = (
    <>
      <span className="relative mx-auto block size-11">
        {item.image ? (
          <Image src={item.image} alt="" width={44} height={44} className="size-full object-contain" />
        ) : (
          <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">
            {item.name.charAt(0)}
          </span>
        )}
      </span>
      <span className="mt-1.5 block text-[0.7rem] leading-tight text-chalk-300">{item.name}</span>
    </>
  );
  const cssClass = "bevel-sm block border border-night-700 bg-night-850 p-2 text-center";
  return item.slug ? (
    <Link href={`/items/${item.slug}`} className={cn(cssClass, "transition-colors hover:border-gold-500/60")}>
      {content}
    </Link>
  ) : (
    <span className={cssClass}>{content}</span>
  );
}
