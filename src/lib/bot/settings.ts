import { z } from "zod";
import { LOCALES, type Locale } from "@/i18n/config";

/**
 * A server's bot settings: the shape the bot reads, the shape the dashboard
 * saves, and the conversion from and to the database row. Pure module, no
 * database: the validation is tested on its own.
 */

import {
  ANNOUNCEMENT_TYPES,
  GREETING_KINDS,
  GREETING_MAX_LENGTH,
  AUTO_ROLE_FAILURES,
  MAX_AUTO_ROLES,
  type AnnouncementType,
  type AutoRoleFailure,
  type GreetingKind,
} from "./kinds";

export {
  ANNOUNCEMENT_TYPES,
  AUTO_ROLES_NOT_GRANTABLE,
  DAILY_GAMES,
  GREETING_KINDS,
  GREETING_MAX_LENGTH,
  MAX_AUTO_ROLES,
  type AnnouncementType,
  type DailyGame,
  type GreetingKind,
} from "./kinds";

export const DEFAULT_DAILY_HOUR = 12;

export const snowflake = z.string().regex(/^\d{17,20}$/);
const optionalId = snowflake.nullable();

export interface AnnouncementSetting {
  channelId: string | null;
  roleId: string | null;
  /** The bot could not post there last time (permissions lost). */
  failing: boolean;
}

/** Welcome or goodbye message: no channel, no message; no text, the default one. */
export interface GreetingSetting {
  channelId: string | null;
  message: string | null;
  failing: boolean;
}

/** Roles given to newcomers, people and bots apart: both empty, auto-roles are off. */
export interface AutoRoleSetting {
  roleIds: string[];
  botRoleIds: string[];
  /** The bot could not give them last time; `failReason` says why. */
  failing: boolean;
  failReason: AutoRoleFailure | null;
  /** The manager who chose them: the bot gives only what they could give. */
  configuredBy: string | null;
}

/** What `GET /api/bot/guilds/:id/settings` answers. */
export type GuildSettingsView = {
  guildId: string;
  locale: Locale;
  dailyMlbbdleChannelId: string | null;
  dailyQuizChannelId: string | null;
  dailyHourUtc: number;
  autoRoles: AutoRoleSetting;
} & Record<AnnouncementType, AnnouncementSetting> &
  Record<GreetingKind, GreetingSetting>;

/** Database row, as Prisma returns it (only the fields read here). */
export type SettingsRow = {
  dailyMlbbdleChannelId: string | null;
  dailyQuizChannelId: string | null;
  dailyHourUtc: number;
  autoRoleIds: string[];
  botAutoRoleIds: string[];
  autoRoleFailing: boolean;
  autoRoleFailReason: string | null;
  autoRolesConfiguredBy: string | null;
} & { [K in `${AnnouncementType}ChannelId` | `${AnnouncementType}RoleId`]: string | null } & {
  [K in `${AnnouncementType}Failing`]: boolean;
} & { [K in `${GreetingKind}ChannelId` | `${GreetingKind}Message`]: string | null } & {
  [K in `${GreetingKind}Failing`]: boolean;
};

export const asLocale = (value: string | null | undefined): Locale =>
  (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : "en";

/** Settings of a server, defaults when it never saved any. */
export function settingsView(guildId: string, locale: string, row: SettingsRow | null): GuildSettingsView {
  const announcements = Object.fromEntries(
    ANNOUNCEMENT_TYPES.map((type) => [
      type,
      {
        channelId: row?.[`${type}ChannelId`] ?? null,
        roleId: row?.[`${type}RoleId`] ?? null,
        failing: row?.[`${type}Failing`] ?? false,
      },
    ]),
  ) as Record<AnnouncementType, AnnouncementSetting>;
  const greetings = Object.fromEntries(
    GREETING_KINDS.map((kind) => [
      kind,
      {
        channelId: row?.[`${kind}ChannelId`] ?? null,
        message: row?.[`${kind}Message`] ?? null,
        failing: row?.[`${kind}Failing`] ?? false,
      },
    ]),
  ) as Record<GreetingKind, GreetingSetting>;
  return {
    guildId,
    locale: asLocale(locale),
    ...announcements,
    ...greetings,
    dailyMlbbdleChannelId: row?.dailyMlbbdleChannelId ?? null,
    dailyQuizChannelId: row?.dailyQuizChannelId ?? null,
    dailyHourUtc: row?.dailyHourUtc ?? DEFAULT_DAILY_HOUR,
    autoRoles: {
      roleIds: row?.autoRoleIds ?? [],
      botRoleIds: row?.botAutoRoleIds ?? [],
      failing: row?.autoRoleFailing ?? false,
      failReason: row?.autoRoleFailing ? asFailure(row.autoRoleFailReason) : null,
      configuredBy: row?.autoRolesConfiguredBy ?? null,
    },
  };
}

/**
 * An owner's welcome or goodbye text. Line endings are normalised and the
 * ends trimmed; a blank text means "the default message". It is stored as
 * typed: the bot neutralises mentions and caps it again when it posts, so
 * nothing written here can ping anyone.
 */
export const greetingText = z
  .string()
  .max(GREETING_MAX_LENGTH)
  .refine((text) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text), "control characters")
  .transform((text) => text.replace(/\r\n?/g, "\n").trim() || null)
  .nullable();

const greetingInput = z.object({ channelId: optionalId, message: greetingText }).strict();

/** Up to 3 distinct roles; an empty list turns that half of auto-roles off. */
export const autoRoleIds = z
  .array(snowflake)
  .max(MAX_AUTO_ROLES)
  .refine((ids) => new Set(ids).size === ids.length, "duplicate role");

/** What the dashboard sends when saving. */
export const settingsInput = z
  .object({
    locale: z.enum(LOCALES),
    announcements: z.object(
      Object.fromEntries(
        ANNOUNCEMENT_TYPES.map((t) => [t, z.object({ channelId: optionalId, roleId: optionalId }).strict()]),
      ) as Record<AnnouncementType, z.ZodObject<{ channelId: typeof optionalId; roleId: typeof optionalId }>>,
    ),
    dailyMlbbdleChannelId: optionalId,
    dailyQuizChannelId: optionalId,
    dailyHourUtc: z.number().int().min(0).max(23),
    welcome: greetingInput,
    goodbye: greetingInput,
    /** `roleIds` for the people who join, `botRoleIds` for the bots added. */
    autoRoles: z.object({ roleIds: autoRoleIds, botRoleIds: autoRoleIds }).strict(),
  })
  .strict();
export type SettingsInput = z.infer<typeof settingsInput>;

/**
 * Checks the input against what the bot reports for the server: a channel
 * or a role that is not among them is refused, so the dashboard can only
 * point the bot at places it can post in. A role without a channel is
 * meaningless and dropped.
 *
 * An auto-role must be one the bot itself reported as assignable on this
 * request (below its highest role, not managed, no moderation or
 * administration permission): a role id typed into the request, another
 * server's role or a dangerous one is refused, whatever the page showed.
 */
export function checkAgainstGuild(
  input: SettingsInput,
  channels: ReadonlySet<string>,
  roles: ReadonlySet<string>,
  assignable: ReadonlySet<string> = new Set(),
): { ok: true; value: SettingsInput } | { ok: false; field: string } {
  const value: SettingsInput = structuredClone(input);
  for (const type of ANNOUNCEMENT_TYPES) {
    const setting = value.announcements[type];
    if (setting.channelId && !channels.has(setting.channelId)) return { ok: false, field: `${type}.channelId` };
    if (setting.roleId && !roles.has(setting.roleId)) return { ok: false, field: `${type}.roleId` };
    if (!setting.channelId) setting.roleId = null;
  }
  for (const field of ["dailyMlbbdleChannelId", "dailyQuizChannelId"] as const) {
    const id = value[field];
    if (id && !channels.has(id)) return { ok: false, field };
  }
  for (const kind of GREETING_KINDS) {
    const id = value[kind].channelId;
    if (id && !channels.has(id)) return { ok: false, field: `${kind}.channelId` };
  }
  for (const field of ["roleIds", "botRoleIds"] as const) {
    if (value.autoRoles[field].some((id) => !assignable.has(id))) return { ok: false, field: `autoRoles.${field}` };
  }
  return { ok: true, value };
}

const asFailure = (value: string | null | undefined): AutoRoleFailure =>
  (AUTO_ROLE_FAILURES as readonly string[]).includes(value ?? "") ? (value as AutoRoleFailure) : "bot";

/** Who owns the auto-roles after a save, and whether they stay failing. */
export interface AutoRoleWrite {
  configuredBy: string | null;
  failing: boolean;
  failReason: AutoRoleFailure | null;
}

const OFF: AutoRoleWrite = { configuredBy: null, failing: false, failReason: null };

const sameRoles = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));

/** Did the save change either list (order aside)? */
export const autoRolesChanged = (stored: Pick<AutoRoleSetting, "roleIds" | "botRoleIds">, input: SettingsInput["autoRoles"]) =>
  !sameRoles(stored.roleIds, input.roleIds) || !sameRoles(stored.botRoleIds, input.botRoleIds);

/**
 * The confused-deputy guard. Manage Server opens the dashboard; it does not
 * let anyone hand out roles. Whoever sets the auto-roles must be able to
 * give every one of them themselves (`grantable`, from the bot, on this
 * request: Manage Roles and below their highest role, or owner), and
 * becomes the one the bot checks before every assignment.
 *
 * - lists changed and not empty: the saver must be able to give them all,
 *   or the save is refused; they become the owner of the setting;
 * - lists unchanged: another manager saving an unrelated setting changes
 *   nothing. When the auto-roles are failing, a saver who can give them
 *   takes them over and clears the flag; one who cannot leaves them as
 *   they are, failing, without the rest of the save being refused;
 * - lists emptied: off, nobody owns them.
 *
 * `needsGrantable` says whether `grantable` must be asked to the bot.
 */
export function autoRoleNeedsGrantable(stored: AutoRoleSetting, input: SettingsInput["autoRoles"]): boolean {
  const empty = !input.roleIds.length && !input.botRoleIds.length;
  if (empty) return false;
  return autoRolesChanged(stored, input) || stored.failing || !stored.configuredBy;
}

export function autoRoleWrite(
  stored: AutoRoleSetting,
  input: SettingsInput["autoRoles"],
  userId: string,
  grantable: ReadonlySet<string> | null,
): { ok: true; write: AutoRoleWrite } | { ok: false; field: string } {
  if (!input.roleIds.length && !input.botRoleIds.length) return { ok: true, write: OFF };
  const changed = autoRolesChanged(stored, input);
  const keep: AutoRoleWrite = { configuredBy: stored.configuredBy, failing: stored.failing, failReason: stored.failReason };
  if (!autoRoleNeedsGrantable(stored, input)) return { ok: true, write: { ...keep, failing: false, failReason: null } };
  const allowed = grantable !== null && [...input.roleIds, ...input.botRoleIds].every((id) => grantable.has(id));
  if (allowed) return { ok: true, write: { configuredBy: userId, failing: false, failReason: null } };
  if (changed) {
    const field = input.roleIds.some((id) => !grantable?.has(id)) ? "autoRoles.roleIds" : "autoRoles.botRoleIds";
    return { ok: false, field };
  }
  return { ok: true, write: keep };
}

/** Row to write; saving clears every "failing" flag, the bot tries again (auto-roles: see `autoRoleWrite`). */
export function settingsRow(input: SettingsInput, autoRoles: AutoRoleWrite = OFF): SettingsRow {
  const row = {
    dailyMlbbdleChannelId: input.dailyMlbbdleChannelId,
    dailyQuizChannelId: input.dailyQuizChannelId,
    dailyHourUtc: input.dailyHourUtc,
    autoRoleIds: input.autoRoles.roleIds,
    botAutoRoleIds: input.autoRoles.botRoleIds,
    autoRoleFailing: autoRoles.failing,
    autoRoleFailReason: autoRoles.failReason,
    autoRolesConfiguredBy: autoRoles.configuredBy,
  } as SettingsRow;
  for (const type of ANNOUNCEMENT_TYPES) {
    row[`${type}ChannelId`] = input.announcements[type].channelId;
    row[`${type}RoleId`] = input.announcements[type].roleId;
    row[`${type}Failing`] = false;
  }
  for (const kind of GREETING_KINDS) {
    row[`${kind}ChannelId`] = input[kind].channelId;
    // The text is kept when the message is turned off: switching it back on
    // finds the owner's text again.
    row[`${kind}Message`] = input[kind].message;
    row[`${kind}Failing`] = false;
  }
  return row;
}
