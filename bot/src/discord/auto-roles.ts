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

// ─── The person who chose the roles ───────────────────────────────────

/**
 * Why a server manager may not hand out a role through the bot. Manage
 * Server is enough to open the dashboard, not to give roles: without this
 * check, a manager without Manage Roles, or below the role, could have the
 * bot give it to an account of theirs that joins (the bot acting as a
 * confused deputy). Discord's own rule applies instead: Manage Roles (or
 * Administrator) and the role strictly below the person's highest role;
 * the owner may give any role (below the bot's, checked apart).
 */
export type GranterRefusal = "not_member" | "no_manage_roles" | "above_user";

/** What the decision reads of the manager, fetched live from Discord. */
export interface GranterFacts {
  member: boolean;
  owner: boolean;
  /** Manage Roles, Administrator included. */
  manageRoles: boolean;
  /** Is this role strictly below their highest role? */
  below: (roleId: string) => boolean;
}

export const NOT_A_MEMBER: GranterFacts = { member: false, owner: false, manageRoles: false, below: () => false };

export function granterRefusal(granter: GranterFacts, roleId: string): GranterRefusal | null {
  if (!granter.member) return "not_member";
  if (granter.owner) return null;
  if (!granter.manageRoles) return "no_manage_roles";
  if (!granter.below(roleId)) return "above_user";
  return null;
}

/** May this manager give every one of these roles? */
export const granterAllows = (granter: GranterFacts, roleIds: readonly string[]): boolean =>
  roleIds.every((id) => granterRefusal(granter, id) === null);

/** Facts of a member of this server, as just fetched. */
export function granterFacts(guild: Guild, member: GuildMember): GranterFacts {
  const highest = member.roles.highest;
  return {
    member: true,
    owner: guild.ownerId === member.id,
    manageRoles: member.permissions.has(PermissionFlagsBits.ManageRoles),
    below: (roleId) => {
      const role = guild.roles.cache.get(roleId);
      return role ? guild.roles.comparePositions(role, highest) < 0 : false;
    },
  };
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
