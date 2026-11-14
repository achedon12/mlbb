import { REST, Routes } from "discord.js";
import { COMMANDS } from "./commands/index.js";
import { ConfigError, loadConfig, requireDiscord } from "./config.js";
import { log } from "./log.js";
import { postCommandsToDbl } from "./managers/listing.js";

/**
 * Registers the slash commands with Discord: `npm run deploy-commands`.
 *
 * Global registration takes up to an hour to reach every client; with
 * DEV_GUILD_ID set, the commands go to that one server instead, where they
 * appear at once (for testing a change before deploying it everywhere).
 * Run it after adding, renaming or translating a command, not at every start.
 *
 * A global registration then sends the same list to discordbotlist.com,
 * which shows it on the bot's page; that step is skipped without DBL_TOKEN,
 * and its failure leaves the Discord registration standing.
 */

try {
  const config = loadConfig();
  const { token, clientId } = requireDiscord(config);
  const body = COMMANDS.map((c) => c.data());
  const rest = new REST({ version: "10" }).setToken(token);
  const route = config.DEV_GUILD_ID ? Routes.applicationGuildCommands(clientId, config.DEV_GUILD_ID) : Routes.applicationCommands(clientId);
  const result = (await rest.put(route, { body })) as unknown[];
  log.info("commands registered", { count: result.length, scope: config.DEV_GUILD_ID ? `guild ${config.DEV_GUILD_ID}` : "global" });
  if (config.DEV_GUILD_ID) log.info("test registration: command list not sent to discordbotlist.com");
  else if (!config.DBL_TOKEN) log.info("DBL_TOKEN is not set: command list not sent to discordbotlist.com");
  else await postCommandsToDbl(clientId, config.DBL_TOKEN, body);
} catch (error) {
  log.error(error instanceof ConfigError ? error.message : "command registration failed", error instanceof ConfigError ? undefined : { error });
  process.exitCode = 1;
}
