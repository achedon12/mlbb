import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Server log.
 *
 * Errors always go to standard output — captured by the container — and, when
 * the folder is writable, to a per-day file under `logs/`. Errors are written
 * apart from ordinary events so they can be found at a glance. The log must
 * never interrupt a request: any write failure is swallowed.
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
  const row = JSON.stringify({ t: new Date().toISOString(), niveau: level, message, ...context }) + "\n";

  // Standard output: always, for platforms that collect logs.
  (level === "error" ? console.error : console.log)(row.trimEnd());

  try {
    await mkdir(FOLDER, { recursive: true });
    await appendFile(join(FOLDER, fileOfDay(level)), row, "utf8");
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
    cause instanceof Error ? { erreur: cause.message, pile: cause.stack } : cause != null ? { erreur: String(cause) } : {};
  return log("error", message, { ...detail, ...context });
}
