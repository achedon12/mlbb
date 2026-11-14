import { ApplicationFlags, GatewayIntentBits, REST, Routes } from "discord.js";
import { log } from "../log.js";

/**
 * Gateway intents. `Guilds` is all the commands and announcements need.
 * `GuildMembers` (privileged) is asked for one reason only: the
 * `guildMemberAdd` / `guildMemberRemove` events behind the welcome and
 * goodbye messages. The bot never lists, fetches or stores members with it.
 * Never MessageContent, never presences.
 */

const BASE = [GatewayIntentBits.Guilds];

export function gatewayIntents(memberEvents: boolean): GatewayIntentBits[] {
  return memberEvents ? [...BASE, GatewayIntentBits.GuildMembers] : [...BASE];
}

/**
 * Has the developer portal switched "Server Members Intent" on? Discord
 * sets one of these two application flags (the "limited" one below 100
 * servers, the other once verified); without either, a connection asking
 * for GuildMembers is closed with 4014.
 */
export function memberIntentEnabled(flags: number): boolean {
  return (flags & (ApplicationFlags.GatewayGuildMembers | ApplicationFlags.GatewayGuildMembersLimited)) !== 0;
}

/** Gateway close code for an intent the application is not allowed. */
export const DISALLOWED_INTENTS = 4014;

export const MEMBER_INTENT_WARNING =
  "Server Members Intent is off in the Discord developer portal: welcome and goodbye messages are disabled, everything else runs. Switch it on (Bot > Privileged Gateway Intents) and restart the bot to enable them.";

/**
 * Asks Discord, before connecting, whether the member intent is granted,
 * so a bot without it connects with `Guilds` alone instead of being turned
 * away. When the question itself fails, the intent is assumed granted: a
 * refusal then closes the connection with 4014, the shard says why and
 * exits, and its respawn asks again.
 */
export async function memberEventsAvailable(token: string, rest = new REST({ version: "10" }).setToken(token)): Promise<boolean> {
  try {
    const app = (await rest.get(Routes.currentApplication())) as { flags?: number };
    const enabled = memberIntentEnabled(app.flags ?? 0);
    if (!enabled) log.warn(MEMBER_INTENT_WARNING);
    return enabled;
  } catch (error) {
    log.warn("could not read the application's flags; asking for the member intent anyway", { error });
    return true;
  }
}
