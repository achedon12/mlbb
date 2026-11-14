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
