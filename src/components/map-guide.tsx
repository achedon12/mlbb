"use client";

import { useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bug, Castle, Coins, Crown, Flame, HeartPulse, Mountain, Sparkles, Sprout, TowerControl, Turtle, Wind } from "lucide-react";
import Image from "next/image";
import Link from "@/components/link";
import { GlyphPanel } from "@/components/glyph-panel";
import { MapDrawing } from "@/components/map-drawing";
import motion from "@/components/catalogue-motion.module.css";
import { useT } from "@/i18n/provider";
import { MAP_GROUPS, MAP_POINTS, type MapPointKey, type MapSide } from "@/lib/game-map";
import { cn } from "@/lib/utils";

/**
 * Interactive map guide: our own schematic SVG of the Land of Dawn, with one
 * button per point of interest on top of it and the same points as a list.
 * The card texts are built by the server page (sourced values, translated);
 * this component only handles selection and keyboard moves.
 *
 * The markers form a single tab stop: arrow keys move between them (roving
 * tabindex), and the card follows the focus, so a keyboard user browses the
 * map the way a finger does.
 */
export interface MapCard {
  name: string;
  role: string;
  facts: { label: string; value: string }[];
  source: string;
  sourceName: string;
  image: string | null;
  links: { href: string; label: string }[];
}

const ICONS: Partial<Record<MapPointKey, LucideIcon>> = {
  turtle: Turtle,
  lord: Crown,
  "purple-buff": Sparkles,
  "orange-buff": Flame,
  lithowanderer: Sprout,
  crab: Coins,
  lizard: HeartPulse,
  beetle: Bug,
  golem: Mountain,
  cyclone: Wind,
  turret: TowerControl,
  base: Castle,
};

/**
 * The monsters' own portraits, shown on their markers and on their card:
 * the pit is recognised by its monster, as in the game.
 */
const PORTRAITS: Partial<Record<MapPointKey, string>> = {
  turtle: "/visuels/monstres/turtle.webp",
  lord: "/visuels/monstres/lord.webp",
  "purple-buff": "/visuels/monstres/purple-buff.webp",
  "orange-buff": "/visuels/monstres/orange-buff.webp",
};

/** Icon colour of a marker, from the palette: gold for what is fought over, chalk for the rest. */
const TINTS: Partial<Record<MapPointKey, string>> = {
  crab: "var(--color-gold-400)",
  lithowanderer: "var(--color-gold-300)",
  cyclone: "var(--color-azure-300)",
};

/** A side's colour: ally blue for yours, enemy red for theirs, gold for what both fight over. */
const SIDE_RING: Record<"ours" | "theirs" | "shared", string> = {
  ours: "shadow-[inset_0_0_0_2px_var(--color-azure-400)]",
  theirs: "shadow-[inset_0_0_0_2px_var(--color-blood-400)]",
  shared: "shadow-[inset_0_0_0_2px_var(--color-gold-500)]",
};
const SIDE_FILL: Record<"ours" | "theirs" | "shared", string> = {
  ours: "bg-azure-400",
  theirs: "bg-blood-400",
  shared: "bg-gold-400",
};

const MARKERS = MAP_POINTS.flatMap((p) =>
  p.positions.map((pos, i) => ({ ...pos, key: p.key, lane: p.group === "lane", small: p.key === "turret", id: `${p.key}-${i}` })),
);
const firstMarker = (key: MapPointKey) => Math.max(0, MARKERS.findIndex((m) => m.key === key));
/** A time of the game clock ("2:00", "10:00"): drawn as the card's big figure. */
const CLOCK = /^\d{1,2}:\d{2}$/;

export function MapGuide({ cards }: { cards: Record<MapPointKey, MapCard> }) {
  const t = useT();
  const helpId = useId();
  const cardTitleId = useId();
  const [selected, setSelected] = useState<MapPointKey>("turtle");
  const [active, setActive] = useState(0);
  const markerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const card = cards[selected];
  const Icon = ICONS[selected];
  const portrait = PORTRAITS[selected] ?? card.image;
  const clock = card.facts.find((f) => CLOCK.test(f.value));
  const facts = card.facts.filter((f) => f !== clock);

  const choose = (key: MapPointKey) => {
    setSelected(key);
    setActive(firstMarker(key));
  };

  const move = (evt: React.KeyboardEvent, index: number) => {
    const n = MARKERS.length;
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % n,
      ArrowDown: (index + 1) % n,
      ArrowLeft: (index - 1 + n) % n,
      ArrowUp: (index - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    const target = keys[evt.key];
    if (target === undefined) return;
    evt.preventDefault();
    setActive(target);
    setSelected(MARKERS[target].key);
    markerRefs.current[target]?.focus();
  };

  const sideLabel = (side: MapSide) => (side ? ` (${t(`pages.mapUI.side.${side}`)})` : "");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] xl:gap-10">
      <div className={motion.rise}>
        {/* The map, as large as the column allows: the showpiece of the page. */}
        <div className="bevel-lg relative mx-auto aspect-square w-full max-w-[46rem] overflow-hidden bg-night-950 shadow-[inset_0_0_0_1px_var(--color-night-700)]">
          <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full">
            <MapDrawing />
          </svg>
          {/* The game's light: night at the corners, the river lit through the middle. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_38%,rgb(61_139_255/0.07)_50%,transparent_62%)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gold-400" />

          <div role="group" aria-label={t("pages.mapUI.mapLabel")} aria-describedby={helpId} className="absolute inset-0">
            {MARKERS.map((m, i) => {
              const isSelected = m.key === selected;
              const MarkerIcon = ICONS[m.key];
              const face = PORTRAITS[m.key];
              const side = m.side ?? "shared";
              return (
                <button
                  key={m.id}
                  ref={(el) => {
                    markerRefs.current[i] = el;
                  }}
                  type="button"
                  tabIndex={i === active ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={`${cards[m.key].name}${sideLabel(m.side)}`}
                  onClick={() => {
                    setActive(i);
                    setSelected(m.key);
                  }}
                  onFocus={() => {
                    setActive(i);
                    setSelected(m.key);
                  }}
                  onKeyDown={(evt) => move(evt, i)}
                  style={{ left: `${m.x}%`, top: `${m.y}%`, color: isSelected ? undefined : (TINTS[m.key] ?? "var(--color-chalk-200)") }}
                  className={cn(
                    "absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-100 motion-safe:transition-[transform,background-color] motion-safe:duration-200 hover:z-20 hover:scale-110",
                    m.lane
                      ? "bevel-sm h-6 min-w-10 px-1.5 font-heading text-[0.7rem] font-bold uppercase sm:h-7 sm:text-xs"
                      : face
                        ? "bevel-sm size-9 sm:size-12"
                        : m.small
                          ? "bevel-sm size-5 sm:size-6"
                          : "bevel-sm size-7 sm:size-9",
                    isSelected
                      ? cn("z-10 scale-125 text-night-950 hover:scale-125", SIDE_FILL[side])
                      : cn("bg-night-900/95", SIDE_RING[side]),
                  )}
                >
                  {m.lane ? (
                    <span aria-hidden>{t(`pages.mapUI.short.${m.key}`)}</span>
                  ) : face ? (
                    <Image src={face} alt="" width={48} height={48} className={cn("object-cover", isSelected ? "size-[calc(100%-6px)]" : "size-[calc(100%-4px)]")} />
                  ) : (
                    MarkerIcon && <MarkerIcon aria-hidden className={m.small ? "size-3 sm:size-3.5" : "size-4 sm:size-5"} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p id={helpId} className="mx-auto mt-3 max-w-[46rem] text-xs text-chalk-500">
          {t("pages.mapUI.keyboardHelp")}
        </p>
        <ul className="mx-auto mt-2 flex max-w-[46rem] flex-wrap gap-x-5 gap-y-1 text-xs text-chalk-400">
          {(["ours", "theirs", "shared"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("bevel-sm size-3.5 bg-night-900", SIDE_RING[s])} />
              {t(`pages.mapUI.legend.${s}`)}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-4 bg-azure-400/40" />
            {t("pages.mapUI.legend.river")}
          </li>
        </ul>
      </div>

      <div className="space-y-6">
        <section aria-labelledby={cardTitleId} aria-live="polite" className="bevel-lg relative bg-night-900 p-5 sm:p-6">
          <div key={selected} className="flex items-center gap-4">
            {portrait ? (
              <GlyphPanel image={portrait} size={96} cover flash className="size-24 sm:size-28" />
            ) : (
              <span
                aria-hidden
                className={cn("bevel-lg grid size-24 shrink-0 place-items-center bg-night-800 text-chalk-100 shadow-[inset_0_3px_0_var(--color-gold-400)] sm:size-28", motion.flash)}
              >
                {Icon ? (
                  <Icon className={cn("size-11", motion.glyphImage)} />
                ) : (
                  <span className={cn("display-caps text-3xl text-gold-400", motion.glyphImage)}>{t(`pages.mapUI.short.${selected}`)}</span>
                )}
              </span>
            )}
            <div className="min-w-0">
              <h3 id={cardTitleId} className="display-caps break-words text-[2.2rem] text-chalk-100 sm:text-[2.6rem]">
                {card.name}
              </h3>
              {clock && (
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="score text-[2.6rem]">{clock.value}</span>
                  <span className="text-xs text-chalk-400">{clock.label}</span>
                </p>
              )}
            </div>
          </div>
          <div aria-hidden className="eclat mt-5 h-[3px] w-20" />
          <p className="mt-4 text-sm leading-relaxed text-chalk-200">{card.role}</p>
          {facts.length > 0 && (
            <dl className="mt-4 space-y-2.5 text-sm">
              {facts.map((f) => (
                <div key={f.label} className="bevel-sm bg-night-850 px-3 py-2">
                  <dt className="font-heading text-sm font-bold text-gold-400">{f.label}</dt>
                  <dd className="mt-0.5 leading-snug text-chalk-100">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {card.links.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {card.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300">
                    {l.label} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-chalk-500">
            {t("pages.mapUI.source")}{" "}
            <a href={card.source} rel="noopener" className="underline transition-colors hover:text-gold-400">
              {card.sourceName}
            </a>
          </p>
        </section>

        <div role="group" aria-label={t("pages.mapUI.listTitle")} className="space-y-4">
          {MAP_GROUPS.map((g) => (
            <div key={g}>
              <h3 className="font-heading text-base font-bold text-chalk-300">{t(`pages.mapUI.group.${g}`)}</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {MAP_POINTS.filter((p) => p.group === g).map((p) => {
                  const on = p.key === selected;
                  const PointIcon = ICONS[p.key];
                  const face = PORTRAITS[p.key];
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => choose(p.key)}
                        className={cn(
                          "bevel-sm inline-flex min-h-11 items-center gap-2 py-1 pl-1.5 pr-3 text-sm font-semibold transition-colors",
                          on ? "bg-gold-400 text-night-950" : "bg-night-900 text-chalk-200 hover:bg-night-800 hover:text-chalk-100",
                        )}
                      >
                        {face ? (
                          <Image src={face} alt="" width={32} height={32} className="bevel-sm size-8 object-cover" />
                        ) : PointIcon ? (
                          <span aria-hidden className="grid size-8 place-items-center">
                            <PointIcon className="size-4" />
                          </span>
                        ) : (
                          <span aria-hidden className="w-1" />
                        )}
                        {cards[p.key].name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
