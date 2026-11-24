import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { log, logError } from "@/lib/log";
import { reminderText } from "@/lib/reminder-text";
import type { PushMessage, StoredSubscription } from "@/lib/push";
import {
  configPush,
  pushDataFile,
  readJson,
  sameSecret,
  senderWebPush,
  serially,
  writeJson,
  type Sender,
} from "@/lib/push-server";
import { MAX_REMINDERS_BY_BROWSER, isRemindable, sortDue } from "@/lib/reminders";

/**
 * Month reminders by push notification: storage, wording and the clock that
 * sends them once a month opens.
 *
 * Separate from the patch subscribers: a visitor can ask to be told when
 * December opens without subscribing to patch news. Same folder, same
 * write-then-rename files and same queue as `push-server.ts`.
 */

/** Cap on stored reminders, so a script cannot fill the disk. */
export const MAX_REMINDERS = 100_000;
/** How often the clock looks for due reminders. */
const TICK_MS = 10 * 60_000;

export interface StoredReminder extends StoredSubscription {
  langue: Locale;
  /** "2026-12". */
  mois: string;
  cree: string;
}

const file = () => pushDataFile("push-rappels.json");

async function readAll(): Promise<StoredReminder[]> {
  const stored = await readJson<{ rappels?: StoredReminder[] }>(file());
  return Array.isArray(stored?.rappels) ? stored.rappels : [];
}

function edit<R>(change: (list: StoredReminder[]) => { list: StoredReminder[] | null; result: R }): Promise<R> {
  return serially(async () => {
    const { list, result } = change(await readAll());
    if (list) await writeJson(file(), { rappels: list });
    return result;
  });
}

const sameBrowser = (r: StoredReminder, s: StoredSubscription) => r.endpoint === s.endpoint && sameSecret(r.cles.auth, s.cles.auth);

export function saveReminder(
  subscription: StoredSubscription,
  locale: Locale,
  month: string,
  now = Date.now(),
): Promise<"created" | "exists" | "full" | "past"> {
  if (!isRemindable(month, now)) return Promise.resolve("past");
  return edit((list) => {
    const mine = list.filter((r) => sameBrowser(r, subscription));
    if (mine.some((r) => r.mois === month)) return { list: null, result: "exists" as const };
    if (mine.length >= MAX_REMINDERS_BY_BROWSER || list.length >= MAX_REMINDERS) return { list: null, result: "full" as const };
    const entry: StoredReminder = { ...subscription, langue: locale, mois: month, cree: new Date(now).toISOString() };
    return { list: [...list, entry], result: "created" as const };
  });
}

export function deleteReminder(subscription: StoredSubscription, month: string): Promise<void> {
  return edit((list) => {
    const remaining = list.filter((r) => !(r.mois === month && sameBrowser(r, subscription)));
    return { list: remaining.length === list.length ? null : remaining, result: undefined };
  });
}

// ── Wording ────────────────────────────────────────────────────────

export function reminderMessage(locale: Locale, month: string): PushMessage {
  const { title, body } = reminderText(createT(locale), locale, month);
  return { titre: title, corps: body, url: `/${locale}/events/${month}`, tag: `month-${month}`, langue: locale };
}

// ── Sending ────────────────────────────────────────────────────────

/**
 * Sends the reminders whose month has opened, then forgets them, sent or
 * not: a reminder is a one-off. Those found too late are dropped unsent.
 */
export async function sendDueReminders(now = Date.now(), sender?: Sender): Promise<{ sent: number; failed: number; dropped: number }> {
  const all = await serially(readAll);
  const { due, stale } = sortDue(all, now);
  const outcome = { sent: 0, failed: 0, dropped: stale.length };
  if (due.length === 0 && stale.length === 0) return outcome;

  const config = configPush();
  const send = sender ?? (config ? senderWebPush(config) : null);
  if (send) {
    for (let i = 0; i < due.length; i += 10) {
      const batch = due.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map((r) => send(r, JSON.stringify(reminderMessage(r.langue, r.mois)), `month-${r.mois}`)),
      );
      for (const r of results) outcome[r.status === "fulfilled" ? "sent" : "failed"] += 1;
    }
  }
  // The file is read again under the queue: match by browser and month, not by object.
  const key = (r: StoredReminder) => `${r.endpoint}|${r.mois}`;
  const done = new Set([...due, ...stale].map(key));
  await edit((list) => ({ list: list.filter((r) => !done.has(key(r))), result: undefined }));
  if (due.length) await log("info", "month reminders", outcome);
  return outcome;
}

let clock: ReturnType<typeof setInterval> | undefined;

/** Starts the reminder clock once per process; never throws. */
export function startReminderClock(): void {
  if (clock || !configPush()) return;
  const tick = () =>
    void sendDueReminders().catch((error) => logError("notifications: month reminders failed", error));
  clock = setInterval(tick, TICK_MS);
  clock.unref?.();
  tick();
}
