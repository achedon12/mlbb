/**
 * The bot's languages, in a module of their own: code that only needs the
 * list (the site client, and the site's tests that import it) does not pull
 * discord.js in with the rest of `i18n/index.ts`.
 */
export const LOCALES = ["en", "fr", "it", "es", "id"] as const;
export type Locale = (typeof LOCALES)[number];
