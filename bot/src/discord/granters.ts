import type { Guild } from "discord.js";
import { TtlCache } from "../cache.js";
import { log } from "../log.js";
import { granterAllows, type GranterFacts } from "./auto-roles.js";
import { fetchGranter } from "./shard-api.js";

/**
 * The managers who chose roles the bot hands out (auto-roles, role menus),
 * as Discord last reported them: one live member lookup per server and
 * manager every few minutes, not one per newcomer during a raid or per
 * click on a role menu. Their roles are compared with the role cache's
 * current positions on every use.
 */
export const GRANTER_TTL_MS = 5 * 60 * 1000;

const granters = new TtlCache<GranterFacts>(GRANTER_TTL_MS, 500);

export type GranterVerdict = "ok" | "refused" | "unknown";

/**
 * Could this manager give these roles themselves, now? `unknown`: the
 * server is not in this shard's cache or Discord could not be asked (an
 * outage); the caller gives nothing and marks nothing.
 */
export async function granterVerdict(guild: Guild | undefined, userId: string, roleIds: readonly string[]): Promise<GranterVerdict> {
  if (!guild) return "unknown";
  try {
    const facts = await granters.getOrLoad(`${guild.id}:${userId}`, () => fetchGranter(guild, userId));
    return granterAllows(facts, roleIds) ? "ok" : "refused";
  } catch (error) {
    log.warn("granter lookup failed", { guild: guild.id, error });
    return "unknown";
  }
}

/** The dashboard saved this server: its managers are looked up again. */
export function forgetGranters(guildId: string): void {
  granters.deleteWhere((key) => key.startsWith(`${guildId}:`));
}
