import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Charts of the bot's admin panel, drawn by hand in HTML and SVG: no chart
 * library, no JavaScript. Every mark that carries a value is focusable and
 * shows its tooltip on hover and on keyboard focus (CSS only); every chart
 * also has a screen-reader table, so no value depends on hovering or on
 * colour.
 *
 * Colours: the categorical order below was checked for colour-blind
 * separation on the panels' surface (night-850), adjacent pairs ΔE ≥ 9; a
 * sixth series and beyond fold into "other", in grey. Delivery status uses
 * its own three colours, always named in a legend.
 */

export const SERIES = ["#c98500", "#3987e5", "#d95926", "#199e70", "#9085e9"] as const;
export const OTHER_COLOR = "#66728f";
export const STATUS = { good: "#199e70", warning: "#c98500", bad: "#d94848" } as const;

export const PANEL = "bevel border border-night-700/70 bg-night-850/70 p-4 sm:p-5";

/** A clean axis top above the highest value: 1, 2 or 5 times a power of ten. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

export interface Series {
  id: string;
  label: string;
  color: string;
}

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-300", className)}>
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ title, rows, align }: { title: string; rows: { label: string; value: string; color?: string }[]; align: "left" | "right" }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute top-0 z-20 hidden min-w-36 border border-night-600 bg-night-950/95 px-3 py-2 text-left text-xs shadow-lg shadow-night-950/60",
        "group-hover:block group-focus-visible:block",
        align === "left" ? "left-0" : "right-0",
      )}
    >
      <span className="block font-semibold text-chalk-300">{title}</span>
      {rows.map((r) => (
        <span key={r.label} className="mt-1 flex items-center gap-2 whitespace-nowrap">
          {r.color && <span aria-hidden className="h-0.5 w-3 shrink-0" style={{ background: r.color }} />}
          <span className="font-semibold tabular-nums text-chalk-100">{r.value}</span>
          <span className="text-chalk-500">{r.label}</span>
        </span>
      ))}
    </span>
  );
}

/** Three tick labels under a time axis: first, middle, last bucket. */
function TimeTicks({ labels }: { labels: string[] }) {
  const ticks = [...new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1])];
  return (
    <div aria-hidden className="mt-1.5 flex justify-between pl-9 text-[0.68rem] tabular-nums text-chalk-500">
      {ticks.map((i) => (
        <span key={i}>{labels[i]}</span>
      ))}
    </div>
  );
}

function Gridlines({ max, format, half = true }: { max: number; format: (n: number) => string; half?: boolean }) {
  const lines = half ? [max, max / 2, 0] : [max, 0];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
      {lines.map((v) => (
        <div key={v} className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-right text-[0.65rem] tabular-nums text-chalk-600">{format(v)}</span>
          <span className="h-px flex-1 bg-night-700/80" />
        </div>
      ))}
    </div>
  );
}

/**
 * Columns over time, stacked by series (a single series is a plain column
 * chart). The bars are at most 24 px wide with a 2 px gap between segments;
 * the tooltip lists every series of the bucket.
 */
export function StackedColumns({
  title,
  rows,
  series,
  labels,
  long,
  format,
  empty,
  unitLabel,
  locale,
  height = "h-44",
}: {
  locale: string;
  title: string;
  rows: { key: string; values: Record<string, number> }[];
  series: Series[];
  /** Short label per bucket (axis), and long label (tooltip, table). */
  labels: string[];
  long: string[];
  format: (n: number) => string;
  empty: string;
  /** Name of the total in the tooltip. */
  unitLabel: string;
  height?: string;
}) {
  const totals = rows.map((r) => series.reduce((n, s) => n + (r.values[s.id] ?? 0), 0));
  const top = Math.max(0, ...totals);
  if (top === 0) return <p className="mt-4 text-sm text-chalk-500">{empty}</p>;
  const max = niceMax(top);
  const compact = new Intl.NumberFormat(locale, { notation: "compact" });
  return (
    <>
      {series.length > 1 && <Legend series={series} className="mt-3" />}
      <div className={cn("relative mt-3", height)}>
        <Gridlines max={max} format={(v) => (v >= 10_000 ? compact.format(v) : format(v))} />
        <div className="absolute inset-0 flex items-end gap-[2px] pl-9">
          {rows.map((r, i) => {
            const present = series.filter((s) => (r.values[s.id] ?? 0) > 0);
            return (
              <div
                key={r.key}
                tabIndex={0}
                aria-label={`${long[i]} : ${format(totals[i])} ${unitLabel}`}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none hover:bg-chalk-100/[0.03] focus-visible:bg-chalk-100/[0.05]"
              >
                <div className="flex h-full w-full max-w-6 flex-col-reverse gap-[2px]">
                  {present.map((s, j) => (
                    <div
                      key={s.id}
                      className={cn("w-full transition-[filter] group-hover:brightness-125", j === present.length - 1 && "rounded-t-[4px]")}
                      style={{ height: `${((r.values[s.id] ?? 0) / max) * 100}%`, background: s.color, minHeight: 2 }}
                    />
                  ))}
                </div>
                <Tooltip
                  title={long[i]}
                  align={i < rows.length / 2 ? "left" : "right"}
                  rows={[
                    { label: unitLabel, value: format(totals[i]) },
                    ...(series.length > 1
                      ? present.map((s) => ({ label: s.label, value: format(r.values[s.id] ?? 0), color: s.color }))
                      : []),
                  ]}
                />
              </div>
            );
          })}
        </div>
      </div>
      <TimeTicks labels={labels} />
      {/* sr-only on a wrapper: a table ignores its own width and overflowed the page. */}
      <div className="sr-only"><table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <th scope="row">{long[i]}</th>
              {series.map((s) => (
                <td key={s.id}>{format(r.values[s.id] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}

/** Joins above the baseline, leaves below it: one axis, two directions. */
export function FlowColumns({
  title,
  rows,
  labels,
  long,
  format,
  joinsLabel,
  leavesLabel,
  empty,
}: {
  title: string;
  rows: { key: string; joins: number; leaves: number }[];
  labels: string[];
  long: string[];
  format: (n: number) => string;
  joinsLabel: string;
  leavesLabel: string;
  empty: string;
}) {
  const top = Math.max(0, ...rows.flatMap((r) => [r.joins, r.leaves]));
  if (top === 0) return <p className="mt-4 text-sm text-chalk-500">{empty}</p>;
  const max = niceMax(top);
  return (
    <>
      <Legend
        className="mt-3"
        series={[
          { id: "joins", label: joinsLabel, color: STATUS.good },
          { id: "leaves", label: leavesLabel, color: STATUS.bad },
        ]}
      />
      <div className="relative mt-3 h-44">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[max, 0, max].map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-[0.65rem] tabular-nums text-chalk-600">{i === 2 ? `−${format(v)}` : format(v)}</span>
              <span className={cn("h-px flex-1", i === 1 ? "bg-chalk-600/60" : "bg-night-700/80")} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex gap-[2px] pl-9">
          {rows.map((r, i) => (
            <div
              key={r.key}
              tabIndex={0}
              aria-label={`${long[i]} : ${format(r.joins)} ${joinsLabel}, ${format(r.leaves)} ${leavesLabel}`}
              className="group relative flex h-full min-w-0 flex-1 flex-col items-center outline-none hover:bg-chalk-100/[0.03] focus-visible:bg-chalk-100/[0.05]"
            >
              <div className="flex h-1/2 w-full max-w-6 items-end">
                {r.joins > 0 && <div className="w-full rounded-t-[4px] group-hover:brightness-125" style={{ height: `${(r.joins / max) * 100}%`, background: STATUS.good }} />}
              </div>
              <div className="flex h-1/2 w-full max-w-6 items-start">
                {r.leaves > 0 && <div className="w-full rounded-b-[4px] group-hover:brightness-125" style={{ height: `${(r.leaves / max) * 100}%`, background: STATUS.bad }} />}
              </div>
              <Tooltip
                title={long[i]}
                align={i < rows.length / 2 ? "left" : "right"}
                rows={[
                  { label: joinsLabel, value: format(r.joins), color: STATUS.good },
                  { label: leavesLabel, value: format(r.leaves), color: STATUS.bad },
                ]}
              />
            </div>
          ))}
        </div>
      </div>
      <TimeTicks labels={labels} />
      {/* sr-only on a wrapper: a table ignores its own width and overflowed the page. */}
      <div className="sr-only"><table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{joinsLabel}</th>
            <th scope="col">{leavesLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <th scope="row">{long[i]}</th>
              <td>{format(r.joins)}</td>
              <td>{format(r.leaves)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}

/**
 * A ranking as thin horizontal bars, value at the tip. A row may split into
 * segments (deliveries by status); `aside` adds a figure on the right.
 */
export function RankBars({
  rows,
  format,
  color = SERIES[0],
  className,
  empty,
}: {
  rows: {
    id: string;
    label: React.ReactNode;
    /** Spoken name of the row, when `label` is not plain text. */
    name: string;
    value: number;
    segments?: { label: string; value: number; color: string }[];
    aside?: React.ReactNode;
  }[];
  format: (n: number) => string;
  color?: string;
  empty: string;
  className?: string;
}) {
  const top = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length || top === 0) return <p className="mt-4 text-sm text-chalk-500">{empty}</p>;
  return (
    <ol className={cn("mt-4 space-y-3", className)}>
      {rows.map((r) => {
        const segments = r.segments?.filter((s) => s.value > 0) ?? [{ label: "", value: r.value, color }];
        const detail = r.segments?.map((s) => `${format(s.value)} ${s.label}`).join(", ");
        return (
          <li key={r.id} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-chalk-100">{r.label}</span>
              <span className="flex shrink-0 items-baseline gap-3">
                {r.aside}
                <span className="font-semibold tabular-nums text-chalk-100">{format(r.value)}</span>
              </span>
            </div>
            <div
              className="mt-1.5 flex h-2 gap-[2px]"
              role="img"
              aria-label={`${r.name} : ${format(r.value)}${detail ? ` (${detail})` : ""}`}
              title={detail}
            >
              {segments.map((s, i) => (
                <span
                  key={s.label || i}
                  className={cn(i === segments.length - 1 && "rounded-r-[4px]")}
                  style={{ width: `${(s.value / top) * 100}%`, background: s.color }}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One whole split into parts, shares printed inside the parts wide enough. */
export function SegmentedBar({
  parts,
  label,
  format,
  locale,
}: {
  parts: (Series & { value: number })[];
  label: string;
  format: (n: number) => string;
  locale: string;
}) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (!total) return null;
  const share = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return (
    <>
      <div role="img" aria-label={`${label} : ${parts.map((p) => `${p.label} ${format(p.value)} (${share.format(p.value / total)})`).join(", ")}`} className="mt-4 flex h-7 gap-[2px]">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const ratio = p.value / total;
            return (
              <span
                key={p.id}
                title={`${p.label} : ${format(p.value)}`}
                className="flex items-center overflow-hidden rounded-[4px] px-1.5 text-xs font-semibold text-night-950"
                style={{ width: `${ratio * 100}%`, background: p.color }}
              >
                {ratio >= 0.12 && share.format(ratio)}
              </span>
            );
          })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-chalk-300">{p.label}</span>
            <span className="tabular-nums text-chalk-100">{format(p.value)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Twelve-ish points in a quiet line, the last one marked. */
export function Sparkline({ values, tall = false }: { values: number[]; tall?: boolean }) {
  const size = tall ? "h-10 lg:h-24" : "h-6";
  if (values.length < 2 || Math.max(...values) === Math.min(...values)) {
    return (
      <svg aria-hidden viewBox="0 0 100 24" preserveAspectRatio="none" className={cn(size, "w-full")}>
        <line x1="0" x2="100" y1="20" y2="20" stroke="#2a3758" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const points = values.map((v, i) => [(i / (values.length - 1)) * 100, 22 - ((v - min) / (max - min || 1)) * 19] as const);
  const last = points.at(-1)!;
  // The stretched SVG draws the line; the end dot is HTML, so it stays round.
  return (
    <span aria-hidden className={cn("relative block", size)}>
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="size-full overflow-visible">
        {tall && (
          <polygon points={`0,24 ${points.map(([x, y]) => `${x},${y}`).join(" ")} 100,24`} fill="#e0a92e" fillOpacity="0.08" />
        )}
        <polyline
          points={points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={tall ? "#b8871f" : "#66728f"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400 ring-2 ring-night-850"
        style={{ left: `${last[0]}%`, top: `${(last[1] / 24) * 100}%` }}
      />
    </span>
  );
}

/**
 * A stat tile: label, value, change against the window before (green when
 * it goes the good way), and an optional trend over the window.
 */
export function Kpi({
  label,
  value,
  change,
  goodWhenUp = true,
  changeLabel,
  noBase,
  trend,
  hero = false,
  locale,
  className,
}: {
  locale: string;
  className?: string;
  label: string;
  value: string;
  /** Relative change; null when the window before had nothing. */
  change: number | null;
  goodWhenUp?: boolean;
  /** "vs the 7 days before". */
  changeLabel: string;
  /** Said instead of a change when there is no base. */
  noBase: string;
  trend?: number[];
  hero?: boolean;
}) {
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const flat = change === null || Math.abs(change) < 0.0005;
  const good = !flat && (change! > 0) === goodWhenUp;
  const Icon = flat ? Minus : change! > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={cn(
        "bevel flex flex-col border p-4",
        className,
        hero ? "border-gold-500/50 bg-gradient-to-br from-gold-500/[0.12] via-night-850/80 to-night-850/80" : "border-night-700/70 bg-night-850/70",
      )}
    >
      <dt className="text-sm text-chalk-300">{label}</dt>
      <dd className="contents">
        <span className={cn("mt-1 font-heading font-bold text-chalk-100", hero ? "text-4xl sm:text-5xl" : "text-3xl")}>{value}</span>
        <span
          className={cn(
            "mt-1 flex items-center gap-1 text-xs",
            flat ? "text-chalk-500" : good ? "text-[#4fd1a5]" : "text-blood-400",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {change === null ? noBase : <span className="font-semibold tabular-nums">{percent.format(change)}</span>}
          {change !== null && <span className="text-chalk-500">{changeLabel}</span>}
        </span>
        {trend && (
          <span className={cn("mt-auto block pt-3", hero && "lg:pt-6")}>
            <Sparkline values={trend} tall={hero} />
          </span>
        )}
      </dd>
    </div>
  );
}
