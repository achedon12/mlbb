"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Skill, WikiSkill } from "@/lib/types";
import { Drawer } from "@/components/drawer";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * A hero's skills.
 *
 * Two sources meet here: the wiki provides the **official name** of each
 * skill — which is also the key of its icon — along with its original
 * description, and the written analysis provides a commentary in French when
 * someone has written one. Both lists follow the same order (passive,
 * skill 1, skill 2, ultimate), which is what lets them be paired.
 *
 * The displayed name is the wiki's, never a translation: the game is in
 * English, and a home-made translation would stop the reader from finding
 * the skill in a match.
 *
 * The view is compact: icon, type and name fit on one row of tiles. The
 * detail — description, cooldown, cost — opens when a tile is clicked and
 * closes on the second click: under the tiles on large screens, in a drawer
 * on mobile.
 */
const TYPES = ["Passive", "Skill 1", "Skill 2", "Ultimate"] as const;

interface Sheet {
  name: string;
  type: string;
  icon?: string;
  description: string | null;
  cooldown?: number[];
  cost?: number[];
}

export function HeroSkills({
  wiki,
  icons,
  writtenSkills,
}: {
  wiki: (WikiSkill | null)[];
  icons: Record<string, string>;
  writtenSkills: Skill[] | null;
}) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState<number | null>(null);
  const official = wiki.slice(0, 4);
  const count = Math.max(official.length, writtenSkills?.length ?? 0);

  if (count === 0) {
    return <p className="text-chalk-500">{t("skills.notFetched")}</p>;
  }

  const sheets: Sheet[] = Array.from({ length: count }, (_, i) => {
    const officialSkill = official[i];
    const writtenSkill = writtenSkills?.[i];
    const nameWiki = officialSkill?.name;
    return {
      name: nameWiki ?? writtenSkill?.name ?? t("skills.Skill"),
      type: writtenSkill?.type ?? TYPES[i] ?? "Skill",
      icon: nameWiki ? icons[nameWiki] : undefined,
      // The written analysis wins: it explains, while the official description
      // merely states. Failing that, the game's text beats nothing.
      description: writtenSkill?.description ?? officialSkill?.description ?? null,
      cooldown: writtenSkill?.cooldown,
      cost: writtenSkill?.cost,
    };
  });
  const detail = open === null ? null : sheets[open];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sheets.map((c, i) => {
          const active = open === i;
          return (
            <button
              key={i}
              type="button"
              aria-expanded={active}
              aria-controls={`${id}-detail`}
              onClick={() => setOpen(active ? null : i)}
              className={cn(
                "bevel-sm flex items-center gap-3 border p-2.5 text-left transition-colors",
                active
                  ? "border-gold-500/70 bg-night-850"
                  : "border-night-700/70 bg-night-900/60 hover:border-gold-500/40",
              )}
            >
              <span className="relative size-11 shrink-0 overflow-hidden">
                {c.icon ? (
                  <Image
                    src={c.icon}
                    alt=""
                    fill
                    unoptimized
                    className="object-contain"
                  />
                ) : (
                  <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">
                    —
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-gold-400">
                  {t(`skills.${c.type}`)}
                </span>
                <span className="block truncate text-sm font-semibold text-chalk-100">{c.name}</span>
              </span>
              <ChevronDown
                size={14}
                aria-hidden
                className={cn("shrink-0 text-chalk-500 transition-transform", active && "rotate-180")}
              />
            </button>
          );
        })}
      </div>

      {detail ? (
        <>
          <div id={`${id}-detail`} role="region" aria-live="polite" className="mt-3 hidden lg:block">
            <DetailSkill sheet={detail} />
          </div>
          <Drawer title={detail.name} onClose={() => setOpen(null)}>
            <DetailSkill sheet={detail} withoutFrame />
          </Drawer>
        </>
      ) : (
        <p id={`${id}-detail`} className="mt-3 text-xs text-chalk-500">
          {t("skills.hint")}
        </p>
      )}
    </div>
  );
}

function DetailSkill({ sheet, withoutFrame = false }: { sheet: Sheet; withoutFrame?: boolean }) {
  const t = useT();
  return (
    <div className={cn("p-4", !withoutFrame && "bevel border border-night-700/70 bg-night-900/60")}>
      <div className="flex items-center gap-3 pr-10 lg:pr-0">
        {sheet.icon && (
          <span className="relative size-10 shrink-0 overflow-hidden">
            <Image src={sheet.icon} alt="" fill unoptimized className="object-contain" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-gold-400">
            {t(`skills.${sheet.type}`)}
          </p>
          <h3 className="font-heading text-lg font-bold text-chalk-100">{sheet.name}</h3>
        </div>
      </div>
      <p className={cn("mt-2 leading-relaxed", sheet.description ? "text-chalk-300" : "text-sm text-chalk-500")}>
        {sheet.description ?? t("skills.noDescription")}
      </p>
      {(sheet.cooldown || sheet.cost) && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-night-800 pt-3 text-sm">
          {sheet.cooldown && (
            <div className="flex gap-2">
              <dt className="text-chalk-500">{t("skills.cooldown")}</dt>
              <dd className="text-chalk-100">{sheet.cooldown.join(" / ")} s</dd>
            </div>
          )}
          {sheet.cost && (
            <div className="flex gap-2">
              <dt className="text-chalk-500">{t("skills.cost")}</dt>
              <dd className="text-chalk-100">{sheet.cost.join(" / ")}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
