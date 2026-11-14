import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Database client, for the Discord bot data only (see docs/discord-bot.md):
 * the rest of the site still runs from its JSON files and needs no database.
 *
 * Created on first use, never at import: a page that never touches the bot
 * does not open a connection, and a site without `DATABASE_URL` builds and
 * runs as before. One client per process, kept on `globalThis` so that hot
 * reload in development does not open a new pool on every edit.
 */
const globalForDb = globalThis as unknown as { mlbbdexDb?: PrismaClient };

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function db(): PrismaClient {
  if (globalForDb.mlbbdexDb) return globalForDb.mlbbdexDb;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  // A small pool: the site is one process, and the bot's calls are short.
  const adapter = new PrismaPg({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
  const client = new PrismaClient({ adapter });
  globalForDb.mlbbdexDb = client;
  return client;
}
