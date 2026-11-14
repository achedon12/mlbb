import { cn } from "@/lib/utils";

/**
 * Count per day as bars, for the bot's admin panel: drawn with CSS like
 * `DurationBars`, no chart library and no JavaScript. The highest day is in
 * gold. Screen readers get the values as a table instead of the drawing, and
 * the first, middle and last days label the axis at every width.
 */
export function DayBars({
  title,
  points,
  locale,
  empty,
  className,
}: {
  title: string;
  points: { day: string; value: number }[];
  locale: string;
  /** Shown instead of a flat drawing when every day is zero. */
  empty: string;
  className?: string;
}) {
  const top = Math.max(0, ...points.map((p) => p.value));
  const format = new Intl.NumberFormat(locale);
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  const ticks = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  return (
    <figure className={cn("bevel border border-night-700/70 bg-night-900/60 p-3 sm:p-4", className)}>
      <figcaption className="flex items-baseline justify-between gap-3 text-sm font-semibold text-chalk-100">
        <span>{title}</span>
        {/* The highest day's value: the scale of the bars, which have no axis. */}
        {top > 0 && <span aria-hidden className="text-xs font-normal tabular-nums text-gold-400">{format.format(top)}</span>}
      </figcaption>
      {top === 0 ? (
        <p className="mt-3 text-sm text-chalk-500">{empty}</p>
      ) : (
        <>
          <div aria-hidden className="mt-3 flex h-28 items-end gap-px sm:gap-0.5">
            {points.map((p) => (
              <div
                key={p.day}
                title={`${dayLabel(p.day)}: ${format.format(p.value)}`}
                className={cn("min-w-0 flex-1 rounded-t-sm", p.value === top ? "bg-gold-500" : "bg-chalk-500/40")}
                style={{ height: `${p.value ? Math.max(4, (p.value / top) * 100) : 0}%` }}
              />
            ))}
          </div>
          <div aria-hidden className="mt-1 flex justify-between text-[0.65rem] text-chalk-500 sm:text-xs">
            {[...ticks].map((i) => (
              <span key={i}>{points[i] ? dayLabel(points[i].day) : ""}</span>
            ))}
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {points.map((p) => (
                <tr key={p.day}>
                  <th scope="row">{dayLabel(p.day)}</th>
                  <td>{format.format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
