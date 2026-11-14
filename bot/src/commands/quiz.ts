import { escapeMarkdown, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { slash } from "../discord/builders.js";
import type { Command, ComponentHandler, Context } from "../discord/types.js";
import { baseEmbed, COLORS, openRow } from "../embeds/common.js";
import { quizButtons, quizFinishedEmbed, quizStepEmbed } from "../embeds/daily.js";
import { answer, buildSteps, type Step } from "../games/quiz.js";
import { dayUtc } from "../games/state.js";
import { log } from "../log.js";
import type { Daily } from "../site/schemas.js";

/**
 * The daily quiz in Discord, one ephemeral message that moves from round to
 * round as the player clicks. Progress stays in memory; the final score goes
 * to the site (leaderboard) and to the channel (one public line).
 */

const key = (guildId: string, userId: string) => `${guildId}:${userId}`;

async function load(ctx: Context, day = dayUtc()): Promise<{ daily: Daily; steps: Step[] } | null> {
  if (!ctx.services.site) return null;
  try {
    const daily = await ctx.services.site.daily(day, ctx.locale);
    const steps = buildSteps(daily);
    return steps.length ? { daily, steps } : null;
  } catch (error) {
    log.warn("daily quiz unavailable", { error });
    return null;
  }
}

/** Shows the current round, or the final score. The reply is already deferred. */
export async function startQuiz(interaction: ChatInputCommandInteraction | ButtonInteraction, ctx: Context): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({ content: ctx.t("ui.common.guildOnly") });
    return;
  }
  const game = await load(ctx);
  if (!game) {
    await interaction.editReply({
      embeds: [baseEmbed(ctx, COLORS.night).setDescription(ctx.t("ui.quiz.unavailable"))],
      components: [openRow(ctx, "/quiz")],
    });
    return;
  }
  const { daily, steps } = game;
  const number = daily.quiz?.numero ?? daily.number;
  const progress = ctx.services.quiz.get(daily.day, key(guildId, interaction.user.id)) ?? { step: 0, points: 0, finished: false };
  if (progress.finished) {
    await interaction.editReply({
      embeds: [baseEmbed(ctx, COLORS.green).setDescription(ctx.t("ui.quiz.done", { points: progress.points, max: steps.length }))],
      components: [openRow(ctx, "/quiz")],
    });
    return;
  }
  ctx.services.quiz.set(daily.day, key(guildId, interaction.user.id), progress);
  const step = steps[progress.step]!;
  await interaction.editReply({
    embeds: [quizStepEmbed(ctx, number, step, progress.step, steps.length, null)],
    components: [quizButtons(daily.day, progress.step, step)],
  });
}

export const quiz: Command = {
  key: "quiz",
  ephemeral: true,
  guildOnly: true,
  data: () => slash("quiz", { guildOnly: true }).toJSON(),
  execute: startQuiz,
};

/** Custom id `quiz:<day>:<step>:<choice>`, all validated before use. */
export function parseQuizButton(args: string[]): { day: string; step: number; choice: number } | null {
  const [day, step, choice] = args;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{1,2}$/.test(step ?? "") || !/^\d$/.test(choice ?? "")) return null;
  return { day, step: Number(step), choice: Number(choice) };
}

export const quizButtonsHandler: ComponentHandler = {
  prefix: "quiz",
  async handle(interaction, ctx, args) {
    if (!interaction.isButton() || !interaction.guildId) return;
    const parsed = parseQuizButton(args);
    // Yesterday's buttons: the day turned while the message was open.
    if (!parsed || parsed.day !== dayUtc()) {
      await interaction.update({ content: ctx.t("ui.common.expired"), embeds: [], components: [] });
      return;
    }
    await interaction.deferUpdate();
    const game = await load(ctx, parsed.day);
    const progress = ctx.services.quiz.get(parsed.day, key(interaction.guildId, interaction.user.id));
    if (!game || !progress) {
      await interaction.editReply({ content: ctx.t("ui.common.expired"), embeds: [], components: [] });
      return;
    }
    const { daily, steps } = game;
    const step = steps[parsed.step];
    const chosen = step?.choices[parsed.choice];
    if (!step || !chosen) return;
    const right = answer(progress, steps, parsed.step, chosen.slug);
    if (right === null) return; // A double click or an old message: the state already moved on.
    const answerLabel = step.choices.find((c) => c.slug === step.answer)?.label ?? step.answer;
    const feedback = right ? `✅ ${ctx.t("ui.quiz.right")}` : `❌ ${ctx.t("ui.quiz.wrong", { answer: escapeMarkdown(answerLabel) })}`;
    const number = daily.quiz?.numero ?? daily.number;

    if (!progress.finished) {
      const next = steps[progress.step]!;
      await interaction.editReply({
        embeds: [quizStepEmbed(ctx, number, next, progress.step, steps.length, feedback)],
        components: [quizButtons(daily.day, progress.step, next)],
      });
      return;
    }

    await interaction.editReply({ embeds: [quizFinishedEmbed(ctx, number, progress.points, steps.length, feedback)], components: [openRow(ctx, "/quiz")] });
    const name = interaction.user.displayName;
    try {
      await interaction.followUp({
        content: ctx.t("ui.quiz.finishedPublic", { user: escapeMarkdown(name), points: progress.points, max: steps.length }),
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      log.warn("quiz public message failed", { error });
    }
    try {
      await ctx.services.site?.submitResults([
        { guildId: interaction.guildId, day: daily.day, game: "quiz", discordUserId: interaction.user.id, discordUserName: name.slice(0, 100), points: progress.points },
      ]);
    } catch (error) {
      log.warn("quiz result not stored", { error });
    }
  },
};
