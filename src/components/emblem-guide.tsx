"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "@/components/link";
import { slugEmblem, type Emblem, type BattleSpell, type Talent } from "@/data/emblems";
import { useT } from "@/i18n/provider";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Emblem guide.
 *
 * Laid out as a reference document rather than a showcase: a role rail always
 * visible on the left, and dense rows on the right. A card grid forced a
 * zigzag scan of the page to compare two talents; aligned, they read in a
 * single vertical sweep.
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
  sorts,
  images,
}: {
  emblems: Emblem[];
  talents: Talent[];
  sorts: BattleSpell[];
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
    <div className="gap-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
      {/* ── Role rail ────────────────────────────────────────────────── */}
      <aside className="mb-10 lg:mb-0">
        <div className="lg:sticky lg:top-24">
          <p className="font-heading text-xs font-semibold uppercase tracking-wider text-chalk-500">
            {t("emblemsUI.yourRole")}
          </p>

          <ul className="mt-3 flex gap-1.5 relative overflow-x-auto lg:flex-col lg:overflow-visible">
            {emblems.map((e) => {
              const chosen = role === e.role;
              return (
                <li key={e.key} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setRole(chosen ? null : e.role)}
                    aria-pressed={chosen}
                    title={textEmb(t, e.key, "bestFor", e.bestFor)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-l-2 px-2.5 py-2 text-left transition-colors",
                      chosen
                        ? "border-gold-500 bg-gold-500/10 text-chalk-100"
                        : "border-transparent text-chalk-500 hover:border-night-600 hover:text-chalk-300",
                    )}
                  >
                    <Visual source={images[e.key]} size={28} />
                    <span className="hidden text-sm font-medium lg:block">{t(`roles.${e.role}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {role && (
            <button
              type="button"
              onClick={() => setRole(null)}
              className="mt-3 px-2.5 text-xs text-chalk-500 underline underline-offset-4 hover:text-gold-400"
            >
              {t("emblemsUI.removeFilter")}
            </button>
          )}

          {/* The chosen emblem has its own page: heroes who play it, talents taken with it. */}
          {chosen && (
            <Link
              href={`/emblems/${slugEmblem(chosen)}`}
              className="mt-2 block px-2.5 text-xs font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-500"
            >
              {t("emblemsUI.seePage", { nom: textEmb(t, chosen.key, "name", chosen.name) })} →
            </Link>
          )}

          <p className="mt-6 hidden max-w-48 text-xs leading-relaxed text-chalk-500 lg:block">
            {t("emblemsUI.roleHelp")}
          </p>
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-12">
        <Section
          title={t("emblemsUI.talents")}
          lead={t("emblemsUI.talentsDesc")}
          entries={order(talents.filter((t) => t.decisive))}
          images={images}
          adapted={adapted}
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
          entries={order(sorts)}
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
}: {
  title: string;
  lead: string;
  entries: Entry[];
  images: Record<string, string>;
  adapted: (roles: Role[]) => boolean;
  /** Page address of each entry, when it has one (spells). */
  link?: (key: string) => string;
}) {
  const t = useT();
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="font-heading text-xl font-bold text-chalk-100">{title}</h2>
        <span className="text-sm text-chalk-500">{entries.length}</span>
      </div>
      <p className="mt-1 text-sm text-chalk-500">{lead}</p>

      {/* Rows rather than cards: two entries compare side by side. */}
      <ul className="mt-4 divide-y divide-night-800 border-y border-night-800">
        {entries.map((e) => {
          const kept = adapted(e.roles);
          return (
            <li
              key={e.key}
              className={cn(
                "flex gap-4 py-3 transition-opacity",
                kept ? "" : "opacity-40",
              )}
            >
              <Visual source={images[e.key]} size={40} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="font-heading font-bold leading-tight text-chalk-100">
                    {link ? (
                      <Link href={link(e.key)} className="underline-offset-4 hover:text-gold-400 hover:underline">
                        {textEmb(t, e.key, "name", e.name)}
                      </Link>
                    ) : (
                      textEmb(t, e.key, "name", e.name)
                    )}
                  </h3>
                  {e.cooldown !== undefined && (
                    <span className="text-xs tabular-nums text-gold-400">
                      {e.cooldown} s
                    </span>
                  )}
                </div>
                {e.description && (
                  <p className="mt-0.5 text-sm leading-snug text-chalk-300">
                    {textEmb(t, e.key, "description", e.description)}
                  </p>
                )}
                <p className="mt-1 text-xs leading-relaxed text-chalk-500">{textEmb(t, e.key, "bestFor", e.bestFor)}</p>
              </div>

              <ul className="hidden shrink-0 flex-wrap content-start gap-1 sm:flex sm:w-40">
                {e.roles.map((r) => (
                  <li
                    key={r}
                    className="border border-night-700 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-chalk-500"
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

function Visual({ source, size }: { source?: string; size: number }) {
  return (
    <span
      className="relative shrink-0"
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
