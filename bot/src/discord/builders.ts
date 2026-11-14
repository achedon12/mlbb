import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  type APIApplicationCommandOptionChoice,
  type SlashCommandStringOption,
} from "discord.js";
import { localizations, t } from "../i18n/index.js";

/**
 * Localized command builders. The English text is the default; every other
 * language comes from its JSON file through `localizations`, so a command
 * file never repeats a translation.
 */

export function slash(key: string, { guildOnly = false } = {}): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName(t("en", `commands.${key}.name`))
    .setNameLocalizations(localizations(`commands.${key}.name`))
    .setDescription(t("en", `commands.${key}.description`))
    .setDescriptionLocalizations(localizations(`commands.${key}.description`))
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(guildOnly ? [InteractionContextType.Guild] : [InteractionContextType.Guild, InteractionContextType.BotDM]);
}

/** English name of an option: what `interaction.options.get*` expects. */
export function optionName(command: string, option: string): string {
  return t("en", `commands.${command}.options.${option}.name`);
}

export function stringOption(command: string, option: string, { required = false, autocomplete = false, maxLength = 100 } = {}) {
  return (o: SlashCommandStringOption) =>
    o
      .setName(optionName(command, option))
      .setNameLocalizations(localizations(`commands.${command}.options.${option}.name`))
      .setDescription(t("en", `commands.${command}.options.${option}.description`))
      .setDescriptionLocalizations(localizations(`commands.${command}.options.${option}.description`))
      .setRequired(required)
      .setAutocomplete(autocomplete)
      .setMaxLength(maxLength);
}

/** Fixed choices of an option, labelled from `choices.<group>.<value>`. */
export function choices(group: string, values: readonly string[]): APIApplicationCommandOptionChoice<string>[] {
  return values.map((value) => ({
    name: t("en", `choices.${group}.${value}`),
    name_localizations: localizations(`choices.${group}.${value}`),
    value,
  }));
}

export function choiceOption(command: string, option: string, group: string, values: readonly string[], required = false) {
  return (o: SlashCommandStringOption) =>
    stringOption(command, option, { required })(o).addChoices(...choices(group, values));
}
