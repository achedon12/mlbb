import { z } from "zod";

/**
 * Environment, read once and validated. A misconfigured bot stops at start
 * with a message naming the variable, rather than half-working for hours.
 * Every value is documented in `.env.example`.
 */

const SNOWFLAKE = /^\d{17,20}$/;

/** Empty strings count as unset: compose files often pass `VAR=` through. */
const optional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));

const url = (fallback: string) =>
  optional.transform((v) => v ?? fallback).pipe(z.url({ protocol: /^https?$/ })).transform((v) => v.replace(/\/+$/, ""));

const schema = z.object({
  DISCORD_TOKEN: optional,
  DISCORD_CLIENT_ID: optional.refine((v) => v === undefined || SNOWFLAKE.test(v), "must be the application id (a snowflake)"),
  BOT_API_SECRET: optional.refine(
    (v) => v === undefined || v.length >= 32,
    "must be at least 32 characters (openssl rand -hex 32)",
  ),
  SITE_URL: url("https://mlbbdex.com"),
  SITE_INTERNAL_URL: url("http://localhost:3001"),
  BOT_HTTP_HOST: optional.transform((v) => v ?? "127.0.0.1"),
  BOT_HTTP_PORT: optional
    .transform((v) => Number(v ?? 3100))
    .pipe(z.number().int().min(1).max(65535)),
  TOPGG_TOKEN: optional,
  DBL_TOKEN: optional,
  DBOTSGG_TOKEN: optional,
  SUPPORT_SERVER_URL: optional.pipe(z.url({ protocol: /^https$/ }).optional()),
  /** The community server: replies there do not offer "Add to your server". */
  SUPPORT_GUILD_ID: optional.refine((v) => v === undefined || SNOWFLAKE.test(v), "must be a server id (a snowflake)"),
  DEV_GUILD_ID: optional.refine((v) => v === undefined || SNOWFLAKE.test(v), "must be a server id (a snowflake)"),
});

export type Config = z.infer<typeof schema>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new ConfigError(`Invalid environment:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/** The token and the application id, required by everything that talks to Discord. */
export function requireDiscord(config: Config): { token: string; clientId: string } {
  const missing = [
    !config.DISCORD_TOKEN && "DISCORD_TOKEN",
    !config.DISCORD_CLIENT_ID && "DISCORD_CLIENT_ID",
  ].filter(Boolean);
  if (missing.length) {
    throw new ConfigError(
      `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set. ` +
        "Create an application on https://discord.com/developers/applications, " +
        "copy its bot token and application id into bot/.env (see .env.example), then start again.",
    );
  }
  return { token: config.DISCORD_TOKEN!, clientId: config.DISCORD_CLIENT_ID! };
}
