"use client";

import { createContext, useContext, useState } from "react";
import Image from "next/image";
import { useT } from "@/i18n/provider";
import { rarity, presentRarities } from "@/lib/rarities";
import { CURRENCIES, type SkinFull } from "@/lib/skins";

/**
 * Vitrine des skins.
 *
 * Un seul endroit ou l'on choisit un skin, et tout suit : la grande
 * illustration, le panneau d'informations, et jusqu'au portrait en tete de
 * fiche. L'etat du skin choisi est donc partage entre l'en-tete et l'onglet,
 * via ce contexte — sans quoi il faudrait deux selecteurs desynchronises.
 *
 * Le type et la jointure des skins vivent dans `@/lib/skins` et
 * `@/lib/skins-heros`, partages avec la galerie de chaque heros.
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

  // Un heros peut n'avoir aucun skin recense : le contexte reste utilisable,
  // il porte alors le seul portrait de base.
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
  if (!ctx) throw new Error("useSkin hors d'un VitrineProvider");
  return ctx;
}

/**
 * Portrait de tete de fiche.
 *
 * Suit le skin choisi dans la vitrine. Sans skin ou sans image, il retombe sur
 * le portrait de base plutot que de laisser un trou.
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

/** L'onglet : grande illustration, informations, et grille de selection. */
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
      {/* Legende des raretes presentes. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {presentRarities(skins.map((s) => s.rarity)).map((r) => (
          <li key={r.name} className="flex items-center gap-1.5 text-xs text-chalk-500">
            <span aria-hidden className="size-2.5 border-2" style={{ borderColor: r.color }} />
            {tr("skinRarity", r.key)}
          </li>
        ))}
      </ul>

      {/*
        Panneau unique : l'illustration du skin choisi occupe le fond, les
        informations se posent dessus. Choisir un skin change ce fond — c'est
        toute la vitrine en une seule surface, sans image detachee.
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
          // Sans illustration sur le wiki, le portrait de boutique prend le
          // relais, cale a droite : le panneau garde une image plutot qu'un
          // fond vide.
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
        {/* Voile lateral : les informations restent lisibles a gauche,
            l'illustration respire a droite. */}
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

      {/* ── Grille de selection ────────────────────────────────────────── */}
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
