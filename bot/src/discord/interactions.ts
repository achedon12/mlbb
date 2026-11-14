import { MessageFlags, type Interaction, type RepliableInteraction } from "discord.js";
import { makeView } from "../embeds/common.js";
import { resolveLocale, translator, type Locale } from "../i18n/index.js";
import { log } from "../log.js";
import { SiteUnavailableError } from "../site/http.js";
import type { Command, ComponentHandler, Context, Services } from "./types.js";

/**
 * Interaction dispatch. Discord gives three seconds for a first answer: every
 * command is deferred before anything else (the locale lookup included), and
 * autocomplete, which cannot be deferred, gets a hard deadline instead.
 * Errors end as a short ephemeral sentence, never a stack trace.
 */

const AUTOCOMPLETE_DEADLINE_MS = 2500;
/** The locale lookup asks the site: past this, the member's own language is used. */
const LOCALE_DEADLINE_MS = 1200;

function withDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise.catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms).unref())]);
}

export async function localeFor(services: Services, guildId: string | null, interactionLocale: string): Promise<Locale> {
  const setting = services.site && guildId ? await withDeadline(services.site.guildLocale(guildId), LOCALE_DEADLINE_MS, null) : null;
  return resolveLocale(setting, interactionLocale);
}

export function contextFor(services: Services, locale: Locale, campaign: string): Context {
  return { ...makeView(locale, services.config.SITE_URL, campaign), t: translator(locale), services };
}

async function replyError(interaction: RepliableInteraction, ctx: Context, error: unknown): Promise<void> {
  const text = ctx.t(error instanceof SiteUnavailableError ? "ui.common.siteDown" : "ui.common.error");
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content: text, embeds: [], components: [] });
    else await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
  } catch {
    // The interaction expired: nothing left to tell the user.
  }
}

export async function handleInteraction(
  interaction: Interaction,
  commands: Map<string, Command>,
  components: ComponentHandler[],
  services: Services,
): Promise<void> {
  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    // No site call for the locale here: the deadline is too tight. The member's
    // language decides (it only changes localized item names).
    const ctx = contextFor(services, resolveLocale(null, interaction.locale), interaction.commandName);
    const choices = await withDeadline(command.autocomplete(interaction, ctx), AUTOCOMPLETE_DEADLINE_MS, []);
    await interaction.respond(choices.slice(0, 25)).catch(() => undefined);
    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    const started = performance.now();
    await interaction.deferReply(command.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    const locale = await localeFor(services, interaction.guildId, interaction.locale);
    const ctx = contextFor(services, locale, command.key);
    let ok = true;
    try {
      if (command.guildOnly && !interaction.inGuild()) {
        await interaction.editReply({ content: ctx.t("ui.common.guildOnly") });
      } else {
        await command.execute(interaction, ctx);
      }
    } catch (error) {
      ok = false;
      log.error("command failed", { command: command.key, error });
      await replyError(interaction, ctx, error);
    } finally {
      services.logger.record({
        command: command.key,
        guildId: interaction.guildId,
        locale,
        durationMs: performance.now() - started,
        ok,
      });
    }
    return;
  }

  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const [prefix, ...args] = interaction.customId.split(":");
    const handler = components.find((c) => c.prefix === prefix);
    if (!handler) return;
    const locale = await localeFor(services, interaction.guildId, interaction.locale);
    const ctx = contextFor(services, locale, prefix ?? "component");
    try {
      await handler.handle(interaction, ctx, args);
    } catch (error) {
      log.error("component failed", { prefix, error });
      await replyError(interaction, ctx, error);
    }
  }
}
