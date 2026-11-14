import { z } from "zod";
import { LOCALES, type Locale } from "@/i18n/config";

/**
 * A server's bot settings: the shape the bot reads, the shape the dashboard
 * saves, and the conversion from and to the database row. Pure module, no
 * database: the validation is tested on its own.
 */

import { ANNOUNCEMENT_TYPES, type AnnouncementType } from "./kinds";

export { ANNOUNCEMENT_TYPES, DAILY_GAMES, type AnnouncementType, type DailyGame } from "./kinds";

export const DEFAULT_DAILY_HOUR = 12;

export const snowflake = z.string().regex(/^\d{17,20}$/);
const optionalId = snowflake.nullable();

export interface AnnouncementSetting {
  channelId: string | null;
  roleId: string | null;
  /** The bot could not post there last time (permissions lost). */
  failing: boolean;
}

/** What `GET /api/bot/guilds/:id/settings` answers. */
export type GuildSettingsView = {
  guildId: string;
  locale: Locale;
  dailyMlbbdleChannelId: string | null;
  dailyQuizChannelId: string | null;
  dailyHourUtc: number;
} & Record<AnnouncementType, AnnouncementSetting>;

/** Database row, as Prisma returns it (only the fields read here). */
export type SettingsRow = {
  dailyMlbbdleChannelId: string | null;
  dailyQuizChannelId: string | null;
  dailyHourUtc: number;
} & { [K in `${AnnouncementType}ChannelId` | `${AnnouncementType}RoleId`]: string | null } & {
  [K in `${AnnouncementType}Failing`]: boolean;
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
  return {
    guildId,
    locale: asLocale(locale),
    ...announcements,
    dailyMlbbdleChannelId: row?.dailyMlbbdleChannelId ?? null,
    dailyQuizChannelId: row?.dailyQuizChannelId ?? null,
    dailyHourUtc: row?.dailyHourUtc ?? DEFAULT_DAILY_HOUR,
  };
}

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
  })
  .strict();
export type SettingsInput = z.infer<typeof settingsInput>;

/**
 * Checks the input against what the bot reports for the server: a channel
 * or a role that is not among them is refused, so the dashboard can only
 * point the bot at places it can post in. A role without a channel is
 * meaningless and dropped.
 */
export function checkAgainstGuild(
  input: SettingsInput,
  channels: ReadonlySet<string>,
  roles: ReadonlySet<string>,
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
  return { ok: true, value };
}

/** Row to write; saving clears every "failing" flag, the bot tries again. */
export function settingsRow(input: SettingsInput): SettingsRow {
  const row = {
    dailyMlbbdleChannelId: input.dailyMlbbdleChannelId,
    dailyQuizChannelId: input.dailyQuizChannelId,
    dailyHourUtc: input.dailyHourUtc,
  } as SettingsRow;
  for (const type of ANNOUNCEMENT_TYPES) {
    row[`${type}ChannelId`] = input.announcements[type].channelId;
    row[`${type}RoleId`] = input.announcements[type].roleId;
    row[`${type}Failing`] = false;
  }
  return row;
}
