import { open } from "node:fs/promises";
import { join } from "node:path";

/**
 * The last log rows worth a super admin's eye, read from the site's own log
 * files (`src/lib/log.ts`, one per day and level): every error, and the
 * warnings of the bot and backup paths. Only the time, the level and the
 * message are shown: a row's context (stacks, ids) stays in the file.
 *
 * Only the tail of each file is read, so a busy day costs the same.
 */

const TAIL_BYTES = 128 * 1024;
const WATCHED = /^(discord bot|database backup)/;

export interface LogRow {
  t: string;
  level: "warning" | "error";
  message: string;
}

async function tail(path: string): Promise<string> {
  const handle = await open(path, "r").catch(() => null);
  if (!handle) return "";
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    const text = buffer.toString("utf8");
    // A cut first line is not JSON: dropped.
    return size > length ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    await handle.close();
  }
}

/** Pure: the rows of a log file's text to show, oldest first. */
export function parseRows(text: string): LogRow[] {
  const rows: LogRow[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as { t?: unknown; level?: unknown; message?: unknown };
      if (typeof row.t !== "string" || typeof row.message !== "string") continue;
      if (row.level === "error" || (row.level === "warning" && WATCHED.test(row.message))) {
        rows.push({ t: row.t, level: row.level, message: row.message.slice(0, 200) });
      }
    } catch {
      // Not a row of ours.
    }
  }
  return rows;
}

export async function recentLogRows(limit = 10, now = new Date(), folder = process.env.LOGS_DIR ?? "logs"): Promise<LogRow[]> {
  const days = [new Date(now.getTime() - 86_400_000), now].map((d) => d.toISOString().slice(0, 10));
  const texts = await Promise.all(
    days.flatMap((day) => [`erreurs-${day}.log`, `evenements-${day}.log`].map((name) => tail(join(/*turbopackIgnore: true*/ folder, name)))),
  );
  return texts
    .flatMap(parseRows)
    .sort((a, b) => b.t.localeCompare(a.t))
    .slice(0, limit);
}
