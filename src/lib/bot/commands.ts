/**
 * The bot's slash commands as the `/bot` page lists them: name and option
 * syntax (as Discord shows them, in English), the description coming from
 * `pages.bot.commands.<name>`. The order is the page's.
 */
export const BOT_COMMANDS: { name: string; options?: string }[] = [
  { name: "hero", options: "<name>" },
  { name: "build", options: "<hero>" },
  { name: "counter", options: "<hero>" },
  { name: "tierlist", options: "[rank] [lane|role]" },
  { name: "compare", options: "<hero> <hero>" },
  { name: "item", options: "<name>" },
  { name: "emblem", options: "<name>" },
  { name: "spell", options: "<name>" },
  { name: "patch", options: "[version]" },
  { name: "skins", options: "[hero]" },
  { name: "events" },
  { name: "nickname", options: "<text> [style]" },
  { name: "mlbbdle", options: "[mode]" },
  { name: "quiz" },
  { name: "leaderboard", options: "[game] [period]" },
  { name: "servertime" },
  { name: "setup" },
  { name: "help" },
  { name: "invite" },
  { name: "about" },
];
