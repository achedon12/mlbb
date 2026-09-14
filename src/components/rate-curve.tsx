"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export interface PointCurve {
  date: string;
  value: number | null;
}

/** Dated event to mark with a vertical line: a patch. */
export interface Marker {
  date: string;
  label: string;
}

/** Series overlaid on the others, aligned day by day on `dates`. */
export interface SeriesCurve {
  name: string;
  values: (number | null)[];
  /** Line colour class (`text-…`), reused by the legend and the hover. */
  color: string;
  /** Dashed line: the series identity does not rely on colour alone. */
  dashes?: boolean;
}

/** One series (`points`) or several, aligned on the same dates (`dates` and `series`). */
type Data =
  | { points: PointCurve[]; dates?: never; series?: never }
  | { dates: string[]; series: SeriesCurve[]; points?: never };

// Drawing height and margins, in pixels: the width follows the frame's, so
// one drawing unit equals one pixel and the text keeps its size.
const H = 200;
const LEFT = 42;
const RIGHT = 8;
const TOP = 16;
const BOTTOM = 26;
const DASHES = "6 4";

/**
 * Curve of a rate over the days, drawn in SVG: no charting library for one
 * line and three ticks. A day without a measure breaks the line rather than
 * joining two unrelated points. Hovering (mouse or finger) shows the day's
 * value.
 *
 * Several series overlay on a shared scale: legend under the drawing, each
 * series name at the end of its line, and a tooltip giving each one's value
 * on hover.
 */
export function RateCurve({
  markers = [],
  decimals = 1,
  label,
  ...data
}: Data & {
  markers?: Marker[];
  decimals?: number;
  /** Summary read by screen readers instead of the drawing. */
  label: string;
}) {
  const locale = useLocale();
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(520);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setL(Math.max(240, Math.round(e.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const multiple = data.series !== undefined;
  const dates = data.series ? data.dates : data.points.map((p) => p.date);
  const traces: SeriesCurve[] = data.series ?? [
    { name: "", values: data.points.map((p) => p.value), color: "text-gold-400" },
  ];
  const n = dates.length;

  const values = traces.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (values.length < 2) return <div ref={frame} />;

  const lower = Math.min(...values);
  const higher = Math.max(...values);
  const margin = Math.max((higher - lower) * 0.15, decimals >= 2 ? 0.05 : 0.3);
  const min = lower - margin;
  const max = higher + margin;

  const x = (i: number) => LEFT + (i / Math.max(n - 1, 1)) * (L - LEFT - RIGHT);
  const y = (v: number) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);

  const traceOf = (series: (number | null)[]) => {
    let d = "";
    let continuous = false;
    series.forEach((v, i) => {
      if (v === null) {
        continuous = false;
        return;
      }
      d += `${continuous ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      continuous = true;
    });
    return d;
  };
  const paths = traces.map((s) => traceOf(s.values));
  // The area under the curve only makes sense for a single series with no gap.
  const withoutHole = !multiple && traces[0].values.every((v) => v !== null);
  const area = withoutHole ? `${paths[0]}L${x(n - 1)},${H - BOTTOM}L${x(0)},${H - BOTTOM}Z` : null;

  const count = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const date = (s: string) => day.format(new Date(`${s}T00:00:00Z`));

  const ticks = [higher, (higher + lower) / 2, lower];
  const labels = [0, Math.floor((n - 1) / 2), n - 1];
  const visible = markers.map((r) => ({ ...r, i: dates.indexOf(r.date) })).filter((r) => r.i >= 0);
  const active = hover !== null && traces.some((s) => s.values[hover] != null) ? hover : null;
  const onRight = active !== null && active > n / 2;

  // Each series name at the end of its line: the highest one above, the
  // others below, so that two close line ends do not overlap.
  const ends = traces
    .map((s, k) => {
      let i = s.values.length - 1;
      while (i >= 0 && s.values[i] === null) i--;
      return { k, i, v: i >= 0 ? s.values[i]! : null };
    })
    .filter((f): f is { k: number; i: number; v: number } => f.v !== null)
    .sort((a, b) => b.v - a.v);

  const follow = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L;
    const i = Math.round(((px - LEFT) / (L - LEFT - RIGHT)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={frame} className="relative">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        role="img"
        aria-label={label}
        className={cn("block h-[200px] w-full touch-pan-y select-none", !multiple && traces[0].color)}
        onPointerMove={follow}
        onPointerDown={follow}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={LEFT} x2={L - RIGHT} y1={y(v)} y2={y(v)} className="stroke-night-700" strokeDasharray="3 4" />
            <text x={LEFT - 6} y={y(v) + 4} textAnchor="end" className="fill-chalk-500 text-[11px] tabular-nums">
              {count.format(v)}
            </text>
          </g>
        ))}

        {labels.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="fill-chalk-500 text-[11px]"
          >
            {date(dates[i])}
          </text>
        ))}

        {visible.map((r) => (
          <g key={r.date + r.label}>
            <line x1={x(r.i)} x2={x(r.i)} y1={TOP - 6} y2={H - BOTTOM} className="stroke-azure-400/70" strokeDasharray="2 3" />
            <text
              x={x(r.i) + (r.i > n / 2 ? -4 : 4)}
              y={TOP - 6}
              textAnchor={r.i > n / 2 ? "end" : "start"}
              className="fill-azure-400 text-[10px]"
            >
              {r.label}
            </text>
          </g>
        ))}

        {area && <path d={area} fill={`url(#${id}-aire)`} />}
        {traces.map((s, k) => (
          <path
            key={k}
            d={paths[k]}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.dashes ? DASHES : undefined}
            className={s.color}
          />
        ))}

        {multiple &&
          active === null &&
          ends.map((f, rank) => (
            <text
              key={f.k}
              x={x(f.i) - 4}
              y={Math.min(Math.max(y(f.v) + (rank === 0 ? -8 : 16), TOP + 10), H - BOTTOM - 4)}
              textAnchor="end"
              paintOrder="stroke"
              strokeWidth={4}
              strokeLinejoin="round"
              className="fill-chalk-200 stroke-night-900 text-[11px] font-semibold"
            >
              {traces[f.k].name}
            </text>
          ))}

        {active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={TOP} y2={H - BOTTOM} className="stroke-chalk-500/60" />
            {traces.map((s, k) =>
              s.values[active] == null ? null : (
                <circle
                  key={k}
                  cx={x(active)}
                  cy={y(s.values[active]!)}
                  r={4.5}
                  fill="currentColor"
                  className={cn("stroke-night-950", s.color)}
                  strokeWidth={2}
                />
              ),
            )}
            {!multiple && (
              <text
                x={x(active) + (onRight ? -8 : 8)}
                y={Math.max(y(traces[0].values[active]!) - 10, TOP + 10)}
                textAnchor={onRight ? "end" : "start"}
                className="fill-chalk-100 text-[12px] font-semibold tabular-nums"
              >
                {`${date(dates[active])} · ${count.format(traces[0].values[active]!)} %`}
              </text>
            )}
          </g>
        )}
      </svg>

      {/* Several series: each one's value for the day, in a tooltip. */}
      {multiple && active !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1 z-10 w-max max-w-[60%] border border-night-700 bg-night-950/95 px-2.5 py-1.5 text-xs shadow-lg shadow-black/40"
          style={{ left: x(active), transform: onRight ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}
        >
          <p className="font-semibold text-chalk-100">{date(dates[active])}</p>
          <ul className="mt-1 space-y-0.5">
            {traces.map((s, k) => (
              <li key={k} className="flex items-center gap-2 text-chalk-300">
                <Badge series={s} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="font-semibold tabular-nums text-chalk-100">
                  {s.values[active] == null ? "—" : `${count.format(s.values[active]!)} %`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {multiple && (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-chalk-300">
          {traces.map((s, k) => (
            <li key={k} className="flex items-center gap-2">
              <Badge series={s} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sample of a series line, for the legend and the tooltip. */
function Badge({ series }: { series: SeriesCurve }) {
  return (
    <svg aria-hidden width="18" height="6" className={cn("shrink-0", series.color)}>
      <line
        x1="1"
        x2="17"
        y1="3"
        y2="3"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={series.dashes ? "4 3" : undefined}
      />
    </svg>
  );
}
