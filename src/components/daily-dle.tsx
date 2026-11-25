"use client";

import { useEffect, useState } from "react";
import { Check, CircleHelp, Flame, Puzzle } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { readGame, readStats, type DailyMode } from "@/lib/mlbbdle-storage";
import { currentStreak, dayUtc, shiftDay } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * Today's MLBBdle, in one line: each mode solved or not, the streak, and the
 * time left before the next puzzle. Read from what MLBBdle already keeps in
 * the browser; nothing new is stored. Before mounting (and without storage)
 * it reads as a plain invitation to play.
 */

type Status = "solved" | "started" | "open";

interface Today {
  status: Record<DailyMode, Status>;
  streak: number;
  /** Milliseconds before the next puzzle. */
  left: number;
}

const MODES: DailyMode[] = ["classic", "skill"];

function readToday(now: Date): Today {
  const day = dayUtc(now);
  const guesses = readGame(day);
  const status = {} as Record<DailyMode, Status>;
  let streak = 0;
  for (const mode of MODES) {
    const stats = readStats(mode);
    status[mode] = stats.dernier === day ? "solved" : guesses[mode].length > 0 ? "started" : "open";
    streak = Math.max(streak, currentStreak(stats, day));
  }
  return { status, streak, left: Date.parse(`${shiftDay(day, 1)}T00:00:00Z`) - now.getTime() };
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function DailyDle({ place, className }: { place: string; className?: string }) {
  const t = useT();
  const [today, setToday] = useState<Today | null>(null);

  useEffect(() => {
    const update = () => setToday(readToday(new Date()));
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const done = today ? MODES.filter((m) => today.status[m] === "solved").length : 0;
  const all = done === MODES.length;
  const headline = !today
    ? t("dailyDle.title")
    : all
      ? t("dailyDle.allDone")
      : done > 0
        ? t("dailyDle.oneLeft")
        : today.streak > 0
          ? t("dailyDle.keepStreak")
          : t("dailyDle.title");

  return (
    <section
      aria-label={t("dailyDle.label")}
      className={cn("bevel flex flex-wrap items-center gap-x-5 gap-y-3 border border-night-700/70 bg-night-900/60 px-4 py-3", className)}
    >
      <div className="min-w-0 flex-1">
        <p className="font-heading text-xs font-bold uppercase tracking-wide text-gold-400">MLBBdle</p>
        <p className="mt-0.5 font-semibold text-chalk-100">{headline}</p>
        {today && (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-400">
            {MODES.map((m) => (
              <li key={m} className="inline-flex items-center gap-1">
                {today.status[m] === "solved" ? (
                  <Check size={12} aria-hidden className="text-gold-400" />
                ) : (
                  <span aria-hidden className="inline-block size-2 rounded-full border border-chalk-500" />
                )}
                {t(`dailyDle.mode.${m}`)} · {t(`dailyDle.status.${today.status[m]}`)}
              </li>
            ))}
            {today.streak > 0 && (
              <li className="inline-flex items-center gap-1 text-chalk-200">
                <Flame size={12} aria-hidden className="text-gold-400" />
                {t(today.streak === 1 ? "dailyDle.streak1" : "dailyDle.streak", { n: today.streak })}
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-4">
        {today && (
          // Changes every second: kept out of any announced region.
          <p className="text-xs text-chalk-500">
            {t("dailyDle.next")} <span className="font-semibold tabular-nums text-chalk-200">{clock(today.left)}</span>
          </p>
        )}
        {!all && (
          <Link
            href="/mlbbdle"
            onClick={() => trackEvent("Return", "Daily open", place, today?.streak ?? 0)}
            className="bevel-sm inline-flex min-h-11 items-center justify-center bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
          >
            {t(done > 0 || (today && MODES.some((m) => today.status[m] === "started")) ? "dailyDle.continue" : "dailyDle.play")}
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * Today's two games, as two cards for the home page: MLBBdle with each mode
 * solved or not and the streak, the quiz with its daily challenge, then the
 * time left before both renew (midnight UTC, the same day for MLBBdle and
 * the quiz). Read from what MLBBdle already keeps in the browser; before
 * mounting, each card reads as a plain invitation to play.
 */
export function DailyGames({ place, className }: { place: string; className?: string }) {
  const t = useT();
  const [today, setToday] = useState<Today | null>(null);

  useEffect(() => {
    const update = () => setToday(readToday(new Date()));
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const done = today ? MODES.filter((m) => today.status[m] === "solved").length : 0;
  const all = done === MODES.length;
  const started = !!today && MODES.some((m) => today.status[m] === "started");
  const card = "bevel flex h-full flex-col bg-night-950 p-4 shadow-[inset_0_3px_0_var(--color-gold-400)] sm:p-5";
  const title = "display-caps pr-[0.12em] text-[1.9rem] leading-none text-chalk-100 transition-colors group-hover:text-gold-300";

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 sm:gap-4", className)}>
      <div className={card}>
        <Link
          href="/mlbbdle"
          onClick={() => trackEvent("Return", "Daily open", place, today?.streak ?? 0)}
          className="group flex flex-1 flex-col"
        >
          <span className="flex items-center gap-2 text-gold-400">
            <Puzzle size={20} aria-hidden />
            <span className={title}>{t("nav.mlbbdle.label")}</span>
          </span>
          <span className="mt-2 block text-sm text-chalk-300">{t("nav.mlbbdle.desc")}</span>
          {today && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-chalk-300">
              {MODES.map((m) => (
                <li key={m} className="inline-flex items-center gap-1.5">
                  {today.status[m] === "solved" ? (
                    <Check size={14} aria-hidden className="text-gold-400" />
                  ) : (
                    <span aria-hidden className="inline-block size-2.5 rounded-full border border-chalk-500" />
                  )}
                  {t(`dailyDle.mode.${m}`)} · {t(`dailyDle.status.${today.status[m]}`)}
                </li>
              ))}
              {today.streak > 0 && (
                <li className="inline-flex items-center gap-1.5 text-chalk-100">
                  <Flame size={14} aria-hidden className="text-gold-400" />
                  {t(today.streak === 1 ? "dailyDle.streak1" : "dailyDle.streak", { n: today.streak })}
                </li>
              )}
            </ul>
          )}
          <span className="mt-auto pt-4">
            {all ? (
              <span className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-gold-400">
                <Check size={16} aria-hidden />
                {t("dailyDle.allDone")}
              </span>
            ) : (
              <span className="btn btn-primary w-full sm:w-auto">
                {t(done > 0 || started ? "dailyDle.continue" : "dailyDle.play")}
              </span>
            )}
          </span>
        </Link>
      </div>
      <div className={card}>
        <Link href="/quiz" className="group flex flex-1 flex-col">
          <span className="flex items-center gap-2 text-gold-400">
            <CircleHelp size={20} aria-hidden />
            <span className={title}>{t("nav.quiz.label")}</span>
          </span>
          <span className="mt-2 block text-sm text-chalk-300">{t("nav.quiz.desc")}</span>
          <span className="mt-auto pt-4">
            <span className="btn btn-primary w-full sm:w-auto">{t("dailyDle.play")}</span>
          </span>
        </Link>
      </div>
      {/* Changes every second: kept out of any announced region. */}
      <p className="text-sm text-chalk-400 sm:col-span-2">
        {t("dailyDle.next")}{" "}
        <span className="figure inline-block text-xl text-chalk-100">{today ? clock(today.left) : "--:--:--"}</span>
      </p>
    </div>
  );
}
