"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, CalendarPlus, Check } from "lucide-react";
import { LOCALE_INTL } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import { trackEvent } from "@/lib/analytics";
import { browserSupport, cancelPushReminder, publicKey, remindByPush } from "@/lib/push-client";
import { SYNCED_EVENT } from "@/lib/progress-signal";
import { isReminded, monthStart, readReminders, writeReminder, type ReminderMemory } from "@/lib/reminders";
import { cn } from "@/lib/utils";

/**
 * "Remind me" for an upcoming month of skins and events.
 *
 * One tap: when this browser already allows notifications, a push reminder
 * is set; otherwise the tap opens a calendar file (`/api/calendar/<month>`),
 * the path that works on every phone, without permission or install. The
 * button then turns into a "you'll be reminded" state, with the other way
 * offered as a quiet second option. Without JavaScript, the link still
 * downloads the calendar file. Signed in, a reminder set on another device
 * shows here too (`synced`), with both ways offered for this one.
 */

type Push = "unknown" | "unavailable" | "ask" | "granted";

const primary =
  "bevel-sm inline-flex min-h-11 items-center justify-center gap-2 bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400";
const quiet = "font-semibold text-gold-400 underline-offset-4 hover:underline disabled:opacity-60";

export function RemindButton({ month, label, className }: { month: string; label: string; className?: string }) {
  const t = useT();
  const locale = useLocale();
  const [memory, setMemory] = useState<ReminderMemory>({});
  const [open, setOpen] = useState(true);
  const [push, setPush] = useState<Push>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState<string | null>(null);
  const start = monthStart(month);
  const href = `/api/calendar/${month}?lang=${locale}`;

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      if (!live) return;
      setMemory(readReminders()[month] ?? {});
      setOpen(start !== null && start > Date.now());
      // In the visitor's own time zone: only known once in the browser.
      if (start !== null) {
        setWhen(
          new Intl.DateTimeFormat(LOCALE_INTL[locale], {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          }).format(start),
        );
      }
    }, 0);
    // The account sync may bring a reminder set on another device after mounting.
    const reread = () => live && setMemory(readReminders()[month] ?? {});
    window.addEventListener(SYNCED_EVENT, reread);
    if (browserSupport() === "ok") {
      publicKey()
        .then((key) => {
          if (!live) return;
          setPush(!key ? "unavailable" : Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "unavailable" : "ask");
        })
        .catch(() => live && setPush("unavailable"));
    } else {
      Promise.resolve().then(() => live && setPush("unavailable"));
    }
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener(SYNCED_EVENT, reread);
    };
  }, [month, start, locale]);

  if (!open || start === null) return null;

  const remember = (next: ReminderMemory) => {
    writeReminder(month, next);
    setMemory(next);
  };

  const viaPush = async () => {
    setBusy(true);
    setError(null);
    try {
      const state = await remindByPush(locale, month);
      if (state === "active") {
        remember({ ...memory, push: true });
        setPush("granted");
        trackEvent("Reminder", "Notify", month);
      } else {
        setPush("unavailable");
        setError(t(state === "refused" ? "reminder.pushRefused" : "reminder.pushError"));
      }
    } catch {
      setError(t("reminder.pushError"));
    } finally {
      setBusy(false);
    }
  };

  const cancelPush = async () => {
    setBusy(true);
    try {
      await cancelPushReminder(month);
    } catch {
      /* the server forgets it after sending anyway */
    }
    remember({ ...memory, push: false });
    trackEvent("Reminder", "Cancel", month);
    setBusy(false);
  };

  const onCalendar = () => {
    remember({ ...memory, calendar: true });
    trackEvent("Reminder", "Calendar", month);
  };

  const reminded = isReminded(memory);
  const here = memory.calendar || memory.push;

  if (!reminded) {
    // A browser that already allows notifications gets the push reminder in one tap.
    if (push === "granted") {
      return (
        <div className={className}>
          <button type="button" onClick={viaPush} disabled={busy} aria-busy={busy} className={primary}>
            <Bell size={16} aria-hidden />
            {t("reminder.button")}
            <span className="sr-only"> · {label}</span>
          </button>
          {error && <p role="alert" className="mt-2 text-xs text-chalk-400">{error}</p>}
        </div>
      );
    }
    return (
      <div className={className}>
        <a href={href} onClick={onCalendar} className={primary}>
          <Bell size={16} aria-hidden />
          {t("reminder.button")}
          <span className="sr-only"> · {label}</span>
        </a>
        {when && <p className="mt-2 text-xs text-chalk-500">{t("reminder.hint", { when })}</p>}
      </div>
    );
  }

  return (
    <div className={cn("bevel-sm border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm", className)} role="status">
      <p className="flex items-center gap-2 font-semibold text-chalk-100">
        {memory.push ? <BellRing size={16} aria-hidden className="text-gold-400" /> : <Check size={16} aria-hidden className="text-gold-400" />}
        {t("reminder.set", { month: label })}
      </p>
      <p className="mt-1 text-xs text-chalk-400">
        {here
          ? t(memory.push && memory.calendar ? "reminder.setBoth" : memory.push ? "reminder.setPush" : "reminder.setCalendar", { when: when ?? "" })
          : t("accountSync.reminderElsewhere")}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {!memory.push && (push === "ask" || (!here && push === "granted")) && (
          <button type="button" onClick={viaPush} disabled={busy} aria-busy={busy} className={cn(quiet, "inline-flex items-center gap-1")}>
            <Bell size={12} aria-hidden />
            {t("reminder.alsoPush")}
          </button>
        )}
        {memory.push && (
          <button type="button" onClick={cancelPush} disabled={busy} aria-busy={busy} className={quiet}>
            {t("reminder.cancelPush")}
          </button>
        )}
        {!memory.calendar && (
          <a href={href} onClick={onCalendar} className={cn(quiet, "inline-flex items-center gap-1")}>
            <CalendarPlus size={12} aria-hidden />
            {t("reminder.alsoCalendar")}
          </a>
        )}
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-chalk-400">{error}</p>}
    </div>
  );
}
