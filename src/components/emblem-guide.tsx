"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "@/components/link";
import { slugEmblem, type Emblem, type BattleSpell, type Talent } from "@/data/emblems";
import { useT } from "@/i18n/provider";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DexSays } from "@/components/mascot";
import motion from "@/components/catalogue-motion.module.css";

/**
 * Emblem guide.
 *
 * The six emblems open the page, large: choosing one is choosing a role.
 * Below, the talents, attributes and spells as aligned rows, each with its
 * icon on a night tile. A card grid forced a zigzag scan of the page to
 * compare two talents; aligned, they read in a single sweep.
 *
 * The chosen role does not filter, it orders: what you don't pick stays
 * visible, dimmed. Hiding it would deprive the reader of the comparison that
 * justifies their choice.
 */
function textEmb(t: (k: string) => string, key: string, field: string, fallback: string | undefined) {
  const k = `emblemData.${key}.${field}`;
  const v = t(k);
  return v === k ? (fallback ?? "") : v;
}

export function EmblemGuide({
  emblems,
  talents,
  spells,
  images,
}: {
  emblems: Emblem[];
  talents: Talent[];
  spells: BattleSpell[];
  images: Record<string, string>;
}) {
  const t = useT();
  const [role, setRole] = useState<Role | null>(null);

  const order = <T extends { roles: Role[] }>(list: T[]) =>
    role
      ? [...list].sort(
          (a, b) => Number(b.roles.includes(role)) - Number(a.roles.includes(role)),
        )
      : list;

  const adapted = (roles: Role[]) => !role || roles.includes(role);
  const chosen = role ? emblems.find((e) => e.role === role) : undefined;

  return (
    <div>
      {/* ── The emblems, large: picking one is picking a role ─────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <h2 className="type-subtitle text-chalk-100">{t("emblemsUI.yourRole")}</h2>
          <ul className={cn("mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3", motion.rise)}>
            {emblems.map((e) => {
              const on = role === e.role;
              return (
                <li key={e.key}>
                  <button
                    type="button"
                    onClick={() => setRole(on ? null : e.role)}
                    aria-pressed={on}
                    title={textEmb(t, e.key, "bestFor", e.bestFor)}
                    className={cn(
                      "eclat-under bevel group flex w-full flex-col items-center gap-2 px-2 pb-3.5 pt-4 text-center",
                      motion.lift,
                      on
                        ? "is-active bg-night-800 shadow-[inset_0_3px_0_var(--color-gold-400)]"
                        : "bg-night-900 hover:bg-night-850",
                    )}
                  >
                    <span key={on ? "on" : "off"} className={cn("relative grid place-items-center", motion.zoom, on && motion.flash)}>
                      <Visual source={images[e.key]} size={72} className={motion.glyphImage} />
                    </span>
                    <span
                      className={cn(
                        "display-caps text-xl transition-colors sm:text-2xl",
                        on ? "text-gold-400" : role ? "text-chalk-500 group-hover:text-chalk-100" : "text-chalk-100 group-hover:text-gold-300",
                      )}
                    >
                      {t(`roles.${e.role}`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {/* The chosen emblem has its own page: heroes who play it, talents taken with it. */}
            {chosen && (
              <Link
                href={`/emblems/${slugEmblem(chosen)}`}
                className="font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
              >
                {t("emblemsUI.seePage", { name: textEmb(t, chosen.key, "name", chosen.name) })} →
              </Link>
            )}
            {role && (
              <button
                type="button"
                onClick={() => setRole(null)}
                className="text-chalk-400 underline underline-offset-4 transition-colors hover:text-gold-400"
              >
                {t("emblemsUI.removeFilter")}
              </button>
            )}
          </div>
        </div>
        <DexSays pose="idee" height={118} className="hidden lg:flex lg:max-w-sm">
          <p className="text-sm leading-relaxed">{t("emblemsUI.roleHelp")}</p>
        </DexSays>
      </div>

      <div aria-hidden className="eclat-rule my-10 sm:my-14" />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-12 sm:space-y-16">
        <Section
          title={t("emblemsUI.talents")}
          lead={t("emblemsUI.talentsDesc")}
          entries={order(talents.filter((t) => t.decisive))}
          images={images}
          adapted={adapted}
          large
        />
        <Section
          title={t("emblemsUI.attributes")}
          lead={t("emblemsUI.attributesDesc")}
          entries={order(talents.filter((t) => !t.decisive))}
          images={images}
          adapted={adapted}
        />
        <Section
          title={t("emblemsUI.spells")}
          lead={t("emblemsUI.spellsDesc")}
          entries={order(spells)}
          images={images}
          adapted={adapted}
          link={(key) => `/spells/${key}`}
        />
      </div>
    </div>
  );
}

interface Entry {
  key: string;
  name: string;
  roles: Role[];
  description?: string;
  cooldown?: number;
  bestFor: string;
}

function Section({
  title,
  lead,
  entries,
  images,
  adapted,
  link,
  large = false,
}: {
  title: string;
  lead: string;
  entries: Entry[];
  images: Record<string, string>;
  adapted: (roles: Role[]) => boolean;
  /** Page address of each entry, when it has one (spells). */
  link?: (key: string) => string;
  /** The decisive talents: the bigger icons. */
  large?: boolean;
}) {
  const t = useT();
  return (
    <section>
      <div className="flex items-end gap-4">
        <h2 className="type-section text-chalk-100">{title}</h2>
        <span className="score score-outline pb-0.5 text-[2.25rem]">{entries.length}</span>
      </div>
      <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
      <p className="mt-3 max-w-2xl text-chalk-400">{lead}</p>

      {/* Rows rather than cards: two entries compare side by side. */}
      <ul className="mt-5 grid gap-2 xl:grid-cols-2">
        {entries.map((e) => {
          const kept = adapted(e.roles);
          return (
            <li
              key={e.key}
              className={cn(
                "bevel flex gap-3 bg-night-900 p-3 transition-opacity sm:gap-4 sm:p-4",
                kept ? "" : "opacity-40",
              )}
            >
              <span className={cn("bevel-sm grid shrink-0 place-items-center bg-night-800", large ? "size-16 sm:size-20" : "size-14 sm:size-16")}>
                <Visual source={images[e.key]} size={large ? 60 : 48} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="font-heading text-lg font-bold leading-tight text-chalk-100">
                    {link ? (
                      <Link href={link(e.key)} className="underline-offset-4 transition-colors hover:text-gold-400 hover:underline">
                        {textEmb(t, e.key, "name", e.name)}
                      </Link>
                    ) : (
                      textEmb(t, e.key, "name", e.name)
                    )}
                  </h3>
                  {e.cooldown !== undefined && (
                    <span className="score text-lg">
                      {e.cooldown} s
                    </span>
                  )}
                </div>
                {e.description && (
                  <p className="mt-1 text-sm leading-snug text-chalk-300">
                    {textEmb(t, e.key, "description", e.description)}
                  </p>
                )}
                <p className="mt-1 text-xs leading-snug text-chalk-500">{textEmb(t, e.key, "bestFor", e.bestFor)}</p>
              </div>

              <ul className="hidden shrink-0 flex-col content-start items-end gap-1 sm:flex">
                {e.roles.map((r) => (
                  <li
                    key={r}
                    className="bevel-sm bg-night-800 px-2 py-0.5 font-heading text-xs font-bold text-chalk-400"
                  >
                    {t(`roles.${r}`)}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Visual({ source, size, className }: { source?: string; size: number; className?: string }) {
  return (
    <span
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {source ? (
        <Image
          src={source}
          alt=""
          fill
          sizes={`${size}px`}
          loading="eager"
          className="object-contain"
        />
      ) : (
        <span className="grid size-full place-items-center bg-night-800 text-xs text-chalk-500">
          —
        </span>
      )}
    </span>
  );
}
