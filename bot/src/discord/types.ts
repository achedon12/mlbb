import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from "discord.js";
import type { Config } from "../config.js";
import type { MlbbdleProgress } from "../commands/mlbbdle.js";
import type { DayStore } from "../games/state.js";
import type { QuizProgress } from "../games/quiz.js";
import type { View } from "../embeds/common.js";
import type { CommandLogger } from "../managers/command-logger.js";
import type { GameData } from "../site/game-data.js";
import type { SiteClient } from "../site/internal-api.js";

/** Everything a command may use, built once per shard. */
export interface Services {
  config: Config;
  clientId: string;
  data: GameData;
  /** Null when BOT_API_SECRET is unset: settings, daily games and logs are then off. */
  site: SiteClient | null;
  logger: CommandLogger;
  mlbbdle: DayStore<MlbbdleProgress>;
  quiz: DayStore<QuizProgress>;
}

/** A reply's language and links (see `View`), plus the shard's services. */
export interface Context extends View {
  services: Services;
}

export interface Command {
  /** Key in the i18n files, and the English name. */
  key: string;
  /** Replies only the author sees: anything personal (games, settings links). */
  ephemeral?: boolean;
  /** Only usable in a server (leaderboards, settings). */
  guildOnly?: boolean;
  /**
   * Answers from memory, well within Discord's three seconds: no "thinking…"
   * first, the reply is sent at once (one round trip to Discord instead of
   * two). `execute` still answers with `editReply`, sent as the reply.
   */
  instant?: boolean;
  data: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
  /** Runs after the reply was deferred: answer with `editReply`. */
  execute: (interaction: ChatInputCommandInteraction, ctx: Context) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction, ctx: Context) => Promise<{ name: string; value: string }[]>;
}

/** Buttons and select menus, routed on the custom id prefix before the first ":". */
export interface ComponentHandler {
  prefix: string;
  handle: (interaction: ButtonInteraction | StringSelectMenuInteraction, ctx: Context, args: string[]) => Promise<void>;
}
