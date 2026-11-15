import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

/**
 * Server log.
 *
 * Errors always go to standard output — captured by the container — and, when
 * the folder is writable, to a per-day file under `logs/`. Errors are written
 * apart from ordinary events so they can be found at a glance. The log must
 * never interrupt a request: any write failure is swallowed.
 *
 * The day files are deleted once past their retention (`LOG_RETENTION_DAYS`,
 * `startLogRetention`).
 */
const FOLDER = process.env.LOGS_DIR ?? "logs";

export type Level = "info" | "warning" | "error";

function fileOfDay(level: Level): string {
  const day = new Date().toISOString().slice(0, 10);
  return level === "error" ? `erreurs-${day}.log` : `evenements-${day}.log`;
}

export async function log(
  level: Level,
  message: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  const row = JSON.stringify({ t: new Date().toISOString(), level, message, ...context }) + "\n";

  // Standard output: always, for platforms that collect logs.
  (level === "error" ? console.error : console.log)(row.trimEnd());

  try {
    // A runtime folder: nothing for the build to trace.
    await mkdir(/*turbopackIgnore: true*/ FOLDER, { recursive: true });
    await appendFile(join(/*turbopackIgnore: true*/ FOLDER, fileOfDay(level)), row, "utf8");
  } catch {
    // Read-only or unavailable folder: standard output is enough.
  }
}

/** Shortcut for logging an error, with a serialised cause. */
export function logError(
  message: string,
  cause?: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  const detail =
    cause instanceof Error ? { error: cause.message, stack: cause.stack } : cause != null ? { error: String(cause) } : {};
  return log("error", message, { ...detail, ...context });
}

// -- Retention ---------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;

/**
 * How long a day file is kept, in days, counted from the end of its day.
 *
 * - `erreurs-*`: diagnostics (server errors, and the errors browsers report:
 *   message, page, site version, browser). A month is enough to see an
 *   incident through and compare with the weeks before.
 * - `evenements-*`: the security trail as much as the activity — refused
 *   internal calls and admin tokens, moderation and admin actions with the
 *   moderator's Discord id, reports. Six months, the low end of what the
 *   CNIL recommends for security logs (six months to a year): the community
 *   keeps its own moderation log in the database, so the low end is enough.
 */
export const LOG_RETENTION_DAYS = { erreurs: 30, evenements: 180 } as const;

const DAY_FILE = /^(erreurs|evenements)-(\d{4}-\d{2}-\d{2})\.log$/;

/**
 * The day files past their retention at `now`: a file goes once its last
 * possible entry (the end of its day, UTC) is older than its retention.
 * Anything else in the folder is left alone.
 */
export function expiredLogFiles(names: string[], now: number): string[] {
  return names.filter((name) => {
    const found = DAY_FILE.exec(name);
    if (!found) return false;
    const start = Date.parse(`${found[2]}T00:00:00Z`);
    if (Number.isNaN(start)) return false;
    const days = LOG_RETENTION_DAYS[found[1] as keyof typeof LOG_RETENTION_DAYS];
    return start + DAY_MS + days * DAY_MS <= now;
  });
}

/** Deletes the expired day files of `folder`; the names deleted. Never throws. */
export async function pruneLogs(folder = FOLDER, now = Date.now()): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(/*turbopackIgnore: true*/ folder);
  } catch {
    // No folder yet, or not readable: nothing to delete.
    return [];
  }
  const removed: string[] = [];
  for (const name of expiredLogFiles(names, now)) {
    try {
      await unlink(join(/*turbopackIgnore: true*/ folder, name));
      removed.push(name);
    } catch {
      // Already gone, or read-only: the next run tries again.
    }
  }
  return removed;
}

let retentionStarted = false;

/**
 * Applies the retention at startup, then once a day, in the process that
 * writes the files (instrumentation). Once per process.
 */
export function startLogRetention(folder = FOLDER): void {
  if (retentionStarted) return;
  retentionStarted = true;
  const run = async () => {
    const removed = await pruneLogs(folder);
    if (removed.length) await log("info", "logs: expired day files deleted", { removed, retention: LOG_RETENTION_DAYS });
  };
  void run();
  setInterval(() => void run(), DAY_MS).unref();
}
