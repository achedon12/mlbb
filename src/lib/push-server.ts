import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import webpush from "web-push";
import { LOCALES, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data-client";
import { log, logError } from "@/lib/log";
import {
  MAX_SUBSCRIBERS,
  compareVersions,
  buildMessage,
  recipients,
  type Subscriber,
  type StoredSubscription,
  type PushMessage,
  type AdjustedPatch,
} from "@/lib/push";

/**
 * Patch notifications: subscription storage and sending.
 *
 * The site has no database: subscriptions live in a JSON file in the
 * `DATA_DIR` folder, fully rewritten on every change — temporary file then
 * rename, so that a hard stop never leaves a half-written file. Writes go
 * one after another through a queue, the server being a single process.
 *
 * The last notified patch is kept alongside: a restart never resends the
 * notifications of an already announced patch.
 */

// ── Configuration ──────────────────────────────────────────────────

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let configWarned = false;

/**
 * VAPID keys read from the environment, at runtime: the image does not need
 * to know them at build time. Without them, the feature is simply absent.
 */
export function configPush(): PushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (!publicKey && !privateKey && !subject) return null;
  const valid =
    /^[A-Za-z0-9_-]{80,100}$/.test(publicKey) && /^[A-Za-z0-9_-]{40,50}$/.test(privateKey) && /^(mailto:|https:\/\/)/.test(subject);
  if (!valid) {
    if (!configWarned) {
      configWarned = true;
      void log("warning", "notifications: VAPID keys incomplete or malformed, feature disabled");
    }
    return null;
  }
  return { publicKey, privateKey, subject };
}

// DONNEES_DIR is the former name of DATA_DIR, still read as a fallback: the
// production server may still set only the old name.
const folder = () => (process.env.DATA_DIR ?? process.env.DONNEES_DIR)?.trim() || "donnees-serveur";
const fileSubscribers = () => join(folder(), "push-abonnements.json");
const fileState = () => join(folder(), "push-etat.json");

// ── Files ──────────────────────────────────────────────────────────

export class ErrorStorage extends Error {}

async function readJson<T>(filePath: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new ErrorStorage(`cannot read: ${filePath}`, { cause: error });
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    // Never start over from scratch: the next write would erase everything.
    throw new ErrorStorage(`unreadable file: ${filePath}`, { cause: error });
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(folder(), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data) + "\n", { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw new ErrorStorage(`cannot write: ${filePath}`, { cause: error });
  }
}

/** Queue: one read-modify-write at a time. */
let queue: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

interface Registry {
  abonnes: Subscriber[];
}

async function readSubscribers(): Promise<Subscriber[]> {
  const registry = await readJson<Registry>(fileSubscribers());
  return Array.isArray(registry?.abonnes) ? registry.abonnes : [];
}

function editSubscribers<R>(edit: (subscribers: Subscriber[]) => { subscribers: Subscriber[] | null; result: R }): Promise<R> {
  return serially(async () => {
    const { subscribers, result } = edit(await readSubscribers());
    if (subscribers) await writeJson(fileSubscribers(), { abonnes: subscribers } satisfies Registry);
    return result;
  });
}

export interface PushState {
  dernierPatch: string;
  date: string;
}

const readState = () => readJson<PushState>(fileState()).catch(() => null);
const writeState = (version: string) =>
  writeJson(fileState(), { dernierPatch: version, date: new Date().toISOString() } satisfies PushState);

// ── Subscriptions ──────────────────────────────────────────────────

/**
 * Constant-time comparison: a subscription's `auth` secret (proof of
 * possession) or the admin route token.
 */
export function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const matches = (subscriber: Subscriber, subscription: StoredSubscription) =>
  subscriber.endpoint === subscription.endpoint && sameSecret(subscriber.cles.auth, subscription.cles.auth);

/** Creates or replaces this browser's subscription. */
export function saveSubscriber(
  subscription: StoredSubscription,
  locale: Locale,
  favourites: string[],
): Promise<"created" | "replaced" | "full"> {
  return editSubscribers((subscribers) => {
    const now = new Date().toISOString();
    const existing = subscribers.find((a) => a.endpoint === subscription.endpoint);
    if (!existing && subscribers.length >= MAX_SUBSCRIBERS) return { subscribers: null, result: "full" as const };
    const entry: Subscriber = { ...subscription, langue: locale, favoris: favourites, cree: existing?.cree ?? now, maj: now };
    const others = subscribers.filter((a) => a.endpoint !== subscription.endpoint);
    return { subscribers: [...others, entry], result: existing ? ("replaced" as const) : ("created" as const) };
  });
}

/** Updates the favourites (and language) of a known subscription. */
export function updateSubscriber(
  subscription: StoredSubscription,
  favourites: string[],
  locale: Locale | null,
): Promise<"ok" | "unknown"> {
  return editSubscribers((subscribers) => {
    const existing = subscribers.find((a) => matches(a, subscription));
    if (!existing) return { subscribers: null, result: "unknown" as const };
    const unchanged = existing.favoris.join() === favourites.join() && (!locale || locale === existing.langue);
    if (unchanged) return { subscribers: null, result: "ok" as const };
    const maj: Subscriber = { ...existing, favoris: favourites, langue: locale ?? existing.langue, maj: new Date().toISOString() };
    return { subscribers: subscribers.map((a) => (a === existing ? maj : a)), result: "ok" as const };
  });
}

export function deleteSubscriber(subscription: StoredSubscription): Promise<"ok" | "unknown"> {
  return editSubscribers((subscribers) => {
    const remaining = subscribers.filter((a) => !matches(a, subscription));
    return remaining.length === subscribers.length
      ? { subscribers: null, result: "unknown" as const }
      : { subscribers: remaining, result: "ok" as const };
  });
}

/** Short, stable subscriber ID for summaries: the address never appears in them. */
export const idSubscriber = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 12);

// ── Rate limiting ──────────────────────────────────────────────────

/** Fixed window per address, as for the client log. */
export function limitByMinute(maximum: number): (address: string) => boolean {
  const tracked = new Map<string, { start: number; count: number }>();
  return (address) => {
    const now = Date.now();
    const tracking = tracked.get(address);
    if (!tracking || now - tracking.start > 60_000) {
      if (tracked.size > 5_000) tracked.clear();
      tracked.set(address, { start: now, count: 1 });
      return true;
    }
    tracking.count += 1;
    return tracking.count <= maximum;
  };
}

export const addressOf = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

// ── Sending ────────────────────────────────────────────────────────

/** Send error: `statusCode` is the push service's. */
export type Sender = (subscription: StoredSubscription, load: string, topic: string) => Promise<void>;

function senderWebPush(config: PushConfig): Sender {
  return async (subscription, load, topic) => {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.cles },
      load,
      {
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
        // A patch stays news for a few days: past that, no point delivering it.
        TTL: 4 * 24 * 3600,
        urgency: "normal",
        topic,
        timeout: 10_000,
      },
    );
  };
}

export interface SendPreview extends PushMessage {
  id: string;
  heroes: string[];
}

export interface BroadcastSummary {
  version: string;
  simulation: boolean;
  subscribers: number;
  recipients: number;
  byLocale: Partial<Record<Locale, number>>;
  /** A few written messages, to check the rendering before sending. */
  previews: SendPreview[];
  sent: number;
  failed: number;
  removed: number;
}

const BY_BATCH = 10;

/**
 * Prepares, and sends if `send`, the notification of each subscriber affected
 * by the patch. Subscriptions the service reports as gone (404, 410) are
 * deleted. `target` restricts sending to one subscriber, for a test.
 */
export async function broadcast(
  patch: AdjustedPatch,
  options: { send: boolean; target?: string; sender?: Sender; maxPreviews?: number },
): Promise<BroadcastSummary> {
  const subscribers = await serially(readSubscribers);
  const sends = recipients(subscribers, patch).filter((e) => !options.target || idSubscriber(e.subscriber.endpoint) === options.target);
  const messages = sends.map((e) => ({
    send: e,
    message: buildMessage(createT(e.subscriber.langue), e.subscriber.langue, patch.version, e.keys, heroesBySlug),
  }));

  const byLocale: Partial<Record<Locale, number>> = {};
  for (const e of sends) byLocale[e.subscriber.langue] = (byLocale[e.subscriber.langue] ?? 0) + 1;
  const summary: BroadcastSummary = {
    version: patch.version,
    simulation: !options.send,
    subscribers: subscribers.length,
    recipients: sends.length,
    byLocale: Object.fromEntries(LOCALES.filter((l) => byLocale[l]).map((l) => [l, byLocale[l]])),
    previews: messages.slice(0, options.maxPreviews ?? 5).map(({ send, message }) => ({
      id: idSubscriber(send.subscriber.endpoint),
      heroes: send.keys.map((h) => h.slug),
      ...message,
    })),
    sent: 0,
    failed: 0,
    removed: 0,
  };
  if (!options.send || messages.length === 0) return summary;

  const config = configPush();
  const sender = options.sender ?? (config ? senderWebPush(config) : null);
  if (!sender) throw new Error("notifications: VAPID keys missing");

  const topic = `patch-${patch.version.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 32);
  const gone: StoredSubscription[] = [];
  for (let i = 0; i < messages.length; i += BY_BATCH) {
    const batch = messages.slice(i, i + BY_BATCH);
    const results = await Promise.allSettled(
      batch.map(({ send, message }) => sender(send.subscriber, JSON.stringify(message), topic)),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") {
        summary.sent += 1;
        return;
      }
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        gone.push(batch[j].send.subscriber);
      } else {
        summary.failed += 1;
        void log("warning", "notification not delivered", {
          version: patch.version,
          status: status ?? null,
          service: new URL(batch[j].send.subscriber.endpoint).hostname,
          error: r.reason instanceof Error ? r.reason.message.slice(0, 200) : String(r.reason).slice(0, 200),
        });
      }
    });
  }

  if (gone.length) {
    summary.removed = await editSubscribers((list) => {
      const remaining = list.filter((a) => !gone.some((d) => matches(a, d)));
      return { subscribers: remaining, result: list.length - remaining.length };
    });
  }
  await log("info", "patch notifications", {
    version: patch.version,
    recipients: summary.recipients,
    sent: summary.sent,
    failed: summary.failed,
    removed: summary.removed,
    target: options.target ?? null,
  });
  return summary;
}

export type StartupOutcome =
  | { action: "recorded"; version: string }
  | { action: "already-notified"; version: string }
  | { action: "older"; version: string; lastNotified: string }
  | { action: "sent"; summary: BroadcastSummary };

/**
 * Called on every startup with the latest patch known to the data.
 *
 * - First run (no state): the patch is recorded without sending anything —
 *   subscribers need not be told about an already old patch.
 * - Patch already notified, or older than the last notified one: nothing.
 * - Newer patch: the state is written BEFORE sending. A stop mid-send loses
 *   a few notifications, never duplicates them.
 */
export function notifyNewPatch(patch: AdjustedPatch, sender?: Sender): Promise<StartupOutcome> {
  return serialState(async () => {
    const state = await readState();
    if (!state?.dernierPatch) {
      await writeState(patch.version);
      await log("info", "notifications: first startup, patch recorded without sending", { version: patch.version });
      return { action: "recorded", version: patch.version };
    }
    if (state.dernierPatch === patch.version) return { action: "already-notified", version: patch.version };
    if (compareVersions(patch.version, state.dernierPatch) < 0) {
      return { action: "older", version: patch.version, lastNotified: state.dernierPatch };
    }
    await writeState(patch.version);
    return { action: "sent", summary: await broadcast(patch, { send: true, sender }) };
  });
}

export type ManualOutcome =
  | { action: "simulation"; summary: BroadcastSummary; lastNotified: string | null }
  | { action: "refused"; reason: "already-notified"; lastNotified: string }
  | { action: "sent"; summary: BroadcastSummary; lastNotified: string | null };

/**
 * Manual trigger (protected route). A dry run by default. A targeted send
 * (a single subscriber) is a test and leaves the state alone; a send to all
 * refuses an already notified patch, unless `force`, and records it otherwise.
 */
export function triggerManually(
  patch: AdjustedPatch,
  options: { send: boolean; target?: string; force?: boolean; sender?: Sender },
): Promise<ManualOutcome> {
  return serialState(async () => {
    const state = await readState();
    const lastNotified = state?.dernierPatch ?? null;
    if (!options.send) {
      return { action: "simulation", summary: await broadcast(patch, { send: false, target: options.target, maxPreviews: 20 }), lastNotified };
    }
    if (!options.target) {
      if (lastNotified === patch.version && !options.force) {
        return { action: "refused", reason: "already-notified", lastNotified };
      }
      if (!lastNotified || compareVersions(patch.version, lastNotified) > 0) await writeState(patch.version);
    }
    const summary = await broadcast(patch, { send: true, target: options.target, sender: options.sender });
    return { action: "sent", summary, lastNotified };
  });
}

/** State decisions never overlap (startup and manual route). */
let queueState: Promise<unknown> = Promise.resolve();
function serialState<T>(task: () => Promise<T>): Promise<T> {
  const run = queueState.then(task, task);
  queueState = run.catch(() => {});
  return run;
}

/** Startup entry point: never throws, logs everything. */
export async function notifyOnStartup(patch: AdjustedPatch | undefined): Promise<void> {
  if (!patch || !configPush()) return;
  try {
    const issue = await notifyNewPatch(patch);
    if (issue.action === "older") {
      await log("warning", "notifications: data patch older than the last notified one", issue);
    }
  } catch (error) {
    await logError("notifications: startup failure", error, { version: patch.version });
  }
}
