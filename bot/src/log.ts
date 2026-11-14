/**
 * Structured logging: one JSON object per line on stdout, which `docker logs`
 * and any collector read as is.
 *
 * Nothing secret may end up here. Fields whose name looks like a credential
 * are replaced, and any string that looks like a Discord bot token is masked
 * wherever it appears (an error message from a library can quote a header).
 * Every other module logs through this one: ESLint forbids `console`.
 */

export type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SECRET_KEY = /token|secret|password|authorization|signature|cookie/i;
// Bot tokens are three base64url segments separated by dots, the first one
// being the base64 of the bot id.
const DISCORD_TOKEN = /[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,40}/g;

let threshold: Level = parseLevel(process.env.LOG_LEVEL);
const shardTag = process.env.SHARDS ? { shard: process.env.SHARDS } : {};

function parseLevel(value: string | undefined): Level {
  return value === "debug" || value === "info" || value === "warn" || value === "error" ? value : "info";
}

export function setLogLevel(level: Level): void {
  threshold = level;
}

/** Masks token-looking substrings. Exported for the tests. */
export function scrub(text: string): string {
  return text.replace(DISCORD_TOKEN, "[redacted]");
}

/** Copies a value for logging, redacting secrets and flattening errors. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (typeof value === "string") return scrub(value);
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return {
      name: value.name,
      message: scrub(value.message),
      ...(code !== undefined ? { code } : {}),
      ...(threshold === "debug" && value.stack ? { stack: scrub(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[threshold]) return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg: scrub(msg),
    ...shardTag,
    ...(fields ? (sanitize(fields) as Record<string, unknown>) : {}),
  });
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => write("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};
