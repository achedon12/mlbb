"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KEY_COLLECTION, readOwnership, skinsCollectible, writeOwnership, type Ownership, type StoredOwnership } from "./collection";
import {
  KEY_COLLECTION_SYNC,
  keepKnown,
  mergeOwnership,
  readSyncMeta,
  reconcile,
  sameOwnership,
  type RemoteCollection,
  type SyncMeta,
} from "./collection-sync";
import type { Catalog } from "./skin-catalog";

/**
 * Browser side of the account sync: the collection lives in `localStorage`
 * as before, and, signed in, every change is also sent to the account.
 *
 * Writes are whole sets, debounced, based on the version last agreed with
 * the server. A refusal because the account copy moved on (another device)
 * merges and sends again; a network failure or an outage retries with a
 * growing delay, and the `pending` flag kept in storage makes the queue
 * survive a reload or a night offline: the next visit sends it.
 */

export type SyncStatus =
  /** Reading the account copy. */
  | "checking"
  /** The site keeps no account copies: this browser only. */
  | "browser"
  /** Signed out: this browser only, signing in would sync. */
  | "signedOut"
  | "saving"
  | "saved"
  /** Not sent yet, waiting for the connection to come back. */
  | "offline"
  /** The service did not answer: kept here, retried. */
  | "retrying"
  /** The account refused the save for good: kept in this browser only. */
  | "failed";

export type SyncNotice = null | "merged" | "elsewhere";

/** Statuses in which the account answered as signed in. */
const SIGNED_IN: readonly SyncStatus[] = ["saving", "saved", "offline", "retrying", "failed"];

const DEBOUNCE_MS = 1500;
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 60_000;
/** Coming back to the tab rereads the account copy, at most this often. */
const REFRESH_MS = 30_000;

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage refused (strict private browsing): the collection lasts for the visit.
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Same: nothing kept, the page still works.
  }
}

const toStored = (o: Ownership): StoredOwnership => ({ heros: [...o.heros].sort(), skins: [...o.skins].sort() });
const toOwnership = (o: StoredOwnership): Ownership => ({ heros: new Set(o.heros), skins: new Set(o.skins) });

type Fetched =
  | { kind: "browser" }
  | { kind: "signedOut" }
  | { kind: "failed" }
  | { kind: "connected"; account: string; remote: RemoteCollection | null };

const readRemote = (c: unknown): RemoteCollection | null => {
  if (!c || typeof c !== "object") return null;
  const v = c as { heroes?: unknown; skins?: unknown; updatedAt?: unknown };
  if (!Array.isArray(v.heroes) || !Array.isArray(v.skins) || typeof v.updatedAt !== "string") return null;
  return { heros: v.heroes.filter((x) => typeof x === "string"), skins: v.skins.filter((x) => typeof x === "string"), updatedAt: v.updatedAt };
};

async function fetchAccount(): Promise<Fetched> {
  try {
    const r = await fetch("/api/collection", { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return { kind: "failed" };
    const body = (await r.json()) as { available?: boolean; connected?: boolean; account?: unknown; collection?: unknown };
    if (!body.available) return { kind: "browser" };
    if (!body.connected || typeof body.account !== "string") return { kind: "signedOut" };
    return { kind: "connected", account: body.account, remote: readRemote(body.collection) };
  } catch {
    return { kind: "failed" };
  }
}

/**
 * The collection a reader should use, for a page that only reads it (the
 * account value estimator): the browser copy, reconciled with the account
 * copy when signed in, as the collection tool would show it. Writes nothing.
 */
export async function readSyncedCollection(): Promise<StoredOwnership> {
  const local = readOwnership(storageGet(KEY_COLLECTION));
  const account = await fetchAccount();
  if (account.kind !== "connected") return local;
  return reconcile(local, readSyncMeta(storageGet(KEY_COLLECTION_SYNC)), account.remote, account.account).result;
}

/**
 * State of the collection tool: the owned heroes and skins (null until the
 * catalogue and the save are read), the setter for the player's changes,
 * and where the collection is saved.
 */
export function useCollectionSync(catalog: Catalog | null) {
  const [owned, setOwned] = useState<Ownership | null>(null);
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [notice, setNotice] = useState<SyncNotice>(null);

  const current = useRef<Ownership | null>(null);
  const meta = useRef<SyncMeta | null>(null);
  const account = useRef<string | null>(null);
  const known = useRef<{ heroes: Set<string>; skins: Set<string> } | null>(null);
  /** The next state change comes from the player, not from the server. */
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retries = useRef(0);
  const inFlight = useRef(false);
  const lastRead = useRef(0);
  // The timers call the latest callbacks through these, not the ones they were scheduled from.
  const syncAgain = useRef<() => void>(() => {});
  const pushAgain = useRef<() => void>(() => {});

  const saveMeta = (m: SyncMeta | null) => {
    meta.current = m;
    if (m) storageSet(KEY_COLLECTION_SYNC, JSON.stringify(m));
  };

  const apply = useCallback((o: StoredOwnership) => {
    const next = toOwnership(o);
    current.current = next;
    setOwned(next);
  }, []);

  const push = useCallback(async () => {
    clearTimeout(timer.current);
    if (inFlight.current || !account.current || !meta.current || !current.current || !known.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("offline");
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    const sent = keepKnown(toStored(current.current), known.current.heroes, known.current.skins);
    let response: Response | null = null;
    try {
      response = await fetch("/api/collection", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heroes: sent.heros, skins: sent.skins, base: meta.current.updatedAt }),
      });
    } catch {
      response = null;
    }
    inFlight.current = false;
    const m = meta.current;
    if (!m) return;

    if (response?.ok || response?.status === 409) {
      const body = (await response.json().catch(() => ({}))) as { collection?: unknown };
      const remote = readRemote(body.collection);
      retries.current = 0;
      if (response.ok && remote) {
        const changedSince = !sameOwnership(toStored(current.current!), sent);
        saveMeta({ ...m, updatedAt: remote.updatedAt, base: { heros: remote.heros, skins: remote.skins }, pending: changedSince });
        if (changedSince) timer.current = setTimeout(() => pushAgain.current(), DEBOUNCE_MS);
        else setStatus("saved");
        return;
      }
      // Conflict: the account copy moved on elsewhere. Merge from the last agreed version, and send again.
      const remoteSet = remote ? { heros: remote.heros, skins: remote.skins } : { heros: [], skins: [] };
      const local = toStored(current.current!);
      const merged = remote ? mergeOwnership(m.base, local, remoteSet) : local;
      if (!sameOwnership(merged, local)) {
        apply(merged);
        setNotice("elsewhere");
      }
      const again = !sameOwnership(merged, remoteSet) || !remote;
      saveMeta({ ...m, updatedAt: remote?.updatedAt ?? null, base: remoteSet, pending: again });
      if (again) timer.current = setTimeout(() => pushAgain.current(), 0);
      else setStatus("saved");
      return;
    }
    if (response?.status === 401) {
      // Signed out meanwhile: the changes wait, flagged, for the next sign-in.
      account.current = null;
      setStatus("signedOut");
      return;
    }
    if (response?.status === 400 || response?.status === 403 || response?.status === 404) {
      // Refused for good (an id the server no longer knows, a banned account, no storage): no loop.
      setStatus("failed");
      return;
    }
    // Network failure, rate limit, outage: try again later, longer each time.
    const delay = Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** retries.current);
    retries.current += 1;
    setStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "retrying");
    timer.current = setTimeout(() => pushAgain.current(), delay);
  }, [apply]);

  /** Reads the account copy and reconciles it with the browser's. */
  const sync = useCallback(async () => {
    lastRead.current = Date.now();
    const fetched = await fetchAccount();
    if (!current.current) return;
    if (fetched.kind === "browser" || fetched.kind === "signedOut") {
      account.current = null;
      setStatus(fetched.kind);
      return;
    }
    if (fetched.kind === "failed") {
      // Signed in, but the login service or the storage did not answer: read again later.
      setStatus("retrying");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => syncAgain.current(), Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** retries.current));
      retries.current += 1;
      return;
    }
    retries.current = 0;
    account.current = fetched.account;
    const local = toStored(current.current);
    const before = meta.current;
    const r = reconcile(local, before, fetched.remote, fetched.account);
    if (!sameOwnership(r.result, local)) apply(r.result);
    if (r.fromElsewhere) setNotice(before && before.account === fetched.account ? "elsewhere" : "merged");
    const remoteSet = fetched.remote ? { heros: fetched.remote.heros, skins: fetched.remote.skins } : { heros: [], skins: [] };
    saveMeta({ account: fetched.account, updatedAt: fetched.remote?.updatedAt ?? null, base: remoteSet, pending: r.upload });
    if (r.upload) void push();
    else setStatus("saved");
  }, [apply, push]);

  useEffect(() => {
    syncAgain.current = () => void sync();
    pushAgain.current = () => void push();
  }, [sync, push]);

  // Catalogue and save arrive together: the collection only shows once both are read.
  useEffect(() => {
    if (!catalog) return;
    known.current = { heroes: new Set(catalog.heroes.map((h) => h.slug)), skins: new Set(skinsCollectible(catalog).map((s) => s.id)) };
    meta.current = readSyncMeta(storageGet(KEY_COLLECTION_SYNC));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser save once the catalogue is in
    apply(readOwnership(storageGet(KEY_COLLECTION)));
    void sync();
  }, [catalog, apply, sync]);

  // Every change is kept in the browser; the player's own ones are also queued for the account.
  useEffect(() => {
    if (!owned) return;
    storageSet(KEY_COLLECTION, writeOwnership(owned));
    if (!dirty.current) return;
    dirty.current = false;
    if (meta.current) saveMeta({ ...meta.current, pending: true });
    if (account.current) {
      clearTimeout(timer.current);
      retries.current = 0;
      timer.current = setTimeout(push, DEBOUNCE_MS);
      setStatus("saving");
    }
  }, [owned, push]);

  useEffect(() => {
    const online = () => {
      if (meta.current?.pending && account.current) void push();
    };
    // Back to the tab: changes made on another device in the meantime show up.
    const visible = () => {
      if (document.visibilityState !== "visible" || !current.current || inFlight.current) return;
      if (meta.current?.pending || Date.now() - lastRead.current < REFRESH_MS) return;
      void sync();
    };
    // Another tab of this browser saved: follow it (that tab sends it to the account).
    const storage = (e: StorageEvent) => {
      if (e.key === KEY_COLLECTION_SYNC) meta.current = readSyncMeta(e.newValue);
      if (e.key !== KEY_COLLECTION || e.newValue === null || !current.current) return;
      const next = readOwnership(e.newValue);
      if (!sameOwnership(next, toStored(current.current))) apply(next);
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("storage", storage);
    };
  }, [push, sync, apply]);

  // A change still waiting when the page closes is flagged `pending`: the next visit sends it.
  useEffect(() => () => clearTimeout(timer.current), []);

  /** The player's change: kept here, and sent to the account when signed in. */
  const update = useCallback((fn: (before: Ownership) => Ownership) => {
    setOwned((before) => {
      if (!before) return before;
      const next = fn(before);
      if (next === before) return before;
      dirty.current = true;
      current.current = next;
      return next;
    });
  }, []);

  const signedIn = SIGNED_IN.includes(status);
  return { owned, update, status, signedIn, notice, dismissNotice: () => setNotice(null) };
}
