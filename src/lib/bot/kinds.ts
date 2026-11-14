/**
 * Announcement types and daily games: plain constants, in their own module
 * so the dashboard's client component gets them without zod.
 */
export const ANNOUNCEMENT_TYPES = ["patches", "skins", "events", "advanceServer", "esports"] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const DAILY_GAMES = ["mlbbdle-classic", "mlbbdle-skill", "quiz"] as const;
export type DailyGame = (typeof DAILY_GAMES)[number];

/**
 * Messages posted when a member joins or leaves a server. Placeholders in
 * the owner's text, replaced by the bot when it posts (`bot/src/embeds/greetings.ts`).
 */
export const GREETING_KINDS = ["welcome", "goodbye"] as const;
export type GreetingKind = (typeof GREETING_KINDS)[number];
export const GREETING_PLACEHOLDERS = ["{user}", "{username}", "{server}", "{count}"] as const;
/** Same cap as the column (`VarChar(500)`) and the bot's own clip. */
export const GREETING_MAX_LENGTH = 500;

/**
 * Roles the bot gives a member who joins, in one call: one list for
 * people, another for bots. At most this many each; none chosen, off.
 */
export const MAX_AUTO_ROLES = 3;
export const AUTO_ROLE_TARGETS = ["humans", "bots"] as const;
export type AutoRoleTarget = (typeof AUTO_ROLE_TARGETS)[number];
/**
 * Why the bot will not give a role (`bot/src/discord/auto-roles.ts`):
 * managed by an integration or the boosts, at or above the bot's highest
 * role, or carrying a moderation or administration permission.
 */
export const AUTO_ROLE_REFUSALS = ["managed", "above_bot", "dangerous"] as const;
export type AutoRoleRefusal = (typeof AUTO_ROLE_REFUSALS)[number];
