import { z } from "zod";
import {
  MAX_ROLE_MENU_OPTIONS,
  ROLE_MENU_DESCRIPTION_MAX,
  ROLE_MENU_LABEL_MAX,
  ROLE_MENU_MODES,
  ROLE_MENU_TITLE_MAX,
  type RoleMenuMode,
} from "./kinds";
import { parseEmoji } from "./role-menu-emoji";

/**
 * Self-assign role menus: what the dashboard saves, the checks against what
 * the bot reports for the server, who owns a menu after a save, and the
 * shapes served to the dashboard and to the bot. Pure module, no database.
 */

const snowflake = z.string().regex(/^\d{17,20}$/);

/** Control characters: none in a title or label; a text keeps its line breaks and tabs. */
const CONTROL = /\p{Cc}/u;
const noControl = (text: string) => !CONTROL.test(text);
const noControlButLines = (text: string) => !CONTROL.test(text.replace(/[\n\t]/g, ""));

const line = (max: number) =>
  z
    .string()
    .transform((text) => text.trim())
    .pipe(z.string().min(1).max(max).refine(noControl, "control characters"));

/** The menu's text under its title; blank: the bot's default sentence in the server's language. */
const description = z
  .string()
  .transform((text) => text.replace(/\r\n?/g, "\n").trim())
  .pipe(z.string().max(ROLE_MENU_DESCRIPTION_MAX).refine(noControlButLines, "control characters"))
  .transform((text) => text || null)
  .nullable();

/** A unicode emoji, or `<:name:id>`; blank: none. Whether a custom one is the server's is checked apart. */
const emoji = z
  .string()
  .max(80)
  .transform((text) => text.trim() || null)
  .refine((text) => text === null || parseEmoji(text) !== null, "not an emoji")
  .nullable();

const optionInput = z.object({ roleId: snowflake, label: line(ROLE_MENU_LABEL_MAX), emoji }).strict();

/** What the dashboard sends to create or update a menu. */
export const roleMenuInput = z
  .object({
    channelId: snowflake,
    title: line(ROLE_MENU_TITLE_MAX),
    description,
    mode: z.enum(ROLE_MENU_MODES),
    options: z
      .array(optionInput)
      .min(1)
      .max(MAX_ROLE_MENU_OPTIONS)
      .refine((options) => new Set(options.map((o) => o.roleId)).size === options.length, "duplicate role"),
  })
  .strict();
export type RoleMenuInput = z.infer<typeof roleMenuInput>;
export type RoleMenuOption = RoleMenuInput["options"][number];

const storedOption = z.object({ roleId: snowflake, label: z.string().min(1).max(100), emoji: z.string().max(80).nullable().catch(null) });

/** The options column read back: an unreadable entry is dropped, never shown or given. */
export function storedOptions(json: unknown): RoleMenuOption[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((o) => {
    const parsed = storedOption.safeParse(o);
    return parsed.success ? [parsed.data] : [];
  });
}

/** A row, as Prisma returns it (only the fields read here). */
export interface RoleMenuRow {
  id: number;
  guildId: string;
  channelId: string;
  title: string;
  description: string | null;
  mode: string;
  options: unknown;
  configuredBy: string;
  messageId: string | null;
  messageChannelId: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

/** What the dashboard shows of a menu. */
export interface RoleMenuView {
  id: number;
  channelId: string;
  title: string;
  description: string | null;
  mode: RoleMenuMode;
  options: RoleMenuOption[];
  configuredBy: string;
  messageId: string | null;
  messageChannelId: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

const asMode = (mode: string): RoleMenuMode => ((ROLE_MENU_MODES as readonly string[]).includes(mode) ? (mode as RoleMenuMode) : "single");

export function roleMenuView(row: RoleMenuRow): RoleMenuView {
  return {
    id: row.id,
    channelId: row.channelId,
    title: row.title,
    description: row.description,
    mode: asMode(row.mode),
    options: storedOptions(row.options),
    configuredBy: row.configuredBy,
    messageId: row.messageId,
    messageChannelId: row.messageChannelId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** What `GET /api/bot/guilds/:id/role-menus` serves, and the publish call sends. */
export function botRoleMenu(row: RoleMenuRow) {
  return {
    id: row.id,
    channelId: row.channelId,
    title: row.title,
    description: row.description,
    mode: asMode(row.mode),
    options: storedOptions(row.options),
    configuredBy: row.configuredBy,
    messageId: row.messageId,
    messageChannelId: row.messageChannelId,
  };
}

/**
 * Checks a menu against what the bot reports for the server, on the
 * request: its channel must be one the bot can post in, every role one it
 * may give (below its own, not managed, no moderation or administration
 * permission) and every custom emoji one of the server's. A typed id,
 * another server's role or emoji, or a dangerous role is refused.
 */
export function checkRoleMenu(
  input: RoleMenuInput,
  guild: { channels: ReadonlySet<string>; assignable: ReadonlySet<string>; emojis: ReadonlySet<string> },
): { ok: true } | { ok: false; field: string } {
  if (!guild.channels.has(input.channelId)) return { ok: false, field: "channelId" };
  for (const [i, option] of input.options.entries()) {
    if (!guild.assignable.has(option.roleId)) return { ok: false, field: `options.${i}.roleId` };
    const parsed = option.emoji ? parseEmoji(option.emoji) : null;
    if (parsed?.kind === "custom" && !guild.emojis.has(parsed.id)) return { ok: false, field: `options.${i}.emoji` };
  }
  return { ok: true };
}

const sameRoles = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));
export const roleIdsOf = (options: readonly { roleId: string }[]) => options.map((o) => o.roleId);

/**
 * The confused-deputy guard, as for the auto-roles. Manage Server opens
 * the dashboard; it does not let anyone hand out roles. Whoever sets a
 * menu's roles must be able to give every one of them themselves
 * (`grantable`, from the bot, on this request: Manage Roles and below
 * their highest role, or owner), and becomes the one the bot checks
 * before every change.
 *
 * - a saver who can give them all becomes the owner of the menu;
 * - roles unchanged (another manager editing the title or the channel):
 *   the owner stays, the save goes through;
 * - roles changed (or a new menu) by someone who cannot give them: refused.
 */
export function roleMenuOwner(
  stored: { roleIds: readonly string[]; configuredBy: string } | null,
  roleIds: readonly string[],
  userId: string,
  grantable: ReadonlySet<string>,
): { ok: true; configuredBy: string } | { ok: false } {
  if (roleIds.every((id) => grantable.has(id))) return { ok: true, configuredBy: userId };
  if (stored && sameRoles(stored.roleIds, roleIds)) return { ok: true, configuredBy: stored.configuredBy };
  return { ok: false };
}

/** The row's fields written by a save; the message stays until published again. */
export function roleMenuData(input: RoleMenuInput, configuredBy: string) {
  return {
    channelId: input.channelId,
    title: input.title,
    description: input.description,
    mode: input.mode,
    options: input.options.map(({ roleId, label, emoji }) => ({ roleId, label, emoji })),
    configuredBy,
  };
}
