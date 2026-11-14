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
  MAX_AUTO_ROLES,
  type AnnouncementType,
  type GreetingKind,
} from "./kinds";

export {
  ANNOUNCEMENT_TYPES,
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
  /** The bot could not give them last time (Manage Roles lost, role moved). */
  failing: boolean;
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

/** Row to write; saving clears every "failing" flag, the bot tries again. */
export function settingsRow(input: SettingsInput): SettingsRow {
  const row = {
    dailyMlbbdleChannelId: input.dailyMlbbdleChannelId,
    dailyQuizChannelId: input.dailyQuizChannelId,
    dailyHourUtc: input.dailyHourUtc,
    autoRoleIds: input.autoRoles.roleIds,
    botAutoRoleIds: input.autoRoles.botRoleIds,
    autoRoleFailing: false,
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
