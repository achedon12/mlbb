/**
 * The bot's slash commands as the `/bot` page lists them: name and option
 * syntax (as Discord shows them, in English), grouped in the families of
 * the bot's own /help (`bot/src/commands/help.ts`), the description coming
 * from `pages.bot.commands.<name>`. The order is the page's.
 */
export const BOT_CATEGORIES = ["heroes", "meta", "news", "games", "tools", "setup"] as const;
export type BotCategory = (typeof BOT_CATEGORIES)[number];

export const BOT_COMMANDS: { name: string; options?: string; category: BotCategory }[] = [
  { name: "hero", options: "<name>", category: "heroes" },
  { name: "build", options: "<hero> [rank]", category: "heroes" },
  { name: "skins", options: "[hero]", category: "heroes" },
  { name: "item", options: "<name>", category: "heroes" },
  { name: "emblem", options: "<name>", category: "heroes" },
  { name: "spell", options: "<name>", category: "heroes" },
  { name: "tierlist", options: "[rank] [lane] [role]", category: "meta" },
  { name: "counter", options: "<hero> [rank]", category: "meta" },
  { name: "compare", options: "<hero> <hero>", category: "meta" },
  { name: "patch", options: "[version]", category: "news" },
  { name: "events", category: "news" },
  { name: "mlbbdle", options: "[guess] [mode]", category: "games" },
  { name: "quiz", category: "games" },
  { name: "leaderboard", options: "[game] [period]", category: "games" },
  { name: "nickname", options: "<text> [style]", category: "tools" },
  { name: "servertime", category: "tools" },
  { name: "setup", category: "setup" },
  { name: "help", category: "setup" },
  { name: "invite", category: "setup" },
  { name: "about", category: "setup" },
];

/**
 * The bot's vote page. discordbotlist.com, where the bot is live: its top.gg
 * page stays a 404 until top.gg approves the listing (both lists send their
 * votes to `/api/bot/votes/*` either way). top.gg lists it by the application id.
 */
export const voteUrl = () => "https://discordbotlist.com/bots/mlbbdex/upvote";
