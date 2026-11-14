import { log, logError } from "@/lib/log";
import { recordAnnouncements } from "./announcement-store";
import { flushAnnouncements } from "./client";
import { botConfig } from "./config";
import { purgeExpired } from "./guild-store";

/**
 * Bot chores of the site process: at startup (a data sync arrives through
 * a redeployment), then every six hours, since what counts as news also
 * depends on the date (a skin released today, a new calendar month).
 *
 * - record the announcements found in the data, and ask the bot to post the
 *   new ones right away (the bot also polls; a bot still starting just
 *   delivers them later);
 * - delete the servers gone for 30 days and the old command logs.
 *
 * Never throws: a database that is down only costs a log line.
 */

const EVERY_MS = 6 * 3600_000;
/** The bot may start after the site: a first flush that fails is tried again once. */
const RETRY_FLUSH_MS = 60_000;

async function chores(): Promise<void> {
  const config = botConfig();
  if (!config) return;
  try {
    const created = await recordAnnouncements();
    if (created > 0) {
      await log("info", "discord bot: new announcements", { created });
      await flushAnnouncements(config).catch(() => {
        setTimeout(() => void flushAnnouncements(config).catch(() => null), RETRY_FLUSH_MS).unref();
      });
    }
    const purged = await purgeExpired();
    if (purged.guilds || purged.logs) await log("info", "discord bot: retention", purged);
  } catch (error) {
    await logError("discord bot: startup chores failed", error);
  }
}

export function startBotChores(): void {
  if (!botConfig()) return;
  void chores();
  setInterval(() => void chores(), EVERY_MS).unref();
}
