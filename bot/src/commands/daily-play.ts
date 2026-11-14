import type { ComponentHandler } from "../discord/types.js";
import { deferEphemeral, playMlbbdle } from "./mlbbdle.js";
import { startQuiz } from "./quiz.js";

/** The Play button of the daily posts: opens the game for whoever clicks, privately. */
export const dailyPlayHandler: ComponentHandler = {
  prefix: "daily",
  async handle(interaction, ctx, [game]) {
    if (!interaction.isButton()) return;
    await deferEphemeral(interaction);
    if (game === "quiz") await startQuiz(interaction, ctx);
    else await playMlbbdle(interaction, ctx, "classic", null);
  },
};
