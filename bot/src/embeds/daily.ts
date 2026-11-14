import { ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown, type EmbedBuilder } from "discord.js";
import { emojiRow, nextClue, unlockedClues, yearHint, type Mode } from "../games/mlbbdle.js";
import type { Step } from "../games/quiz.js";
import type { Game, Leaderboard, MlbbdleHero, Period, SkillPuzzle } from "../site/schemas.js";
import { baseEmbed, clip, COLORS, linkButton, listOr, roleLabels, type View } from "./common.js";

/** Embeds of the daily games: MLBBdle, quiz, leaderboards, and the daily post. */

/** Guess rows kept in the reply: past that, the newest ones matter. */
const MAX_ROWS = 15;

export function mlbbdleClassicEmbed(view: View, number: number, guesses: MlbbdleHero[], secret: MlbbdleHero, solved: boolean): EmbedBuilder {
  const embed = baseEmbed(view, solved ? COLORS.green : COLORS.brand)
    .setTitle(`${view.t("ui.mlbbdle.title", { number })} · ${view.t("ui.mlbbdle.classic")}`)
    .setURL(view.link("/mlbbdle"));
  const rows = guesses.slice(-MAX_ROWS).map((g) => {
    const hint = g.slug === secret.slug ? "" : yearHint(g, secret);
    return `${emojiRow(g, secret)} ${hint ? `${hint} ` : ""}${escapeMarkdown(g.name)}`;
  });
  const lines = [
    solved ? view.t("ui.mlbbdle.solved", { hero: escapeMarkdown(secret.name), n: guesses.length }) : view.t("ui.mlbbdle.howTo"),
    "",
    `-# ${view.t("ui.mlbbdle.columns")}`,
    ...rows,
  ];
  if (guesses.length && !solved) lines.push(`-# ${view.t("ui.mlbbdle.guesses", { n: guesses.length })}`);
  if (guesses.length) embed.addFields({ name: view.t("ui.mlbbdle.guesses", { n: guesses.length }), value: "​", inline: true });
  return embed.setDescription(clip(lines.join("\n"), 4096));
}

export function mlbbdleSkillEmbed(
  view: View,
  number: number,
  puzzle: SkillPuzzle,
  secret: MlbbdleHero | null,
  wrong: string[],
  solved: boolean,
): EmbedBuilder {
  const embed = baseEmbed(view, solved ? COLORS.green : COLORS.azure)
    .setTitle(`${view.t("ui.mlbbdle.title", { number })} · ${view.t("ui.mlbbdle.skill")}`)
    .setURL(view.link("/mlbbdle"));
  const icon = view.asset(puzzle.icon);
  if (icon) embed.setThumbnail(icon);
  const clues = unlockedClues(wrong.length);
  if (solved || clues.has("name")) embed.addFields({ name: view.t("ui.mlbbdle.clueName"), value: clip(puzzle.name), inline: true });
  if ((solved || clues.has("description")) && puzzle.excerpt) embed.addFields({ name: view.t("ui.mlbbdle.clueExcerpt"), value: clip(puzzle.excerpt) });
  if ((solved || clues.has("roles")) && secret) embed.addFields({ name: view.t("ui.mlbbdle.clueRoles"), value: listOr(view, roleLabels(view, secret.roles)) });
  const lines = [solved && secret ? view.t("ui.mlbbdle.solved", { hero: escapeMarkdown(secret.name), n: wrong.length + 1 }) : view.t("ui.mlbbdle.skillPrompt")];
  if (wrong.length) lines.push("", `🟥 ${wrong.slice(-MAX_ROWS).map((w) => escapeMarkdown(w)).join(", ")}`);
  const next = solved ? null : nextClue(wrong.length);
  if (next) lines.push("", `-# ${view.t("ui.mlbbdle.nextClue", { n: next.remaining })}`);
  return embed.setDescription(clip(lines.join("\n"), 4096));
}

/** The public "solved" line: the grid of squares, never the hero's name. */
export function mlbbdleSolvedPublic(view: View, user: string, mode: Mode, number: number, guesses: number, grid: string[]): string {
  const head = view.t("ui.mlbbdle.solvedPublic", { user: escapeMarkdown(user), mode: view.t(`ui.mlbbdle.${mode}`), n: guesses });
  return clip(`${head}\nMLBBdle #${number}\n${grid.slice(-8).join("\n")}`, 2000);
}

export function quizStepEmbed(view: View, number: number, step: Step, index: number, total: number, feedback: string | null): EmbedBuilder {
  const embed = baseEmbed(view, COLORS.azure)
    .setTitle(view.t("ui.quiz.title", { number }))
    .setURL(view.link("/quiz"))
    .setAuthor({ name: view.t("ui.quiz.round", { n: index + 1, total }) });
  const lines: string[] = feedback ? [feedback, ""] : [];
  if (step.kind === "duel") {
    lines.push(`**${view.t("ui.quiz.duel")}**`, `${step.pair + 1}/${step.pairs}`);
  } else {
    const r = step.round;
    lines.push(`**${view.t(`ui.quiz.${r.type}`)}**`);
    if (r.type === "skill") {
      if (r.extrait) lines.push("", `> ${r.extrait}`);
      const icon = view.asset(r.icone);
      if (icon) embed.setThumbnail(icon);
    } else if (r.type === "skin") {
      const image = view.asset(r.image);
      if (image) embed.setImage(image);
    } else if (r.type === "story") {
      lines.push("", ...r.extraits.slice(0, 3).map((e) => `> ${e}`));
    } else if (r.type === "item") {
      if (r.bonus) lines.push("", r.bonus);
      if (r.prix !== null) lines.push(view.t("ui.quiz.price", { price: r.prix }));
      if (r.categorie) lines.push(r.categorie);
      if (r.recette.length) lines.push(r.recette.map((x) => x.nom).join(" + "));
      if (r.passif) lines.push("", `> ${r.passif}`);
    }
  }
  return embed.setDescription(clip(lines.join("\n"), 4096));
}

/** One button per choice; the custom id carries the day and the step, so a stale click is recognised. */
export function quizButtons(day: string, index: number, step: Step): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    step.choices.map((c, i) =>
      new ButtonBuilder().setCustomId(`quiz:${day}:${index}:${i}`).setStyle(ButtonStyle.Primary).setLabel(c.label.slice(0, 80)),
    ),
  );
}

export function quizFinishedEmbed(view: View, number: number, points: number, max: number, feedback: string | null): EmbedBuilder {
  return baseEmbed(view, COLORS.green)
    .setTitle(view.t("ui.quiz.title", { number }))
    .setURL(view.link("/quiz"))
    .setDescription([feedback, view.t("ui.quiz.finished", { points, max })].filter(Boolean).join("\n\n"));
}

export function leaderboardEmbed(view: View, game: Game, period: Period, board: Leaderboard): EmbedBuilder {
  const embed = baseEmbed(view)
    .setTitle(view.t("ui.leaderboard.title", { game: view.t(`choices.game.${game}`), period: view.t(`choices.period.${period}`) }))
    .setURL(view.link(game === "quiz" ? "/quiz" : "/mlbbdle"));
  if (!board.entries.length) return embed.setDescription(view.t("ui.leaderboard.empty"));
  const medal = ["🥇", "🥈", "🥉"];
  const lines = board.entries.slice(0, 10).map((e, i) => {
    const rank = e.rank ?? i + 1;
    const plays = e.plays ?? e.played ?? 0;
    const detail =
      game === "quiz"
        ? view.t("ui.leaderboard.points", { n: e.score, plays })
        : view.t("ui.leaderboard.solvedDays", { n: plays, avg: e.score.toFixed(1) });
    return `${medal[rank - 1] ?? `**${rank}.**`} ${escapeMarkdown(e.discordUserName)} — ${detail}`;
  });
  return embed.setDescription(clip(lines.join("\n"), 4096));
}

/** The daily post: what the game is, a Play button, and the page on the site. */
export function dailyPost(view: View, game: "mlbbdle" | "quiz", day: string, number: number) {
  const embed = baseEmbed(view, game === "quiz" ? COLORS.azure : COLORS.brand)
    .setTitle(view.t(`ui.${game}.dailyTitle`, { number }))
    .setDescription(view.t(`ui.${game}.dailyBody`))
    .setURL(view.link(`/${game}`));
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`daily:${game}:${day}`).setStyle(ButtonStyle.Success).setLabel(view.t("ui.mlbbdle.play")),
    linkButton(view.t("ui.mlbbdle.playOnSite"), view.link(`/${game}`)),
  );
  return { embeds: [embed.toJSON()], components: [row.toJSON()], allowed_mentions: { parse: [] } };
}
