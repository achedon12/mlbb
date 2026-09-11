"use client";

import { useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bug, Castle, Coins, Crown, Flame, HeartPulse, Mountain, Sparkles, Sprout, TowerControl, Turtle, Wind } from "lucide-react";
import Link from "@/components/lien";
import { useT } from "@/i18n/fournisseur";
import { LANE_PATHS, MAP_GROUPS, MAP_POINTS, TERRAIN_BLOCKS, type MapPointKey, type MapSide } from "@/lib/game-map";
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

/** Marker tint, picked from each monster's portrait; lanes and buildings stay neutral. */
const TINTS: Record<MapPointKey, string> = {
  turtle: "#2dd4bf",
  lord: "#c084fc",
  "purple-buff": "#a78bfa",
  "orange-buff": "#fb923c",
  lithowanderer: "#86efac",
  crab: "#f5c451",
  lizard: "#dbe2f0",
  beetle: "#dbe2f0",
  golem: "#dbe2f0",
  cyclone: "#4da3ff",
  turret: "#eef2fb",
  base: "#eef2fb",
  "exp-lane": "#eef2fb",
  "mid-lane": "#eef2fb",
  "gold-lane": "#eef2fb",
};

const SIDE_BORDER: Record<"ours" | "theirs" | "shared", string> = {
  ours: "border-azure-500",
  theirs: "border-blood-500",
  shared: "border-gold-500",
};

const MARKERS = MAP_POINTS.flatMap((p) =>
  p.positions.map((pos, i) => ({ ...pos, key: p.key, lane: p.group === "lane", small: p.key === "turret", id: `${p.key}-${i}` })),
);
const firstMarker = (key: MapPointKey) => Math.max(0, MARKERS.findIndex((m) => m.key === key));
const PITS = MAP_POINTS.filter((p) => p.group === "objective").flatMap((p) => p.positions);

export function MapGuide({ cards }: { cards: Record<MapPointKey, MapCard> }) {
  const t = useT();
  const helpId = useId();
  const cardTitleId = useId();
  const [selected, setSelected] = useState<MapPointKey>("turtle");
  const [active, setActive] = useState(0);
  const markerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const card = cards[selected];
  const Icon = ICONS[selected];

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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <div className="relative mx-auto aspect-square w-full max-w-[36rem] overflow-hidden rounded-lg border border-night-700 bg-night-950">
          <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full">
            <rect width="100" height="100" fill="#0e1424" />
            {TERRAIN_BLOCKS.map(([x, y, w, h]) => (
              <g key={`${x}-${y}`} fill="#1c2742">
                <rect x={x} y={y} width={w} height={h} rx="1.5" />
                <rect x={y} y={x} width={h} height={w} rx="1.5" />
              </g>
            ))}
            <path d="M0 100 V72 A28 28 0 0 1 28 100 Z" fill="#2b7fe0" fillOpacity="0.2" />
            <path d="M100 0 H72 A28 28 0 0 0 100 28 Z" fill="#d94848" fillOpacity="0.2" />
            <polygon points="5,-5 105,95 95,105 -5,5" fill="#4da3ff" fillOpacity="0.16" />
            <line x1="0" y1="0" x2="100" y2="100" stroke="#4da3ff" strokeOpacity="0.35" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
            {PITS.map((p) => (
              <circle
                key={`${p.x}-${p.y}`}
                cx={p.x}
                cy={p.y}
                r="7"
                fill="#06080f"
                fillOpacity="0.7"
                stroke="#e0a92e"
                strokeOpacity="0.6"
                strokeWidth="0.5"
                strokeDasharray="1.2 1"
              />
            ))}
            {Object.values(LANE_PATHS).map((d) => (
              <g key={d} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} stroke="#2a3758" strokeWidth="5" />
                <path d={d} stroke="#99a4c0" strokeOpacity="0.5" strokeWidth="0.4" strokeDasharray="2 2" />
              </g>
            ))}
          </svg>

          <div role="group" aria-label={t("pages.mapUI.mapLabel")} aria-describedby={helpId} className="absolute inset-0">
            {MARKERS.map((m, i) => {
              const isSelected = m.key === selected;
              const MarkerIcon = ICONS[m.key];
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
                  style={{ left: `${m.x}%`, top: `${m.y}%`, color: TINTS[m.key] }}
                  className={cn(
                    "absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center border-2 bg-night-950/90 shadow-md shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chalk-100 motion-safe:transition-transform",
                    m.lane
                      ? "h-6 min-w-9 rounded-full px-1.5 text-[0.625rem] font-bold uppercase tracking-wide"
                      : m.small
                        ? "size-5 rounded-full sm:size-6"
                        : "size-7 rounded-full sm:size-8",
                    SIDE_BORDER[m.side ?? "shared"],
                    isSelected && "z-10 scale-125 border-gold-400 bg-night-800",
                  )}
                >
                  {m.lane ? (
                    <span aria-hidden>{t(`pages.mapUI.short.${m.key}`)}</span>
                  ) : (
                    MarkerIcon && <MarkerIcon aria-hidden className={m.small ? "size-3 sm:size-3.5" : "size-4 sm:size-[1.125rem]"} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p id={helpId} className="mx-auto mt-2 max-w-[36rem] text-xs text-chalk-500">
          {t("pages.mapUI.keyboardHelp")}
        </p>
        <ul className="mx-auto mt-2 flex max-w-[36rem] flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-400">
          {(["ours", "theirs", "shared"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-3 rounded-full border-2 bg-night-950", SIDE_BORDER[s])} />
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
        <section aria-labelledby={cardTitleId} aria-live="polite" className="relative">
          <div aria-hidden className="bevel absolute inset-0 border border-night-700/70 bg-night-900/70" />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center gap-3">
              {card.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- local portrait, already small
                <img src={card.image} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full border border-night-600 object-cover" />
              ) : (
                <span
                  aria-hidden
                  className="grid size-12 shrink-0 place-items-center rounded-full border border-night-600 bg-night-950"
                  style={{ color: TINTS[selected] }}
                >
                  {Icon ? <Icon className="size-6" /> : <span className="text-xs font-bold">{t(`pages.mapUI.short.${selected}`)}</span>}
                </span>
              )}
              <h3 id={cardTitleId} className="font-heading text-xl font-bold text-chalk-100">
                {card.name}
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-chalk-300">{card.role}</p>
            {card.facts.length > 0 && (
              <dl className="mt-4 space-y-2 text-sm">
                {card.facts.map((f) => (
                  <div key={f.label} className="grid gap-0.5 sm:grid-cols-[8.5rem_1fr] sm:gap-3 lg:grid-cols-1 lg:gap-0.5">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-chalk-500">{f.label}</dt>
                    <dd className="leading-snug text-chalk-100">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {card.links.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {card.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="font-semibold text-gold-400 transition-colors hover:text-gold-500">
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
          </div>
        </section>

        <div role="group" aria-label={t("pages.mapUI.listTitle")} className="space-y-3">
          {MAP_GROUPS.map((g) => (
            <div key={g}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-chalk-500">{t(`pages.mapUI.group.${g}`)}</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {MAP_POINTS.filter((p) => p.group === g).map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      aria-pressed={p.key === selected}
                      onClick={() => choose(p.key)}
                      className={cn(
                        "min-h-11 rounded-sm border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400",
                        p.key === selected
                          ? "border-gold-400 bg-gold-500/15 text-chalk-100"
                          : "border-night-700 bg-night-900/60 text-chalk-300 hover:border-gold-500/60",
                      )}
                    >
                      {cards[p.key].name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
