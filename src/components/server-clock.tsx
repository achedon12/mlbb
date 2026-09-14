"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, Clock, Sparkles, Trophy } from "lucide-react";
import { Card } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import {
  SERVER_TIMEZONE,
  COUNTRY_BY_LOCALE,
  offsetTimezone,
  split,
  labelOffset,
  nextEndSeason,
  nextResetWeekly,
  nextResetDaily,
  nextStarlight,
  type EndSeason,
} from "@/lib/server-time";
import { cn } from "@/lib/utils";

/**
 * Server clock, reset countdowns and local reset time in the main countries of
 * each site language.
 *
 * The first render starts from the `reference` instant, set by the server: HTML
 * and hydration agree, and search engines read a complete table. The browser
 * clock then takes over, aligned on each second.
 */
const ORDER_LOCALES: Locale[] = ["fr", "en", "it", "es"];

// A single timer for the whole page, shared by subscribers.
let instant = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const subscribers = new Set<() => void>();

function beat() {
  instant = Date.now();
  subscribers.forEach((reminder) => reminder());
  timer = setTimeout(beat, 1000 - (instant % 1000) + 10);
}

function subscribeToClock(reminder: () => void) {
  subscribers.add(reminder);
  if (subscribers.size === 1) beat();
  return () => {
    subscribers.delete(reminder);
    if (subscribers.size === 0) clearTimeout(timer);
  };
}

const readInstant = () => instant || (instant = Date.now());
const subscribeToNothing = () => () => {};
const readTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || null;

/** Intl formatters, created once per language, shape and time zone. */
function useFormats(siteLocale: Locale) {
  return useMemo(() => {
    const locale = LOCALE_HTML[siteLocale];
    const cache = new Map<string, Intl.DateTimeFormat>();
    const format = (shape: string, options: Intl.DateTimeFormatOptions) => (ms: number, timezone: string) => {
      const key = `${shape}|${timezone}`;
      let f = cache.get(key);
      if (!f) {
        f = new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone });
        cache.set(key, f);
      }
      return f.format(ms);
    };
    const days = new Intl.NumberFormat(locale, { style: "unit", unit: "day", unitDisplay: "narrow" });
    const country = new Intl.DisplayNames(locale, { type: "region" });
    return {
      time: format("h", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }),
      timeShort: format("hc", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      date: format("d", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      dayTime: format("jh", { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      dateTime: format("dh", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      days: (n: number) => days.format(n),
      country: (code: string) => country.of(code) ?? code,
    };
  }, [siteLocale]);
}

function Countdown({ ms, days }: { ms: number; days: (n: number) => string }) {
  const d = split(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {d.days > 0 && `${days(d.days)} `}
      {two(d.hours)}:{two(d.minutes)}:{two(d.seconds)}
    </span>
  );
}

export function ServerClock({ reference, ends }: { reference: number; ends: EndSeason[] }) {
  const t = useT();
  const siteLocale = useLocale();
  const f = useFormats(siteLocale);
  const now = useSyncExternalStore(subscribeToClock, readInstant, () => reference);
  // Reader's time zone: unknown to the server, read once the page is hydrated.
  const timezone = useSyncExternalStore(subscribeToNothing, readTimezone, () => null);
  const here = timezone ?? "UTC";

  const daily = nextResetDaily(now);
  const weekly = nextResetWeekly(now);
  const deadlines: { key: string; icon: LucideIcon; target: number }[] = [
    { key: "daily", icon: Clock, target: daily },
    { key: "weekly", icon: CalendarClock, target: weekly },
    { key: "starlight", icon: Sparkles, target: nextStarlight(now) },
  ];
  const endSeason = nextEndSeason(ends, now);
  const zone = timezone ? t("tools.serverTime.localTime") : "UTC";
  const locales = [siteLocale, ...ORDER_LOCALES.filter((l) => l !== siteLocale)];

  return (
    <div className="space-y-12">
      <Card className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-chalk-500">
          {t("tools.serverTime.serverTime")}
        </p>
        <p role="timer" className="mt-2 font-heading text-6xl font-bold tabular-nums text-gold-400 sm:text-7xl" suppressHydrationWarning>
          {f.time(now, SERVER_TIMEZONE)}
        </p>
        <p className="mt-1 text-chalk-300" suppressHydrationWarning>
          {f.date(now, SERVER_TIMEZONE)} · UTC−8
        </p>
        <p className="mt-3 text-sm text-chalk-500" suppressHydrationWarning>
          {timezone
            ? t("tools.serverTime.yourTime", { time: f.time(now, timezone), timezone: timezone })
            : t("tools.serverTime.utcTime", { time: f.time(now, "UTC") })}
        </p>
      </Card>

      <section aria-labelledby="countdown-title">
        <h2 id="countdown-title" className="font-heading text-2xl font-bold text-chalk-100">
          {t("tools.serverTime.countdownTitle")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {deadlines.map(({ key, icon: Icon, target }) => (
            <li key={key}>
              <Card className="h-full">
                <p className="flex items-center gap-2 text-sm font-semibold text-chalk-200">
                  <Icon size={16} aria-hidden className="text-gold-400" />
                  {t(`tools.serverTime.deadline.${key}`)}
                </p>
                <p role="timer" className="mt-2 font-heading text-4xl font-bold text-chalk-100">
                  <Countdown ms={target - now} days={f.days} />
                </p>
                <p className="mt-1 text-sm text-chalk-500" suppressHydrationWarning>
                  {t("tools.serverTime.on", { date: f.dateTime(target, here), zone })}
                </p>
              </Card>
            </li>
          ))}
          <li>
            <Card className="h-full">
              <p className="flex items-center gap-2 text-sm font-semibold text-chalk-200">
                <Trophy size={16} aria-hidden className="text-gold-400" />
                {t("tools.serverTime.deadline.season")}
              </p>
              {endSeason ? (
                <>
                  <p role="timer" className="mt-2 font-heading text-4xl font-bold text-chalk-100">
                    <Countdown ms={endSeason.end - now} days={f.days} />
                  </p>
                  <p className="mt-1 text-sm text-chalk-500" suppressHydrationWarning>
                    {t("tools.serverTime.seasonEnd", {
                      n: endSeason.season,
                      date: f.dateTime(endSeason.end, here),
                      zone,
                      v: endSeason.patch,
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 font-heading text-2xl font-bold text-chalk-300">
                    {t("tools.serverTime.seasonEndUnknown")}
                  </p>
                  <p className="mt-1 text-sm text-chalk-500">{t("tools.serverTime.seasonEndUnknownDetail")}</p>
                </>
              )}
            </Card>
          </li>
        </ul>

        {timezone && (
          <p className="bevel-sm mt-4 border border-gold-500/40 bg-gold-500/10 p-4 text-sm text-chalk-200">
            {t("tools.serverTime.yourPlace", {
              timezone: timezone,
              offset: labelOffset(offsetTimezone(timezone, now)),
              daily: f.timeShort(daily, timezone),
              weekly: f.dayTime(weekly, timezone),
            })}
          </p>
        )}
      </section>

      <section aria-labelledby="countries-title">
        <h2 id="countries-title" className="font-heading text-2xl font-bold text-chalk-100">
          {t("tools.serverTime.countriesTitle")}
        </h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <p className="mt-3 max-w-2xl text-sm text-chalk-400">{t("tools.serverTime.countriesIntro")}</p>

        <div className="mt-6 space-y-8">
          {locales.map((l) => (
            <div key={l}>
              <h3 className="font-heading text-lg font-bold text-gold-400">{t(`tools.serverTime.group.${l}`)}</h3>
              <div className="mt-2 relative overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <caption className="sr-only">
                    {t("tools.serverTime.legend", { group: t(`tools.serverTime.group.${l}`) })}
                  </caption>
                  <thead className="text-xs uppercase tracking-wide text-chalk-500">
                    <tr>
                      <th scope="col" className="py-2 pr-3 font-medium">{t("tools.serverTime.colCountry")}</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{t("tools.serverTime.colDaily")}</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{t("tools.serverTime.colWeekly")}</th>
                      <th scope="col" className="py-2 font-medium">{t("tools.serverTime.colNow")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COUNTRY_BY_LOCALE[l].map((p) => {
                      const you = p.timezone === timezone;
                      return (
                        <tr key={`${p.country}-${p.timezone}`} className={cn("border-t border-night-800", you && "bg-gold-500/10")}>
                          <th scope="row" className="py-2 pr-3 font-medium text-chalk-100">
                            <span suppressHydrationWarning>
                              {f.country(p.country)}
                              {p.city && ` (${p.city})`}
                            </span>
                            <span className="block text-xs font-normal text-chalk-500" suppressHydrationWarning>
                              {labelOffset(offsetTimezone(p.timezone, now))}
                              {you && ` · ${t("tools.serverTime.you")}`}
                            </span>
                          </th>
                          <td className="py-2 pr-3 tabular-nums text-chalk-200" suppressHydrationWarning>
                            {f.timeShort(daily, p.timezone)}
                          </td>
                          <td className="py-2 pr-3 text-chalk-200" suppressHydrationWarning>
                            {f.dayTime(weekly, p.timezone)}
                          </td>
                          <td className="py-2 tabular-nums text-chalk-400" suppressHydrationWarning>
                            {f.timeShort(now, p.timezone)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
