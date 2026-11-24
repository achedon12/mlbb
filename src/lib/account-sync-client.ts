"use client";

import { trackEvent } from "./analytics";
import {
  cleanData,
  emptyData,
  KEY_ACCOUNT_SYNC,
  readSyncMeta,
  reconcile,
  sameData,
  type RemoteSync,
  type SyncData,
  type SyncMeta,
} from "./account-sync";
import { heroesBySlug } from "./data-client";
import { readFavourites, writeFavourites } from "./favourites";
import * as dle from "./mlbbdle-storage";
import { isQuiet, PROGRESS_EVENT, quietly, SYNCED_EVENT } from "./progress-signal";
import * as quiz from "./quiz-storage";
import { isReminded, readReminders, writeReminder } from "./reminders";

/**
 * Browser side of the progress sync. The progress lives in `localStorage` as
 * before, and every page keeps reading and writing it there; signed in, this
 * module also keeps it on the account:
 * - when a page opens, the account copy is read and reconciled with the
 *   browser's (`reconcile`): the first time, both are merged and nothing is
 *   lost; then three ways, from the copy both last agreed on;
 * - every local change (a favourite, a solved MLBBdle, a finished quiz, a
 *   reminder) is sent a moment later, debounced;
 * - a refusal because the account copy moved on (another device) merges and
 *   sends again; a network failure retries with a growing delay. Local
 *   changes are whatever differs from the agreed copy, so a change made
 *   offline is sent at the next visit.
 * Signed out, or on a site without a database, nothing is sent and nothing
 * changes: the browser copy is all there is, as it always was.
 */

export type SyncStatus =
  /** Not known yet. */
  | "checking"
  /** The site keeps no account copies. */
  | "unavailable"
  | "signedOut"
  | "saving"
  | "saved"
  /** The account did not answer: kept here, retried. */
  | "retrying"
  /** Signed in, but the player deleted the account copy: this browser keeps its own and sends nothing until turned back on. */
  | "paused";

export interface SyncState {
  status: SyncStatus;
  /** Time of the last agreement with the account. */
  syncedAt: number | null;
}

let state: SyncState = { status: "checking", syncedAt: null };
const listeners = new Set<() => void>();

function set(next: Partial<SyncState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export const syncState = () => state;
const SERVER_STATE: SyncState = { status: "checking", syncedAt: null };
export const serverSyncState = () => SERVER_STATE;
export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Browser copy ───────────────────────────────────────────────────

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage refused: the sync starts over next visit */
  }
}

const listed = (favourites: unknown) => (Array.isArray(favourites) ? favourites : []).filter((s): s is string => typeof s === "string" && s in heroesBySlug);
const unlistedFavourites = () => {
  const all: unknown = readFavourites();
  return (Array.isArray(all) ? all : []).filter((s): s is string => typeof s === "string" && !(s in heroesBySlug));
};

/** The progress as this browser holds it, cleaned like the server cleans it. */
export function readLocalProgress(now = Date.now()): SyncData {
  const reminders = Object.entries(readReminders())
    .filter(([, m]) => isReminded(m))
    .map(([month]) => month);
  return cleanData(
    {
      // Heroes the site no longer lists are left out of the sync (the server would drop them anyway).
      favourites: listed(readFavourites()),
      quiz: { daily: quiz.readStats(), practice: quiz.readPractice() },
      mlbbdle: { classic: dle.readStats("classic"), skill: dle.readStats("skill"), practice: dle.readPractice() },
      reminders,
    },
    now,
  );
}

/**
 * Writes what the account brought into this browser, only where it differs,
 * without telling the sync (it is not a change to send back). A favourite
 * the browser holds that the sync left out (a hero no longer listed) stays.
 */
function writeLocalProgress(next: SyncData, previous: SyncData) {
  quietly(() => {
    if (next.favourites.join() !== previous.favourites.join()) {
      writeFavourites([...next.favourites, ...unlistedFavourites()]);
    }
    quiz.writeStats(next.quiz.daily);
    quiz.writePractice(next.quiz.practice);
    dle.writeStats("classic", next.mlbbdle.classic);
    dle.writeStats("skill", next.mlbbdle.skill);
    dle.writePractice(next.mlbbdle.practice);
    const memory = readReminders();
    for (const month of next.reminders) {
      if (!isReminded(memory[month])) writeReminder(month, { ...memory[month], synced: true });
    }
  });
  window.dispatchEvent(new CustomEvent(SYNCED_EVENT));
}

const writeMeta = (meta: SyncMeta | null) => storageSet(KEY_ACCOUNT_SYNC, meta ? JSON.stringify(meta) : null);

/** Set when the account copy was deleted: the account key it was deleted for. */
const KEY_SYNC_OFF = "mlbbdex:account-sync-off";

// ── Account copy ───────────────────────────────────────────────────

type Fetched =
  | { kind: "unavailable" }
  | { kind: "signedOut" }
  | { kind: "failed" }
  | { kind: "connected"; account: string; remote: RemoteSync | null };

const readRemote = (x: unknown): RemoteSync | null => {
  if (!x || typeof x !== "object") return null;
  const v = x as { data?: unknown; updatedAt?: unknown };
  return typeof v.updatedAt === "string" ? { data: cleanData(v.data), updatedAt: v.updatedAt } : null;
};

async function fetchAccount(): Promise<Fetched> {
  try {
    const r = await fetch("/api/account/sync", { cache: "no-store", credentials: "same-origin" });
    if (r.status === 403) return { kind: "unavailable" };
    if (!r.ok) return { kind: "failed" };
    const body = (await r.json()) as { available?: boolean; connected?: boolean; account?: unknown; sync?: unknown };
    if (!body.available) return { kind: "unavailable" };
    if (!body.connected || typeof body.account !== "string") return { kind: "signedOut" };
    return { kind: "connected", account: body.account, remote: readRemote(body.sync) };
  } catch {
    return { kind: "failed" };
  }
}

type Put = { kind: "saved"; remote: RemoteSync } | { kind: "conflict"; remote: RemoteSync | null } | { kind: "failed" } | { kind: "gone" };

async function putAccount(data: SyncData, base: string | null): Promise<Put> {
  try {
    const r = await fetch("/api/account/sync", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data, base }),
    });
    if (r.status === 401 || r.status === 403 || r.status === 404) return { kind: "gone" };
    if (r.status === 409) return { kind: "conflict", remote: readRemote(((await r.json()) as { sync?: unknown }).sync) };
    if (!r.ok) return { kind: "failed" };
    const remote = readRemote(((await r.json()) as { sync?: unknown }).sync);
    return remote ? { kind: "saved", remote } : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

// ── The loop ───────────────────────────────────────────────────────

const DEBOUNCE_MS = 2000;
const RETRY_MIN_MS = 4000;
const RETRY_MAX_MS = 120_000;
const MAX_CONFLICTS = 3;

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = RETRY_MIN_MS;
let connected = false;

function schedule(delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** One round: read the account copy, reconcile, write here, send there. */
async function round(): Promise<void> {
  const fetched = await fetchAccount();
  if (fetched.kind === "unavailable" || fetched.kind === "signedOut") {
    connected = false;
    set({ status: fetched.kind });
    return;
  }
  if (fetched.kind === "failed") {
    if (connected) {
      set({ status: "retrying" });
      schedule(retryDelay);
      retryDelay = Math.min(RETRY_MAX_MS, retryDelay * 2);
    } else {
      // Not known whether signed in: no prompt to sign in on a guess.
      set({ status: "unavailable" });
    }
    return;
  }
  connected = true;
  const { account } = fetched;
  if (storageGet(KEY_SYNC_OFF) === account) {
    set({ status: "paused" });
    return;
  }
  let remote = fetched.remote;
  for (let attempt = 0; attempt <= MAX_CONFLICTS; attempt++) {
    const local = readLocalProgress();
    const meta = readSyncMeta(storageGet(KEY_ACCOUNT_SYNC));
    const r = reconcile(local, meta, remote, account);
    if (r.deleted) {
      writeMeta(null);
      storageSet(KEY_SYNC_OFF, account);
      set({ status: "paused" });
      return;
    }
    if (!sameData(r.result, local)) writeLocalProgress(r.result, local);
    if (r.firstMerge && !sameData(local, emptyData())) trackEvent("Account", "Sync merged", remote ? "both" : "browser");
    if (!r.upload) {
      writeMeta({ account, updatedAt: remote?.updatedAt ?? null, base: r.result });
      retryDelay = RETRY_MIN_MS;
      set({ status: "saved", syncedAt: Date.now() });
      return;
    }
    set({ status: "saving" });
    const put = await putAccount(r.result, remote?.updatedAt ?? null);
    if (put.kind === "saved") {
      // What the server kept is the agreed copy (it may have dropped an entry it does not know).
      const now = readLocalProgress();
      if (!sameData(put.remote.data, r.result) && sameData(now, r.result)) writeLocalProgress(put.remote.data, now);
      writeMeta({ account, updatedAt: put.remote.updatedAt, base: put.remote.data });
      retryDelay = RETRY_MIN_MS;
      set({ status: "saved", syncedAt: Date.now() });
      return;
    }
    if (put.kind === "conflict") {
      remote = put.remote;
      continue;
    }
    if (put.kind === "gone") {
      connected = false;
      set({ status: "signedOut" });
      return;
    }
    set({ status: "retrying" });
    schedule(retryDelay);
    retryDelay = Math.min(RETRY_MAX_MS, retryDelay * 2);
    return;
  }
  set({ status: "retrying" });
  schedule(retryDelay);
}

/** Runs a sync round now (or right after the one running). */
export function syncNow(): Promise<void> {
  clearTimeout(timer);
  if (running) {
    again = true;
    return running;
  }
  running = round()
    .catch(() => set({ status: connected ? "retrying" : "unavailable" }))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    });
  return running;
}

let started = false;

/** Starts the sync for this page: once, from the layout. */
export function startAccountSync(): () => void {
  if (started) return () => {};
  started = true;
  const onChange = () => {
    if (connected && !isQuiet()) schedule(DEBOUNCE_MS);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible" && connected && Date.now() - (state.syncedAt ?? 0) > 60_000) void syncNow();
  };
  window.addEventListener(PROGRESS_EVENT, onChange);
  window.addEventListener("mlbb:favoris", onChange);
  document.addEventListener("visibilitychange", onVisible);
  void syncNow();
  return () => {
    started = false;
    clearTimeout(timer);
    window.removeEventListener(PROGRESS_EVENT, onChange);
    window.removeEventListener("mlbb:favoris", onChange);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/**
 * Removes the account's copy (and its public page). Every browser keeps its
 * own progress and stops sending it (each one sees the copy it agreed on is
 * gone), until the player turns the sync back on (`resumeAccountSync`).
 */
export async function deleteAccountCopy(): Promise<boolean> {
  try {
    // The account key this browser must stop sending to.
    const fetched = await fetchAccount();
    if (fetched.kind !== "connected") return false;
    const r = await fetch("/api/account/sync", { method: "DELETE", credentials: "same-origin" });
    if (!r.ok) return false;
    clearTimeout(timer);
    writeMeta(null);
    storageSet(KEY_SYNC_OFF, fetched.account);
    set({ status: "paused" });
    return true;
  } catch {
    return false;
  }
}

/** Turns the sync back on in this browser: its progress starts the account copy again. */
export function resumeAccountSync(): Promise<void> {
  storageSet(KEY_SYNC_OFF, null);
  return syncNow();
}
