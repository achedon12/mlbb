import type { StoredOwnership } from "./collection";

/**
 * Collection kept on the game account, next to the browser copy.
 *
 * The browser save (`KEY_COLLECTION`) stays the working copy: the tool reads
 * and writes it whether or not the player is signed in. Signed in, the whole
 * set is also sent to the account, so it follows them to another device. This
 * module holds the decisions, with no network and no storage: which copy wins
 * when the page opens, how two edited copies merge, and the backup file. Data
 * free, so a client component can import it.
 */

/** Ceilings of a saved collection: far above the catalogue, low enough to bound a row. */
export const MAX_HEROES = 400;
export const MAX_SKINS = 4000;
export const HERO_ID = /^[a-z0-9-]{1,40}$/;
export const SKIN_ID = /^[0-9A-Za-z_-]{1,16}$/;

/** The copy kept on the account, as the API returns it. */
export interface RemoteCollection extends StoredOwnership {
  /** ISO time of the last save: the version a write is based on. */
  updatedAt: string;
}

/**
 * What this browser remembers of the account copy, next to the collection:
 * the account it was synced with (an opaque key, not the account id), the
 * version and content last agreed with the server — the common ancestor of a
 * three-way merge — and whether local changes still wait to be sent.
 */
export interface SyncMeta {
  account: string;
  updatedAt: string | null;
  base: StoredOwnership;
  pending: boolean;
}

export const KEY_COLLECTION_SYNC = "mlbbdex:collection-sync";

const EMPTY: StoredOwnership = { heros: [], skins: [] };

const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
const strings = (x: unknown) => (Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : []);

export function sameOwnership(a: StoredOwnership, b: StoredOwnership): boolean {
  const eq = (x: string[], y: string[]) => {
    const sx = sorted(x);
    const sy = sorted(y);
    return sx.length === sy.length && sx.every((v, i) => v === sy[i]);
  };
  return eq(a.heros, b.heros) && eq(a.skins, b.skins);
}

export function unionOwnership(a: StoredOwnership, b: StoredOwnership): StoredOwnership {
  return { heros: sorted([...a.heros, ...b.heros]), skins: sorted([...a.skins, ...b.skins]) };
}

/**
 * Three-way merge of one list: an entry this side changed since the common
 * ancestor keeps this side's choice, otherwise the other side's. A skin
 * unticked here and untouched elsewhere stays unticked; one ticked on the
 * other device appears here.
 */
function mergeList(base: string[], local: string[], remote: string[]): string[] {
  const b = new Set(base);
  const l = new Set(local);
  const r = new Set(remote);
  return sorted([...l, ...r, ...b].filter((id) => (l.has(id) !== b.has(id) ? l.has(id) : r.has(id))));
}

export function mergeOwnership(base: StoredOwnership, local: StoredOwnership, remote: StoredOwnership): StoredOwnership {
  return {
    heros: mergeList(base.heros, local.heros, remote.heros),
    skins: mergeList(base.skins, local.skins, remote.skins),
  };
}

/** Keeps the entries the catalogue knows, so a write never carries a stale or invented id. */
export function keepKnown(o: StoredOwnership, heroes: ReadonlySet<string>, skins: ReadonlySet<string>): StoredOwnership {
  return { heros: sorted(o.heros.filter((h) => heroes.has(h))), skins: sorted(o.skins.filter((s) => skins.has(s))) };
}

export type Reconciled = {
  /** The collection to show and keep in the browser. */
  result: StoredOwnership;
  /** Whether `result` must be sent to the account. */
  upload: boolean;
  /** The account copy brought changes made elsewhere. */
  fromElsewhere: boolean;
};

/**
 * What to do when a signed-in page opens, from the browser copy, what the
 * browser remembers, and the account copy:
 * - first sync of this browser with this account: the union of both copies,
 *   sent back — nothing ticked on either side is lost;
 * - nothing changed here since the last sync: the account copy, as it is;
 * - changes waiting here: merged with the account copy (three-way, from the
 *   last agreed version), and sent.
 * A browser last synced with another account takes this account's copy
 * rather than mixing two players' collections.
 */
export function reconcile(
  local: StoredOwnership,
  meta: SyncMeta | null,
  remote: RemoteCollection | null,
  account: string,
): Reconciled {
  const remoteSet = remote ? { heros: remote.heros, skins: remote.skins } : EMPTY;
  if (!meta || meta.account !== account) {
    if (meta && remote) return { result: remoteSet, upload: false, fromElsewhere: !sameOwnership(local, remoteSet) };
    const result = unionOwnership(local, remoteSet);
    return { result, upload: !remote || !sameOwnership(result, remoteSet), fromElsewhere: !sameOwnership(result, local) };
  }
  const changedElsewhere = (remote?.updatedAt ?? null) !== meta.updatedAt;
  if (!meta.pending) {
    if (!changedElsewhere) return { result: local, upload: false, fromElsewhere: false };
    return { result: remoteSet, upload: false, fromElsewhere: !sameOwnership(local, remoteSet) };
  }
  if (!changedElsewhere) return { result: local, upload: true, fromElsewhere: false };
  const result = mergeOwnership(meta.base, local, remoteSet);
  return { result, upload: !sameOwnership(result, remoteSet), fromElsewhere: !sameOwnership(result, local) };
}

export function readSyncMeta(raw: string | null): SyncMeta | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SyncMeta> | null;
    if (!v || typeof v !== "object" || typeof v.account !== "string") return null;
    const base = (v.base ?? {}) as Partial<StoredOwnership>;
    return {
      account: v.account,
      updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
      base: { heros: strings(base.heros), skins: strings(base.skins) },
      pending: v.pending === true,
    };
  } catch {
    return null;
  }
}

// ── Backup file ────────────────────────────────────────────────────

export const BACKUP_FORMAT = "mlbbdex-collection";
export const BACKUP_VERSION = 1;
/** A backup is a few kilobytes: anything past this is not one. */
export const MAX_BACKUP_BYTES = 256 * 1024;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  heroes: string[];
  skins: string[];
}

export function writeBackup(o: StoredOwnership, now = new Date()): string {
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    heroes: sorted(o.heros),
    skins: sorted(o.skins),
  };
  return JSON.stringify(backup, null, 2) + "\n";
}

export type BackupRead =
  | { ok: true; collection: StoredOwnership; ignored: number }
  | { ok: false; reason: "size" | "json" | "format" | "version" | "empty" };

/**
 * Reads a backup file back. Also accepts the browser save itself
 * (`{ heros, skins }`), which is what a player copying their storage by hand
 * would have. Entries the catalogue does not know are dropped and counted.
 */
export function readBackup(text: string, heroes: ReadonlySet<string>, skins: ReadonlySet<string>): BackupRead {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: "size" };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, reason: "json" };
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, reason: "format" };
  const o = v as Record<string, unknown>;
  let raw: StoredOwnership;
  if (o.format === BACKUP_FORMAT) {
    if (o.version !== BACKUP_VERSION) return { ok: false, reason: "version" };
    if (!Array.isArray(o.heroes) || !Array.isArray(o.skins)) return { ok: false, reason: "format" };
    raw = { heros: strings(o.heroes), skins: strings(o.skins) };
  } else if (Array.isArray(o.heros) && Array.isArray(o.skins)) {
    raw = { heros: strings(o.heros), skins: strings(o.skins) };
  } else {
    return { ok: false, reason: "format" };
  }
  const known = keepKnown(raw, heroes, skins);
  const ignored = new Set(raw.heros).size + new Set(raw.skins).size - known.heros.length - known.skins.length;
  if (known.heros.length === 0 && known.skins.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, collection: known, ignored };
}

export const backupName = (now = new Date()) => `mlbbdex-collection-${now.toISOString().slice(0, 10)}.json`;
