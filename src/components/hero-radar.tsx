import { cn } from "@/lib/utils";

/**
 * Hero radar: one web per hero on shared axes, each value scaled between 0
 * and 1. Pure SVG, with no script or page measurement: it renders as is on the
 * server as in a client component, and the `viewBox` fits it to the frame's
 * width. The drawing is only a shape: exact values live in the table the page
 * places next to it, and the summary (`summary`) tells screen readers so.
 */

export type PatternTrait = "solid" | "dashed" | "dotted";

/** Line pattern: a series' identity does not rely on colour alone. */
export const DASHES: Record<PatternTrait, string | undefined> = { solid: undefined, dashed: "6 4", dotted: "1.5 3.5" };

/** Colour and pattern of each compared hero, in picker order. */
export const SERIES_STYLES: { color: string; pattern: PatternTrait }[] = [
  { color: "text-gold-400", pattern: "solid" },
  { color: "text-azure-400", pattern: "dashed" },
  { color: "text-emerald-400", pattern: "dotted" },
];

export interface SeriesRadar {
  name: string;
  /** One value per axis, between 0 and 1; null for an unmeasured axis. */
  values: (number | null)[];
  /** Colour class (`text-…`), reused by the legend. */
  color: string;
  pattern?: PatternTrait;
}

/** In-game ratings (out of 10), then win and ban rates: the comparator's six axes. */
export const AXES_RADAR = ["offense", "durability", "abilityEffects", "difficulty", "win", "ban"] as const;

/**
 * Value scaled between 0.1 and 1 over the rank's [min, max] range: the lowest
 * hero stays visible, near the centre, rather than merged with it.
 */
export function normalize(v: number | null, [min, max]: readonly [number, number]): number | null {
  if (v === null) return null;
  if (max <= min) return 0.55;
  return 0.1 + 0.9 * Math.min(1, Math.max(0, (v - min) / (max - min)));
}

/** A hero's values on AXES_RADAR: ratings out of 10, rates scaled to the rank's range. */
export function valuesRadar(
  notes: { offense: number | null; durability: number | null; abilityEffects: number | null; difficulty: number | null },
  rate: { win: number; ban: number } | null,
  bounds: { win: readonly [number, number]; ban: readonly [number, number] } | null,
): (number | null)[] {
  const note = (v: number | null) => (v === null ? null : Math.min(1, Math.max(0, v / 10)));
  return [
    note(notes.offense),
    note(notes.durability),
    note(notes.abilityEffects),
    note(notes.difficulty),
    rate && bounds ? normalize(rate.win, bounds.win) : null,
    rate && bounds ? normalize(rate.ban, bounds.ban) : null,
  ];
}

// Drawing: one unit is one pixel when the frame is 360 wide.
const L = 360;
const H = 292;
const CX = 180;
const CY = 150;
const R = 92;

/** Axis label on two lines at most, split between two words near the middle. */
function cut(label: string): string[] {
  if (label.length <= 13 || !label.includes(" ")) return [label];
  const words = label.split(" ");
  let best = 1;
  for (let i = 1; i < words.length; i += 1) {
    const gap = (k: number) => Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
    if (gap(i) < gap(best)) best = i;
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

export function HeroRadar({
  id,
  axes,
  series,
  title,
  summary,
  className,
}: {
  /** Prefix of the drawing's ids, unique in the page. */
  id: string;
  /** Label of each axis, in value order. */
  axes: string[];
  series: SeriesRadar[];
  title: string;
  /** Summary read instead of the drawing: where to find the exact values. */
  summary: string;
  className?: string;
}) {
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => [CX + Math.cos(angle(i)) * R * v, CY + Math.sin(angle(i)) * R * v] as const;
  const polygon = (values: number[]) => values.map((v, i) => point(i, v).map((c) => c.toFixed(1)).join(",")).join(" ");

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        role="img"
        aria-labelledby={`${id}-titre ${id}-resume`}
        className="mx-auto block h-auto w-full max-w-[26rem]"
      >
        <title id={`${id}-titre`}>{title}</title>
        <desc id={`${id}-resume`}>{summary}</desc>
        <g fill="none" stroke="currentColor" className="text-night-700">
          {[0.25, 0.5, 0.75, 1].map((a) => (
            <polygon key={a} points={polygon(Array(n).fill(a))} strokeWidth={a === 1 ? 1.2 : 0.7} />
          ))}
          {axes.map((_, i) => {
            const [x, y] = point(i, 1);
            return <line key={i} x1={CX} y1={CY} x2={x.toFixed(1)} y2={y.toFixed(1)} strokeWidth={0.7} />;
          })}
        </g>
        {series.map((s, k) => (
          <g key={k} className={s.color}>
            <polygon
              points={polygon(s.values.map((v) => v ?? 0))}
              fill="currentColor"
              fillOpacity={0.1}
              stroke="currentColor"
              strokeWidth={2}
              strokeDasharray={DASHES[s.pattern ?? "solid"]}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => {
              if (v === null) return null;
              const [x, y] = point(i, v);
              return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={2.6} fill="currentColor" />;
            })}
          </g>
        ))}
        {axes.map((label, i) => {
          const [x, y] = point(i, 1.16);
          const cos = Math.cos(angle(i));
          const sin = Math.sin(angle(i));
          const rows = cut(label);
          const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
          // At the top, text rises above the vertex; at the bottom, it drops; on the sides, it centres.
          const y0 = sin < -0.5 ? y - 12 * (rows.length - 1) : sin > 0.5 ? y + 9 : y + 4 - 6 * (rows.length - 1);
          return (
            <text key={i} x={x.toFixed(1)} y={y0.toFixed(1)} textAnchor={anchor} className="fill-chalk-300 text-[11px]">
              {rows.map((l, k) => (
                <tspan key={k} x={x.toFixed(1)} dy={k === 0 ? 0 : 12}>
                  {l}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-chalk-300">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <TraitLegend color={s.color} pattern={s.pattern} />
            {s.name}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Sample of a series' line, for a legend or a header. */
export function TraitLegend({ color, pattern = "solid", className }: { color: string; pattern?: PatternTrait; className?: string }) {
  return (
    <svg aria-hidden width="20" height="6" className={cn("shrink-0", color, className)}>
      <line x1="1" y1="3" x2="19" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={DASHES[pattern]} />
    </svg>
  );
}
