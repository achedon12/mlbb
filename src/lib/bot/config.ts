import { log } from "@/lib/log";
import { isSnowflake } from "./public";
import { MIN_SECRET } from "./signature";

/**
 * Discord bot: server-side configuration, read from the environment at
 * runtime (never `NEXT_PUBLIC_*`: none of this may reach a page).
 *
 * All or nothing, like the push notifications: a missing or malformed value
 * turns the whole bot side off (internal API and dashboard answer 404), with
 * one warning in the log, rather than half working.
 */
export interface BotConfig {
  apiSecret: string;
  sessionSecret: string;
  internalUrl: string;
  clientId: string;
  clientSecret: string;
  superAdmins: Set<string>;
}

/** Secrets of at least 32 characters: `openssl rand -hex 32` gives 64. */
export { MIN_SECRET } from "./signature";

/** Comma-separated Discord ids; anything else is dropped. */
export function parseAdminIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(isSnowflake),
  );
}

/** Pure reading of an environment, for tests. */
export function readBotConfig(env: Record<string, string | undefined>): BotConfig | "absent" | "invalid" {
  const value = (name: string) => env[name]?.trim() ?? "";
  const names = ["DATABASE_URL", "BOT_API_SECRET", "BOT_SESSION_SECRET", "BOT_INTERNAL_URL", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"];
  if (names.every((n) => !value(n))) return "absent";
  let internalUrl = "";
  try {
    const url = new URL(value("BOT_INTERNAL_URL"));
    if (url.protocol === "http:" || url.protocol === "https:") internalUrl = url.origin;
  } catch {
    // Left empty: invalid below.
  }
  const config: BotConfig = {
    apiSecret: value("BOT_API_SECRET"),
    sessionSecret: value("BOT_SESSION_SECRET"),
    internalUrl,
    clientId: value("DISCORD_CLIENT_ID"),
    clientSecret: value("DISCORD_CLIENT_SECRET"),
    superAdmins: parseAdminIds(env.BOT_SUPER_ADMIN_IDS),
  };
  const valid =
    Boolean(value("DATABASE_URL")) &&
    config.apiSecret.length >= MIN_SECRET &&
    config.sessionSecret.length >= MIN_SECRET &&
    config.apiSecret !== config.sessionSecret &&
    Boolean(internalUrl) &&
    isSnowflake(config.clientId) &&
    config.clientSecret.length >= 16;
  return valid ? config : "invalid";
}

let warned = false;

export function botConfig(): BotConfig | null {
  const config = readBotConfig(process.env);
  if (config === "absent") return null;
  if (config === "invalid") {
    if (!warned) {
      warned = true;
      void log("warning", "discord bot: configuration incomplete or malformed, bot features disabled");
    }
    return null;
  }
  return config;
}

/** Super admin: a Discord id listed in BOT_SUPER_ADMIN_IDS, checked on every admin request. */
export function isSuperAdmin(config: Pick<BotConfig, "superAdmins"> | null, userId: string | null | undefined): boolean {
  return Boolean(config && userId && isSnowflake(userId) && config.superAdmins.has(userId));
}
