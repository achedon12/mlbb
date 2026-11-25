"use client";

import { useEffect, useState } from "react";
import { nextResetDaily, SERVER_TIMEZONE } from "@/lib/server-time";

/**
 * Server time and the wait before the daily reset, ticking every half
 * minute, as a run of text in the home page's line of facts. The page is prerendered, so the server cannot know the time the
 * visitor reads it: until the first tick, dashes hold the place of the
 * digits, at the same width, so nothing shifts when they arrive.
 *
 * Labels come translated from the server component: the home catalogue
 * stays out of the browser.
 */
export function ServerTimeChip({
  locale,
  timeLabel,
  resetLabel,
}: {
  locale: string;
  timeLabel: string;
  resetLabel: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  let time = "--:--";
  let wait = "-- h --";
  if (now !== null) {
    time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: SERVER_TIMEZONE }).format(now);
    const minutes = Math.max(0, Math.ceil((nextResetDaily(now) - now) / 60_000));
    const unit = (value: number, u: "hour" | "minute") =>
      new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: "narrow" }).format(value);
    wait = `${unit(Math.floor(minutes / 60), "hour")} ${unit(minutes % 60, "minute")}`;
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 tabular-nums">
      <span>{timeLabel}</span>
      <span className="font-heading text-base font-bold text-chalk-100 transition-colors group-hover:text-gold-300">{time}</span>
      <span>
        {resetLabel} {wait}
      </span>
    </span>
  );
}
