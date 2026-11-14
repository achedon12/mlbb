import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { choiceOption, optionName, slash, stringOption } from "../discord/builders.js";
import type { Command, Context } from "../discord/types.js";
import { baseEmbed, COLORS, openRow, plain } from "../embeds/common.js";
import { mlbbdleClassicEmbed, mlbbdleSkillEmbed, mlbbdleSolvedPublic } from "../embeds/daily.js";
import { emojiRow, MODES, skillGrid, type Mode } from "../games/mlbbdle.js";
import { dayUtc } from "../games/state.js";
import { log } from "../log.js";
import { resolveByName, searchByName, toChoices } from "../search.js";
import type { Daily, MlbbdleHero } from "../site/schemas.js";

/**
 * MLBBdle in Discord: the site's daily hero, guessed with `/mlbbdle guess:`.
 * Feedback is ephemeral (it would spoil the answer for the others); the
 * solve is announced publicly with the squares only, and sent to the site
 * for the server's leaderboard.
 */

export interface MlbbdleProgress {
  guesses: string[];
  solved: boolean;
}

export function parseMode(value: string | null): Mode {
  return value === "skill" ? "skill" : "classic";
}

function progressKey(guildId: string, userId: string, mode: Mode): string {
  return `${guildId}:${userId}:${mode}`;
}

async function loadDaily(ctx: Context): Promise<Daily | null> {
  if (!ctx.services.site) return null;
  try {
    return await ctx.services.site.daily(dayUtc(), ctx.locale);
  } catch (error) {
    log.warn("daily puzzle unavailable", { error });
    return null;
  }
}

/**
 * Plays one turn (or shows the state when `guess` is null). Shared by the
 * command and the Play button of the daily post; the reply is already deferred.
 */
export async function playMlbbdle(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  ctx: Context,
  mode: Mode,
  guess: string | null,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({ content: ctx.t("ui.common.guildOnly") });
    return;
  }
  const daily = await loadDaily(ctx);
  const secretSlug = mode === "classic" ? daily?.mlbbdle.classic : daily?.mlbbdle.skill?.answer;
  const roster = daily?.mlbbdle.roster ?? [];
  const bySlug = new Map(roster.map((h) => [h.slug, h]));
  const secret = secretSlug ? bySlug.get(secretSlug) : undefined;
  if (!daily || !secretSlug || (mode === "classic" && !secret)) {
    await interaction.editReply({
      embeds: [baseEmbed(ctx, COLORS.slate).setDescription(ctx.t("ui.mlbbdle.unavailable"))],
      components: [openRow(ctx, "/mlbbdle")],
    });
    return;
  }

  const day = daily.day;
  const key = progressKey(guildId, interaction.user.id, mode);
  const progress = ctx.services.mlbbdle.get(day, key) ?? { guesses: [], solved: false };
  let note: string | null = null;
  let justSolved = false;

  if (guess !== null) {
    if (progress.solved) {
      note = ctx.t("ui.mlbbdle.done");
    } else {
      const hero = resolveByName(roster, guess);
      if (!hero) {
        note = ctx.t("ui.common.notFound", { query: plain(guess.slice(0, 100)) });
      } else if (progress.guesses.includes(hero.slug)) {
        note = ctx.t("ui.mlbbdle.already", { hero: hero.name });
      } else {
        progress.guesses.push(hero.slug);
        if (hero.slug === secretSlug) {
          progress.solved = true;
          justSolved = true;
        }
        ctx.services.mlbbdle.set(day, key, progress);
      }
    }
  }

  const guessed = progress.guesses.flatMap((s) => {
    const h = bySlug.get(s);
    return h ? [h] : [];
  });
  const embed =
    mode === "classic"
      ? mlbbdleClassicEmbed(ctx, daily.number, guessed, secret!, progress.solved)
      : mlbbdleSkillEmbed(ctx, daily.number, daily.mlbbdle.skill!, secret ?? null, guessed.filter((g) => g.slug !== secretSlug).map((g) => g.name), progress.solved);
  await interaction.editReply({ ...(note ? { content: note } : {}), embeds: [embed], components: [openRow(ctx, "/mlbbdle")] });

  if (justSolved) await announceSolve(interaction, ctx, mode, daily, guildId, progress.guesses, secret ?? null);
}

async function announceSolve(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  ctx: Context,
  mode: Mode,
  daily: Daily,
  guildId: string,
  guesses: string[],
  secret: MlbbdleHero | null,
): Promise<void> {
  const bySlug = new Map(daily.mlbbdle.roster.map((h) => [h.slug, h]));
  const grid =
    mode === "classic" && secret
      ? guesses.flatMap((s) => {
          const h = bySlug.get(s);
          return h ? [emojiRow(h, secret)] : [];
        })
      : [skillGrid(guesses, daily.mlbbdle.skill?.answer ?? "")];
  const name = interaction.user.displayName;
  try {
    // A follow-up without the ephemeral flag is public; mentions are off, so
    // a display name like "@everyone" pings nobody.
    await interaction.followUp({
      content: mlbbdleSolvedPublic(ctx, name, mode, daily.number, guesses.length, grid),
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    log.warn("mlbbdle public message failed", { error });
  }
  try {
    await ctx.services.site?.submitResults([
      {
        guildId,
        day: daily.day,
        game: mode === "classic" ? "mlbbdle-classic" : "mlbbdle-skill",
        discordUserId: interaction.user.id,
        discordUserName: name.slice(0, 100),
        guesses: guesses.length,
      },
    ]);
  } catch (error) {
    log.warn("mlbbdle result not stored", { error });
  }
}

export const mlbbdle: Command = {
  key: "mlbbdle",
  ephemeral: true,
  guildOnly: true,
  data: () =>
    slash("mlbbdle", { guildOnly: true })
      .addStringOption(stringOption("mlbbdle", "guess", { autocomplete: true, maxLength: 40 }))
      .addStringOption(choiceOption("mlbbdle", "mode", "mode", MODES))
      .toJSON(),
  async autocomplete(interaction, ctx) {
    const focused = String(interaction.options.getFocused());
    // The roster of the daily puzzle when cached, else the public hero list:
    // the names are the same.
    const daily = ctx.services.site ? await ctx.services.site.daily(dayUtc(), ctx.locale).catch(() => null) : null;
    const list: { slug: string; name: string }[] = daily?.mlbbdle.roster ?? (await ctx.services.data.heroes());
    return toChoices(searchByName(list, focused));
  },
  async execute(interaction, ctx) {
    await playMlbbdle(
      interaction,
      ctx,
      parseMode(interaction.options.getString(optionName("mlbbdle", "mode"))),
      interaction.options.getString(optionName("mlbbdle", "guess")),
    );
  },
};

/** Defers a button the way the command is deferred: ephemeral, before any site call. */
export async function deferEphemeral(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}
