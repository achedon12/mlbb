import { PermissionFlagsBits, type Guild, type GuildMember, type Role } from "discord.js";

/**
 * Which roles the bot agrees to give as auto-roles. The same rules feed the
 * dashboard's pickers (through `/internal/guilds/:id/channels`) and are
 * applied again right before every assignment, against the bot's cache at
 * that moment: a role edited after it was saved is refused then.
 *
 * Never escalate a newcomer: a role carrying any permission below would
 * hand moderation or administration to whoever joins (or to any bot
 * added), so it is refused even when the bot could technically give it.
 */

export const DANGEROUS_PERMISSIONS =
  PermissionFlagsBits.Administrator |
  PermissionFlagsBits.ManageGuild |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.BanMembers |
  PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.ModerateMembers |
  PermissionFlagsBits.ManageWebhooks |
  PermissionFlagsBits.MentionEveryone;

/** Reason given in the server's audit log. */
export const AUTO_ROLE_REASON = "MLBBDex auto-role";

export type RoleRefusal = "everyone" | "managed" | "above_bot" | "dangerous";

/** What the decision reads of a role, so it can be tested without Discord. */
export interface RoleFacts {
  id: string;
  guildId: string;
  /** Integration, bot or booster role: Discord lets nobody give it. */
  managed: boolean;
  permissions: bigint;
  /** Strictly below the bot's highest role. */
  belowBot: boolean;
}

export const hasDangerousPermission = (permissions: bigint): boolean => (permissions & DANGEROUS_PERMISSIONS) !== 0n;

/** Null when the bot may give this role, otherwise why not. */
export function roleRefusal(role: RoleFacts): RoleRefusal | null {
  if (role.id === role.guildId) return "everyone";
  if (role.managed) return "managed";
  if (!role.belowBot) return "above_bot";
  if (hasDangerousPermission(role.permissions)) return "dangerous";
  return null;
}

export function roleFacts(role: Role, me: GuildMember): RoleFacts {
  return {
    id: role.id,
    guildId: role.guild.id,
    managed: role.managed,
    permissions: role.permissions.bitfield,
    belowBot: role.comparePositionTo(me.roles.highest) < 0,
  };
}

export type AutoRoleCheck =
  | { ok: true }
  | { ok: false; reason: "missing_permission" | "unknown_role" | "unknown_guild" | RoleRefusal; roleId?: string };

/**
 * May the bot give every one of these roles in this server, right now?
 * Pure over the facts: the bot's own Manage Roles and each role's facts
 * (undefined: the role no longer exists).
 */
export function checkRoles(manageRoles: boolean, roles: { id: string; facts: RoleFacts | undefined }[]): AutoRoleCheck {
  if (!manageRoles) return { ok: false, reason: "missing_permission" };
  for (const { id, facts } of roles) {
    if (!facts) return { ok: false, reason: "unknown_role", roleId: id };
    const refusal = roleRefusal(facts);
    if (refusal) return { ok: false, reason: refusal, roleId: id };
  }
  return { ok: true };
}

/** `checkRoles` against the shard's cache of that server. */
export function checkGuildRoles(guild: Guild | undefined, roleIds: readonly string[]): AutoRoleCheck {
  const me = guild?.members.me;
  if (!guild || !me) return { ok: false, reason: "unknown_guild" };
  return checkRoles(
    me.permissions.has(PermissionFlagsBits.ManageRoles),
    roleIds.map((id) => {
      const role = guild.roles.cache.get(id);
      return { id, facts: role ? roleFacts(role, me) : undefined };
    }),
  );
}
