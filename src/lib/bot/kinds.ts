/**
 * Announcement types and daily games: plain constants, in their own module
 * so the dashboard's client component gets them without zod.
 */
export const ANNOUNCEMENT_TYPES = ["patches", "skins", "events", "advanceServer", "esports"] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const DAILY_GAMES = ["mlbbdle-classic", "mlbbdle-skill", "quiz"] as const;
export type DailyGame = (typeof DAILY_GAMES)[number];
