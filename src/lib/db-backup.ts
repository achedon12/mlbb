import { spawn } from "node:child_process";
import { open, readdir, readFile, rename, rm, stat, unlink, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { log, logError } from "@/lib/log";

/**
 * Daily backups of the bot's Postgres database (docs/discord-bot.md).
 *
 * Run by the site process, the only one holding `DATABASE_URL`: `pg_dump`
 * (PostgreSQL 17 client, in the image) writes a compressed custom-format
 * dump into `BACKUP_DIR` (a mounted folder, `./backups` on the host), once a
 * day at 03:30 UTC, and only the three newest are kept. `pg_restore` reads
 * them back.
 *
 * - Atomic: the dump goes to a hidden `.partial` file, renamed once complete;
 *   a dump that fails or comes out empty is deleted, never listed.
 * - One run at a time: an in-process flag, and a lock file in the folder
 *   (created exclusively) for any other process sharing it. A lock older
 *   than the dump's timeout is a crashed run and is taken over.
 * - No secret in an argument (`ps` shows those): the connection is passed
 *   to pg_dump as PG* variables of its own environment, which inherits
 *   nothing else of the site's. Logs carry file names and sizes only.
 * - The outcome of the last run is kept in `status.json`, for the admin panel.
 */

export const KEEP = 3;
/** Every day at 03:30 UTC, the quietest hour of the site's traffic. */
export const SCHEDULE = "30 3 * * *";
export const TIMEZONE = "Etc/UTC";
const DUMP_TIMEOUT_MS = 10 * 60_000;
/** A backup older than this at startup (or none at all): one is made now. */
const CATCH_UP_AFTER_MS = 26 * 3600_000;
/** After startup: the migrations and the first requests go first. */
const CATCH_UP_DELAY_MS = 2 * 60_000;

const NAME = /^mlbbdex-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.dump$/;
const LOCK = ".backup.lock";
const STATUS = "status.json";

export const backupDir = () => process.env.BACKUP_DIR?.trim() || "backups";

/** `mlbbdex-20261114-033000.dump`: UTC, sorts by name as by date. */
export function backupName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `mlbbdex-${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}.dump`
  );
}

/** The date in a backup's name, or null for any other file. */
export function backupDate(name: string): Date | null {
  const m = NAME.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

/**
 * The connection of a `postgresql://` URL as libpq variables. Prisma's own
 * parameters (`schema`, `connection_limit`…) are not pg_dump's: dropped.
 */
export function pgEnv(databaseUrl: string): Record<string, string> {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("DATABASE_URL is not a postgresql:// URL");
  const env: Record<string, string> = {
    PGHOST: url.searchParams.get("host") ?? decodeURIComponent(url.hostname),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v));
}

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

/** The backups in the folder, newest first; a missing folder is none. */
export async function listBackups(dir = backupDir()): Promise<BackupFile[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const files = await Promise.all(
    names.map(async (name) => {
      const date = backupDate(name);
      if (!date) return null;
      const info = await stat(join(dir, name)).catch(() => null);
      return info?.isFile() ? { name, size: info.size, createdAt: date.toISOString() } : null;
    }),
  );
  return files.filter((f): f is BackupFile => f !== null).sort((a, b) => b.name.localeCompare(a.name));
}

/** Deletes all but the `keep` newest backups, and partial dumps left by a crash. Returns what was deleted. */
export async function rotate(dir = backupDir(), keep = KEEP, inProgress?: string): Promise<string[]> {
  const removed: string[] = [];
  for (const old of (await listBackups(dir)).slice(keep)) {
    await unlink(join(dir, old.name)).then(() => removed.push(old.name), () => undefined);
  }
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    if (name.endsWith(".partial") && name !== inProgress) {
      await unlink(join(dir, name)).then(() => removed.push(name), () => undefined);
    }
  }
  return removed;
}

export interface BackupStatus {
  ok: boolean;
  at: string;
  durationMs: number;
  file?: string;
  size?: number;
  error?: string;
  trigger: "schedule" | "startup" | "admin";
}

export async function readStatus(dir = backupDir()): Promise<BackupStatus | null> {
  try {
    return JSON.parse(await readFile(join(dir, STATUS), "utf8")) as BackupStatus;
  } catch {
    return null;
  }
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

/** Writes a dump of the database to `file`; rejects with a short reason. */
export type Dumper = (file: string, env: Record<string, string>) => Promise<void>;

export const pgDump: Dumper = (file, pg) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      ["--format=custom", "--compress=6", "--no-owner", "--no-privileges", `--file=${file}`],
      // Nothing of the site's environment but the path: no bot secret reaches the child.
      {
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: "/tmp", ...pg } as unknown as NodeJS.ProcessEnv,
        stdio: ["ignore", "ignore", "pipe"],
        timeout: DUMP_TIMEOUT_MS,
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 2000) stderr += chunk.toString("utf8");
    });
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(new Error(error.code === "ENOENT" ? "pg_dump is not installed" : error.message)),
    );
    child.on("close", (code, signal) => {
      if (code === 0) return resolve();
      const reason = signal ? `pg_dump stopped (${signal})` : `pg_dump exited with ${code}`;
      // pg_dump's messages name the server and the database, never the password.
      reject(new Error(`${reason}: ${stderr.trim().split("\n").slice(-2).join(" ").slice(0, 240)}`));
    });
  });

let running = false;

/** Takes the folder's lock, or says another process holds it. */
async function lock(dir: string, now: Date): Promise<boolean> {
  const path = join(dir, LOCK);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: now.toISOString() }));
      await handle.close();
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const info = await stat(path).catch(() => null);
      // A run that crashed left its lock: past the dump's own timeout, nobody holds it.
      if (info && now.getTime() - info.mtimeMs > DUMP_TIMEOUT_MS + 60_000) await rm(path, { force: true });
      else return false;
    }
  }
  return false;
}

export type BackupResult = { ok: true; file: BackupFile; removed: string[] } | { ok: false; error: string };

export async function runBackup({
  trigger,
  dir = backupDir(),
  databaseUrl = process.env.DATABASE_URL,
  dump = pgDump,
  now = () => new Date(),
}: {
  trigger: BackupStatus["trigger"];
  dir?: string;
  databaseUrl?: string;
  dump?: Dumper;
  now?: () => Date;
}): Promise<BackupResult> {
  if (running) return { ok: false, error: "already_running" };
  running = true;
  const started = now();
  let locked = false;
  const name = backupName(started);
  const partial = join(dir, `.${name}.partial`);
  const finish = async (status: Omit<BackupStatus, "at" | "durationMs" | "trigger">) => {
    await writeAtomic(join(dir, STATUS), JSON.stringify({ ...status, trigger, at: started.toISOString(), durationMs: now().getTime() - started.getTime() }))
      .catch(() => undefined);
  };
  try {
    if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is not set");
    const env = pgEnv(databaseUrl);
    await mkdir(dir, { recursive: true });
    locked = await lock(dir, started);
    if (!locked) return { ok: false, error: "already_running" };
    await dump(partial, env);
    const size = (await stat(partial)).size;
    if (size === 0) throw new Error("pg_dump wrote an empty file");
    await rename(partial, join(dir, name));
    const removed = await rotate(dir, KEEP);
    const file = { name, size, createdAt: started.toISOString() };
    await finish({ ok: true, file: name, size });
    await log("info", "database backup written", { file: name, size, removed, trigger });
    return { ok: true, file, removed };
  } catch (error) {
    await rm(partial, { force: true });
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    await finish({ ok: false, error: message });
    await logError("database backup failed", error, { trigger });
    return { ok: false, error: message };
  } finally {
    if (locked) await rm(join(dir, LOCK), { force: true });
    running = false;
  }
}

/** Is a backup due at startup: none yet, or the newest is from before yesterday's run. */
export function needsCatchUp(latest: BackupFile | undefined, now: Date): boolean {
  return !latest || now.getTime() - Date.parse(latest.createdAt) > CATCH_UP_AFTER_MS;
}

type Schedule = (expression: string, task: () => Promise<unknown>, options: { timezone: string; name: string; noOverlap: boolean }) => unknown;

/**
 * Registers the daily backup and, when the last one is too old, makes one a
 * couple of minutes after startup. Called once per process (instrumentation).
 */
export async function startBackups({
  schedule,
  dir = backupDir(),
  now = () => new Date(),
  run = runBackup,
}: {
  schedule?: Schedule;
  dir?: string;
  now?: () => Date;
  run?: typeof runBackup;
} = {}): Promise<void> {
  const register: Schedule = schedule ?? ((await import("node-cron")).schedule as unknown as Schedule);
  register(SCHEDULE, () => run({ trigger: "schedule", dir }), { timezone: TIMEZONE, name: "database-backup", noOverlap: true });
  const [latest] = await listBackups(dir);
  if (needsCatchUp(latest, now())) {
    setTimeout(() => void run({ trigger: "startup", dir }), CATCH_UP_DELAY_MS).unref();
  }
  await log("info", "database backups scheduled", { schedule: SCHEDULE, timezone: TIMEZONE, keep: KEEP });
}
