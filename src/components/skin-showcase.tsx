"use client";

import { createContext, useContext, useState } from "react";
import Image from "next/image";
import { useT } from "@/i18n/provider";
import { rarity, presentRarities } from "@/lib/rarities";
import { CURRENCIES, type SkinFull } from "@/lib/skins";

/**
 * Skin showcase.
 *
 * A single place where a skin is chosen, and everything follows: the large
 * illustration, the info panel, and even the portrait at the top of the hero
 * page. The chosen skin state is therefore shared between the header and the
 * tab, through this context — otherwise two out-of-sync selectors would be
 * needed.
 *
 * The skin type and join live in `@/lib/skins` and `@/lib/hero-skins`, shared
 * with each hero's gallery.
 */
export type { SkinFull };

interface Context {
  active: SkinFull;
  choose: (id: string) => void;
}

const SkinContext = createContext<Context | null>(null);

export function ShowcaseProvider({
  skins,
  portraitDefault,
  children,
}: {
  skins: SkinFull[];
  portraitDefault: string | null;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState(skins[0]?.id ?? "");
  const active = skins.find((s) => s.id === activeId) ?? skins[0];

  // A hero may have no listed skin: the context stays usable, and then only
  // holds the base portrait.
  const value: Context = {
    active: active ?? {
      id: "",
      name: "",
      release: null,
      availability: null,
      rarity: null,
      label: null,
      price: {},
      portrait: portraitDefault,
      illustration: null,
    },
    choose: setActiveId,
  };

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

function useSkin() {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin outside a ShowcaseProvider");
  return ctx;
}

/**
 * Portrait at the top of the hero page.
 *
 * Follows the skin chosen in the showcase. Without a skin or an image, it
 * falls back to the base portrait rather than leaving a hole.
 */
export function ShowcasePortrait({
  name,
  portraitDefault,
}: {
  name: string;
  portraitDefault: string | null;
}) {
  const { active } = useSkin();
  const source = active.portrait ?? portraitDefault;

  return (
    <span className="bevel-sm relative h-40 w-28 shrink-0 overflow-hidden bg-night-800">
      {source ? (
        <Image
          src={source}
          alt={`${name}${active.name ? ` — ${active.name}` : ""}`}
          fill
          priority
          sizes="112px"
          className="object-cover transition-opacity"
        />
      ) : (
        <span className="grid size-full place-items-center font-heading text-3xl font-bold text-chalk-500">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** The tab: large illustration, info, and selection grid. */
export function SkinShowcase({ skins }: { skins: SkinFull[] }) {
  const t = useT();
  const tr = (ns: string, v: string) => {
    const key = `${ns}.${v}`;
    const translated = t(key);
    return translated === key ? v : translated;
  };
  const { active, choose } = useSkin();

  return (
    <div>
      {/* Legend of the rarities present. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {presentRarities(skins.map((s) => s.rarity)).map((r) => (
          <li key={r.name} className="flex items-center gap-1.5 text-xs text-chalk-500">
            <span aria-hidden className="size-2.5 border-2" style={{ borderColor: r.color }} />
            {tr("skinRarity", r.key)}
          </li>
        ))}
      </ul>

      {/*
        Single panel: the chosen skin's illustration fills the background, the
        info sits on top. Choosing a skin changes that background — the whole
        showcase on one surface, with no detached image.
      */}
      <div className="bevel relative mt-5 overflow-hidden border border-night-700/70">
        {active.illustration ? (
          <Image
            key={active.id}
            src={active.illustration}
            alt=""
            fill
            sizes="(min-width: 1024px) 900px, 100vw"
            className="object-cover object-top"
          />
        ) : (
          // Without an illustration on the wiki, the shop portrait takes over,
          // aligned right: the panel keeps an image rather than an empty
          // background.
          active.portrait && (
            <Image
              key={active.id}
              src={active.portrait}
              alt=""
              fill
              sizes="(min-width: 1024px) 900px, 100vw"
              className="object-contain object-right"
            />
          )
        )}
        {/* Side veil: the info stays readable on the left,
            the illustration breathes on the right. */}
        <div className="absolute inset-0 bg-linear-to-r from-night-950 via-night-950/85 to-night-950/20" />
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: rarity(active.rarity).color }}
        />

        <div className="relative flex min-h-72 flex-col justify-end gap-4 p-6 sm:min-h-80 sm:max-w-md">
          <div>
            <h3 className="font-heading text-3xl font-bold leading-none text-chalk-100">
              {active.name}
            </h3>
            {active.rarity && (
              <p
                className="mt-1.5 text-sm font-semibold uppercase tracking-wide"
                style={{ color: rarity(active.rarity).color }}
              >
                {tr("skinRarity", rarity(active.rarity).key)}
              </p>
            )}
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {active.release && <Info label={t("skinsUI.release")} value={active.release} />}
            {active.availability && <Info label={t("skinsUI.availability")} value={tr("skinAvailability", active.availability)} />}
            {active.label && <Info label={t("skinsUI.obtained")} value={tr("skinLabel", active.label)} />}
          </dl>

          {Object.entries(active.price).length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {Object.entries(active.price).map(([m, v]) => (
                <li key={m} className="text-chalk-100">
                  {v} <span className="text-chalk-500">{CURRENCIES[m] ? t(`skinsUI.${CURRENCIES[m]}`) : m}</span>
                </li>
              ))}
            </ul>
          )}

          {!active.release && !active.availability && Object.keys(active.price).length === 0 && (
            <p className="text-sm text-chalk-500">{t("skinsUI.originalSkin")}</p>
          )}
        </div>
      </div>

      {/* ── Selection grid ─────────────────────────────────────────────── */}
      <ul className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {skins.map((s) => {
          const selected = s.id === active.id;
          const r = rarity(s.rarity);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => choose(s.id)}
                aria-pressed={selected}
                title={`${s.name} — ${r.name}`}
                style={{
                  borderColor: r.color,
                  boxShadow: selected ? `0 0 0 2px ${r.halo}, 0 0 12px ${r.halo}` : undefined,
                }}
                className="bevel-sm relative block w-full overflow-hidden border-2 transition-shadow"
              >
                <span className="relative block aspect-[240/390] bg-night-800">
                  {s.portrait ? (
                    <Image
                      src={s.portrait}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 120px, 30vw"
                      className="object-cover"
                    />
                  ) : null}
                  {!selected && (
                    <span aria-hidden className="absolute inset-0 bg-night-950/30" />
                  )}
                </span>
                <span className="block truncate bg-night-900 px-1.5 py-1 text-[0.6rem] leading-tight text-chalk-300">
                  {s.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
      <dd className="mt-0.5 text-chalk-100">{value}</dd>
    </div>
  );
}
