"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw, Undo2 } from "lucide-react";
import { useT } from "@/i18n/fournisseur";
import { OBJECTIFS } from "@/lib/chatiment";
import {
  ALERTED_KEYS,
  KILLABLES,
  crossedAlerts,
  formatTime,
  gameTime,
  objectiveState,
  parseMatch,
  parseSettings,
  parseTime,
  recordKill,
  remaining,
  schedule,
  setTime,
  shiftTime,
  startMatch,
  togglePause,
  undoLastKill,
  upcoming,
  type GameEvent,
  type KillableKey,
  type Match,
  type ObjectiveState,
  type Settings,
  type Side,
} from "@/lib/objectives";
import { cn } from "@/lib/utils";

/**
 * Objective timer, meant to sit next to the game screen: match clock, big
 * "objective killed" buttons, upcoming spawns and alerts at 30 then 10 seconds
 * (vibration, optional beep, highlight, screen reader announcement).
 *
 * Everything runs in the browser: no request, so it works offline once the
 * page is loaded. The match lives in the tab (sessionStorage): an accidental
 * reload keeps it, a new tab starts fresh. Alert settings persist from one
 * match to the next (localStorage).
 */
const MATCH_KEY = "mlbb_timer_match";
const SETTINGS_KEY = "mlbb_timer_settings";
const STORAGE_EVENT = "mlbb-timer";
const PORTRAITS: Record<KillableKey, string> = {
  turtle: OBJECTIFS.tortue.image,
  lord: OBJECTIFS.seigneur.image,
  "purple-buff": OBJECTIFS["buff-violet"].image,
  "orange-buff": OBJECTIFS["buff-orange"].image,
};
/** Highlight thresholds, in seconds: the same as the alerts. */
const SOON = 30;
const URGENT = 10;

// One timer for the page: four ticks per second flip the digits on time
// without draining the phone.
let instant = 0;
let ticker: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();
function tick() {
  instant = Date.now();
  clockListeners.forEach((listener) => listener());
}
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    tick();
    ticker = setInterval(tick, 250);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) clearInterval(ticker);
  };
}
const readInstant = () => instant || (instant = Date.now());

// Storage read as an external store. Without storage (strict private mode),
// the in-memory copy lasts for the visit.
const memory: Record<string, string | null> = {};
function read(area: "session" | "local", key: string): string | null {
  try {
    return (area === "session" ? sessionStorage : localStorage).getItem(key) ?? memory[key] ?? null;
  } catch {
    return memory[key] ?? null;
  }
}
function write(area: "session" | "local", key: string, value: string | null) {
  memory[key] = value;
  try {
    const storage = area === "session" ? sessionStorage : localStorage;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Storage refused: the in-memory copy is enough.
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}
function subscribeStorage(listener: () => void) {
  window.addEventListener(STORAGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(STORAGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
const readRawMatch = () => read("session", MATCH_KEY);
const readRawSettings = () => read("local", SETTINGS_KEY);
const subscribeNothing = () => () => {};
const canVibrate = () => typeof navigator.vibrate === "function";
const canWakeLock = () => "wakeLock" in navigator;
const falseOnServer = () => false;

// Beep: the audio context is created on a tap, otherwise mobile browsers keep it muted.
let audio: AudioContext | null = null;
function audioContext(): AudioContext | null {
  if (audio) return audio;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio = new Ctor();
  return audio;
}
/** One short beep at 30 s, two higher ones at 10 s. */
function beep(times: number) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  for (let i = 0; i < times; i++) {
    const start = ctx.currentTime + i * 0.2;
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    oscillator.frequency.value = times > 1 ? 1175 : 880;
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
    oscillator.connect(volume).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.17);
  }
}

/** Colour of a countdown: calm, soon (30 s) or urgent (10 s). */
function urgency(left: number | null): "calm" | "soon" | "urgent" {
  if (left === null || left <= 0) return "calm";
  return left <= URGENT ? "urgent" : left <= SOON ? "soon" : "calm";
}

const button =
  "inline-flex min-h-14 items-center justify-center gap-2 px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-or-400 disabled:cursor-not-allowed disabled:opacity-50";

export function ObjectiveTimer() {
  const t = useT();
  const fieldId = useId();
  const helpId = useId();
  const errorId = useId();
  const stateId = useId();
  const now = useSyncExternalStore(subscribeClock, readInstant, () => 0);
  const rawMatch = useSyncExternalStore(subscribeStorage, readRawMatch, () => null);
  const rawSettings = useSyncExternalStore(subscribeStorage, readRawSettings, () => null);
  const vibrates = useSyncExternalStore(subscribeNothing, canVibrate, falseOnServer);
  const wakeLockSupported = useSyncExternalStore(subscribeNothing, canWakeLock, falseOnServer);
  const match = useMemo(() => parseMatch(rawMatch), [rawMatch]);
  const settings = useMemo(() => parseSettings(rawSettings), [rawSettings]);
  const events = useMemo(() => schedule(match?.kills ?? []), [match]);
  const time = match ? gameTime(match, now) : 0;
  const running = match?.running ?? false;
  const next = upcoming(events, time);

  const [input, setInput] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lock, setLock] = useState<"idle" | "on" | "denied">("idle");

  const updateMatch = (f: (m: Match | null, now: number) => Match | null) => {
    const updated = f(parseMatch(readRawMatch()), Date.now());
    write("session", MATCH_KEY, updated ? JSON.stringify(updated) : null);
  };
  const updateSettings = (change: Partial<Settings>) => write("local", SETTINGS_KEY, JSON.stringify({ ...settings, ...change }));

  // Alerts: every threshold crossed since the previous clock reading.
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      previous.current = null;
      return;
    }
    const before = previous.current;
    previous.current = time;
    if (before === null) return;
    const alerts = crossedAlerts(events, before, time);
    if (alerts.length === 0) return;
    const urgent = alerts.some((a) => a.threshold <= URGENT);
    if (settings.vibration && vibrates) navigator.vibrate(urgent ? [90, 60, 90, 60, 90] : [160]);
    if (settings.sound) beep(urgent ? 2 : 1);
  }, [time, running, events, settings.vibration, settings.sound, vibrates]);

  // Screen on: the lock drops when the tab goes to the background, take it back on return.
  useEffect(() => {
    if (!settings.wakeLock || !wakeLockSupported) return;
    let sentinel: WakeLockSentinel | null = null;
    let done = false;
    const request = () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      navigator.wakeLock.request("screen").then(
        (s) => {
          if (done) {
            void s.release();
            return;
          }
          sentinel = s;
          setLock("on");
          s.addEventListener("release", () => {
            if (!done) setLock("idle");
          });
        },
        () => {
          if (!done) setLock("denied");
        },
      );
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", request);
      void sentinel?.release();
    };
  }, [settings.wakeLock, wakeLockSupported]);

  // The reset confirmation drops by itself: a single stray tap erases nothing.
  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirming]);

  const label = (key: string, side: Side | null) =>
    side ? `${t(`pages.timerUI.name.${key}`)} (${t(`pages.timerUI.side.${side}`)})` : t(`pages.timerUI.name.${key}`);

  // Announcement derived from time: it only changes at thresholds, so screen readers speak it then.
  let announcement = "";
  if (running) {
    for (const e of next) {
      if (!ALERTED_KEYS.has(e.key)) continue;
      const left = remaining(e.at, time);
      if (left > 0 && left <= SOON) {
        announcement = t("pages.timerUI.announce", { objective: label(e.key, e.side), n: left <= URGENT ? URGENT : SOON });
        break;
      }
    }
  }

  const sync = (evt: React.FormEvent) => {
    evt.preventDefault();
    const seconds = parseTime(input);
    if (seconds === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setInput("");
    updateMatch((m, n) => setTime(m, seconds, n));
  };

  const lastKill = match?.kills.at(-1);
  const clockState = !match ? "stopped" : match.running ? "running" : "paused";

  return (
    <div className="space-y-10">
      <p aria-live="assertive" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {/* minmax(0, 1fr) tracks: an intrinsic width (the time field) must never widen the column past the screen. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section aria-labelledby="timer-clock" className="relative min-w-0">
          <div aria-hidden className="biseau absolute inset-0 border border-nuit-700/70 bg-nuit-900/80" />
          <div className="relative p-4 sm:p-5">
            <h2 id="timer-clock" className="text-xs font-semibold uppercase tracking-[0.2em] text-craie-500">
              {t("pages.timerUI.clockTitle")}
            </h2>
            <p
              role="timer"
              aria-describedby={stateId}
              className="mt-1 font-titre text-7xl font-bold leading-none tabular-nums text-craie-100 sm:text-8xl"
              suppressHydrationWarning
            >
              {formatTime(time)}
            </p>
            <p id={stateId} className="mt-2 text-sm text-craie-400">
              {t(`pages.timerUI.state.${clockState}`)}
            </p>

            {!match ? (
              <button
                type="button"
                onClick={() => {
                  // The start tap also unlocks audio on mobile.
                  if (settings.sound) audioContext();
                  updateMatch((_, n) => startMatch(n));
                }}
                className={cn(button, "biseau-sm mt-4 w-full bg-or-500 text-lg text-nuit-950 hover:bg-or-400")}
              >
                <Play aria-hidden size={20} />
                {t("pages.timerUI.start")}
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
                <button
                  type="button"
                  aria-label={t("pages.timerUI.minus5Label")}
                  onClick={() => updateMatch((m, n) => (m ? shiftTime(m, -5, n) : m))}
                  className={cn(button, "biseau-sm bg-nuit-800 px-2 tabular-nums text-craie-100 hover:bg-nuit-700")}
                >
                  {t("pages.timerUI.minus5")}
                </button>
                <button
                  type="button"
                  onClick={() => updateMatch((m, n) => (m ? togglePause(m, n) : m))}
                  className={cn(
                    button,
                    "biseau-sm px-2",
                    match.running ? "bg-nuit-700 text-craie-100 hover:bg-nuit-600" : "bg-or-500 text-nuit-950 hover:bg-or-400",
                  )}
                >
                  {match.running ? <Pause aria-hidden size={20} /> : <Play aria-hidden size={20} />}
                  {t(match.running ? "pages.timerUI.pause" : "pages.timerUI.resume")}
                </button>
                <button
                  type="button"
                  aria-label={t("pages.timerUI.plus5Label")}
                  onClick={() => updateMatch((m, n) => (m ? shiftTime(m, 5, n) : m))}
                  className={cn(button, "biseau-sm bg-nuit-800 px-2 tabular-nums text-craie-100 hover:bg-nuit-700")}
                >
                  {t("pages.timerUI.plus5")}
                </button>
              </div>
            )}

            <form onSubmit={sync} className="mt-4" noValidate>
              <label htmlFor={fieldId} className="block text-sm font-semibold text-craie-300">
                {t("pages.timerUI.timeField")}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={fieldId}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="3:45"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${helpId} ${errorId}` : helpId}
                  className="h-14 w-0 min-w-0 flex-1 rounded-sm border border-nuit-600 bg-nuit-950 px-3 font-titre text-2xl tabular-nums text-craie-100 placeholder:text-craie-600 focus:border-or-400 focus:outline-none"
                />
                <button type="submit" className={cn(button, "biseau-sm shrink-0 bg-azur-500 text-nuit-950 hover:bg-azur-400")}>
                  {t("pages.timerUI.apply")}
                </button>
              </div>
              <p id={helpId} className="mt-1.5 text-xs text-craie-500">
                {t("pages.timerUI.inputHelp")}
              </p>
              {invalid && (
                <p id={errorId} role="alert" className="mt-1 text-sm font-semibold text-sang-500">
                  {t("pages.timerUI.timeError")}
                </p>
              )}
            </form>
          </div>
        </section>

        <section aria-labelledby="timer-kills" className="min-w-0">
          <h2 id="timer-kills" className="text-xs font-semibold uppercase tracking-[0.2em] text-craie-500">
            {t("pages.timerUI.killsTitle")}
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {KILLABLES.map(({ key, side }) => (
              <li key={`${key}-${side}`}>
                <KillTile
                  objective={key}
                  side={side}
                  state={objectiveState(events, key, side, time)}
                  time={time}
                  disabled={!match}
                  onKill={() => updateMatch((m, n) => (m ? recordKill(m, key, side, n) : m))}
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex min-h-14 items-center justify-between gap-3 border-t border-nuit-800 pt-2" aria-live="polite">
            <p className="text-sm text-craie-400">
              {lastKill
                ? t("pages.timerUI.lastKill", { objective: label(lastKill.key, lastKill.side), time: formatTime(lastKill.at) })
                : t(match ? "pages.timerUI.noKill" : "pages.timerUI.notStarted")}
            </p>
            {lastKill && (
              <button
                type="button"
                onClick={() => updateMatch((m) => (m ? undoLastKill(m) : m))}
                className={cn(button, "biseau-sm shrink-0 bg-nuit-800 text-craie-100 hover:bg-nuit-700")}
              >
                <Undo2 aria-hidden size={18} />
                {t("pages.timerUI.undo")}
              </button>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="timer-upcoming">
        <h2 id="timer-upcoming" className="font-titre text-2xl font-bold text-craie-100">
          {t("pages.timerUI.upcomingTitle")}
        </h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
        {!match && <p className="mt-3 text-sm text-craie-400">{t("pages.timerUI.upcomingPreview")}</p>}
        <ol className="mt-4 space-y-2">
          {next.map((e) => (
            <EventRow key={e.id} e={e} time={time} name={label(e.key, e.side)} />
          ))}
        </ol>
      </section>

      <section aria-labelledby="timer-settings">
        <h2 id="timer-settings" className="font-titre text-2xl font-bold text-craie-100">
          {t("pages.timerUI.settingsTitle")}
        </h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Toggle
            on={settings.vibration && vibrates}
            disabled={!vibrates}
            label={t("pages.timerUI.vibration")}
            detail={vibrates ? t("pages.timerUI.thresholds", { soon: SOON, urgent: URGENT }) : t("pages.timerUI.notSupported")}
            onChange={(on) => {
              updateSettings({ vibration: on });
              if (on) navigator.vibrate(60);
            }}
          />
          <Toggle
            on={settings.sound}
            label={t("pages.timerUI.sound")}
            detail={t("pages.timerUI.thresholds", { soon: SOON, urgent: URGENT })}
            onChange={(on) => {
              updateSettings({ sound: on });
              // This tap unlocks audio and plays a sample beep.
              if (on) beep(1);
            }}
          />
          <Toggle
            on={settings.wakeLock && wakeLockSupported}
            disabled={!wakeLockSupported}
            label={t("pages.timerUI.wakeLock")}
            detail={
              !wakeLockSupported
                ? t("pages.timerUI.notSupported")
                : settings.wakeLock && lock === "on"
                  ? t("pages.timerUI.wakeLockOn")
                  : settings.wakeLock && lock === "denied"
                    ? t("pages.timerUI.wakeLockDenied")
                    : t("pages.timerUI.wakeLockHint")
            }
            onChange={(on) => updateSettings({ wakeLock: on })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!match}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setConfirming(false);
              updateMatch(() => null);
            }}
            className={cn(
              button,
              "biseau-sm",
              confirming ? "bg-sang-500 text-nuit-950 hover:bg-sang-500/90" : "bg-nuit-800 text-craie-100 hover:bg-nuit-700",
            )}
          >
            <RotateCcw aria-hidden size={18} />
            {t(confirming ? "pages.timerUI.confirm" : "pages.timerUI.newMatch")}
          </button>
          <p className="text-xs text-craie-500">{t("pages.timerUI.kept")}</p>
        </div>
      </section>
    </div>
  );
}

function KillTile({
  objective,
  side,
  state,
  time,
  disabled,
  onKill,
}: {
  objective: KillableKey;
  side: Side | null;
  state: ObjectiveState;
  time: number;
  disabled: boolean;
  onKill: () => void;
}) {
  const t = useT();
  const left = state.state === "waiting" ? remaining(state.at, time) : null;
  const level = urgency(left);
  const gone = state.state === "gone";
  return (
    <button
      type="button"
      onClick={onKill}
      disabled={disabled || gone}
      className={cn(
        "flex min-h-[5.5rem] w-full items-center gap-2.5 rounded-sm border-2 px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-400 disabled:cursor-not-allowed sm:gap-3 sm:px-3",
        gone || disabled
          ? "border-nuit-800 bg-nuit-900/40 opacity-60"
          : state.state === "up"
            ? "border-azur-500/70 bg-azur-500/10 hover:bg-azur-500/20"
            : level === "urgent"
              ? "border-sang-500 bg-sang-500/15"
              : level === "soon"
                ? "border-or-500 bg-or-500/10"
                : "border-nuit-700 bg-nuit-900/70 hover:border-or-500/60",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local portrait, already small */}
      <img
        src={PORTRAITS[objective]}
        alt=""
        width={40}
        height={40}
        className="size-9 shrink-0 rounded-full border border-nuit-600 object-cover sm:size-10"
      />
      <span className="min-w-0 flex-1">
        <span className="sr-only">{t("pages.timerUI.record")} </span>
        <span className="block text-sm font-bold leading-tight text-craie-100 sm:text-base">
          {t(`pages.timerUI.name.${objective}`)}
        </span>
        {side && <span className="block text-xs text-craie-400">{t(`pages.timerUI.side.${side}`)}</span>}
        <span className="mt-0.5 block text-sm leading-tight" suppressHydrationWarning>
          {state.state === "waiting" && left !== null ? (
            <>
              <span
                className={cn(
                  "font-titre text-xl font-bold tabular-nums",
                  level === "urgent" ? "text-sang-500 motion-safe:animate-pulse" : level === "soon" ? "text-or-400" : "text-craie-100",
                )}
              >
                {formatTime(left)}
              </span>
              <span className="text-xs text-craie-500"> · {formatTime(state.at)}</span>
            </>
          ) : state.state === "up" ? (
            <span className="font-semibold text-azur-400">{t("pages.timerUI.up")}</span>
          ) : (
            <span className="text-craie-500">{t("pages.timerUI.noMoreTurtles")}</span>
          )}
        </span>
      </span>
    </button>
  );
}

function EventRow({ e, time, name }: { e: GameEvent; time: number; name: string }) {
  const t = useT();
  const milestone = e.kind === "milestone";
  // Inside a window (Lord at 8:00-9:00), the countdown switches to the latest time.
  const windowOpen = e.until !== null && time >= e.at && time < e.until;
  const spawned = time >= (e.until ?? e.at);
  const left = spawned ? 0 : remaining(windowOpen ? e.until! : e.at, time);
  const level = milestone || spawned ? "calm" : urgency(remaining(e.at, time));
  const when = e.until !== null ? `${formatTime(e.at)}–${formatTime(e.until)}` : formatTime(e.at);
  const range = { start: formatTime(e.at), end: formatTime(e.until ?? e.at) };
  const note = milestone ? t(`pages.timerUI.milestone.${e.key}`) : e.note ? t(`pages.timerUI.note.${e.note}`, range) : null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-l-4 px-3 py-2.5",
        milestone
          ? "border-nuit-600 bg-nuit-900/40"
          : spawned
            ? "border-azur-500 bg-azur-500/10"
            : level === "urgent"
              ? "border-sang-500 bg-sang-500/15"
              : level === "soon"
                ? "border-or-500 bg-or-500/10"
                : "border-nuit-700 bg-nuit-900/60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold leading-snug", milestone ? "text-craie-300" : "text-craie-100")}>{name}</p>
        {note && <p className="mt-0.5 text-xs leading-snug text-craie-400">{note}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "font-titre font-bold tabular-nums leading-none",
            milestone ? "text-xl text-craie-400" : "text-3xl",
            spawned
              ? "text-azur-400"
              : level === "urgent"
                ? "text-sang-500 motion-safe:animate-pulse"
                : level === "soon"
                  ? "text-or-400"
                  : !milestone && "text-craie-100",
          )}
          suppressHydrationWarning
        >
          {spawned ? t("pages.timerUI.up") : `${windowOpen ? "≤ " : ""}${formatTime(left)}`}
        </p>
        <p className="mt-1 text-xs tabular-nums text-craie-500">{t("pages.timerUI.at", { time: when })}</p>
      </div>
    </li>
  );
}

function Toggle({
  on,
  disabled = false,
  label,
  detail,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  detail: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-sm border border-nuit-700 bg-nuit-900/60 px-3 py-2 text-left transition-colors hover:border-or-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block font-semibold text-craie-100">{label}</span>
        <span className="block text-xs text-craie-500">{detail}</span>
      </span>
      <span aria-hidden className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-or-500" : "bg-nuit-700")}>
        <span className={cn("absolute top-1 size-5 rounded-full bg-craie-100 transition-transform", on ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  );
}
